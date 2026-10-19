import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { handleRequest } from "../entry-server";
import { seoHead, safeJson } from "./seo";
import { productRoute, productUrl } from "./routes";
import { demoCatalog } from "../data/demo";
import type { PageData } from "../hooks/usePage";

const template =
  '<html lang="ru"><head><!--app-head--></head><body><div id="root"><!--app-html--></div><!--app-data--></body></html>';
async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
const close = (server: Server) =>
  new Promise<void>((resolve) => server.close(() => resolve()));

test("public pages return indexable product HTML, crawlable pagination and sitemap without browser JS or a session", async () => {
  const products = Array.from({ length: 14 }, (_, i) => ({
    ...demoCatalog.products[0],
    id: String(i + 1),
    slug: `item-${i + 1}`,
    nameI18n: { ru: `Товар ${i + 1}`, en: `Product ${i + 1}` },
    descriptionI18n: {
      ru: "Настоящее описание из API",
      en: "Actual API description",
    },
    attributes: {
      Материал: "Дерево",
      Размеры: { width: 10, height: 20 },
      color: {
        keyI18n: { ru: "Цвет", en: "Color" },
        valueI18n: { ru: "Алый", en: "Scarlet" },
      },
    },
  }));
  const variants = products.map((product, i) => ({
    ...demoCatalog.variants[0],
    id: String(i + 1),
    productId: product.id,
    sku: `SKU-${i + 1}`,
    nameI18n: product.nameI18n,
    price: "10.00",
  }));
  const routes = new Map<string, unknown>([
    ["/api/products", products],
    ["/api/categories", demoCatalog.categories],
    ["/api/product-variants/active", variants],
    ["/api/units", demoCatalog.units],
    ["/api/inventory/available", [{ variantId: "1", availableQty: "2" }]],
  ]);
  const requests: string[] = [];
  const api = createServer((req, res) => {
    assert.equal(
      req.headers.cookie,
      undefined,
      "Public SSR requests must not forward sessions",
    );
    assert.equal(req.headers.authorization, undefined);
    requests.push(req.url!);
    const body =
      routes.get(req.url!) ?? (/\/images$/.test(req.url!) ? [] : null);
    res.writeHead(body === null ? 404 : 200, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(body));
  });
  const apiOrigin = await listen(api);
  const app = createServer((req, res) => {
    handleRequest(req, res, {
      api: `${apiOrigin}/api`,
      publicApi: "/api",
      origin: "https://shop.example",
      template,
    }).catch((error) => {
      res.writeHead(500);
      res.end(String(error));
    });
  });
  const base = await listen(app);
  try {
    const response = await fetch(`${base}/products/item-1/1`, {
      headers: { Cookie: "private-session=secret" },
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<h1>Товар 1<\/h1>/);
    assert.match(html, /Настоящее описание из API/);
    assert.match(html, /id="product-description"/);
    assert.match(html, /id="product-attributes"/);
    assert.match(html, /Дерево/);
    assert.match(html, /Алый/);
    assert.match(html, /width: 10; height: 20/);
    assert.match(
      html,
      /rel="canonical" href="https:\/\/shop.example\/products\/item-1\/1"/,
    );
    assert.match(html, /hreflang="en"/);
    assert.match(html, /property="og:type" content="product"/);
    const graph = JSON.parse(
      html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1],
    )["@graph"];
    const product = graph.find(
      (node: { "@type": string }) => node["@type"] === "Product",
    );
    assert.equal(product.sku, "SKU-1");
    assert.equal(product.offers.price, "10.00");
    assert.equal(product.offers.availability, "https://schema.org/InStock");
    assert.equal(product.aggregateRating, undefined);
    assert.ok(
      graph.some(
        (node: { "@type": string }) => node["@type"] === "BreadcrumbList",
      ),
    );
    const english = await (
      await fetch(`${base}/products/item-1/1?lang=en`)
    ).text();
    assert.match(english, /<html lang="en">/);
    assert.match(english, /<h1>Product 1<\/h1>/);
    assert.match(english, /Actual API description/);
    assert.match(english, /Scarlet/);
    const preferred = await fetch(`${base}/products/item-1/1`, {
      headers: { Cookie: "besik-language=ka" },
      redirect: "manual",
    });
    assert.equal(preferred.status, 302);
    assert.equal(
      preferred.headers.get("location"),
      "/products/item-1/1?lang=ka",
    );
    const home = await (await fetch(base)).text();
    assert.match(home, /href="\/products\/item-1\/1"/);
    assert.match(home, /rel="next"/);
    const page2 = await (await fetch(`${base}/?page=2`)).text();
    assert.match(page2, /rel="prev"/);
    assert.match(page2, /href="\/products\/item-13\/13"/);
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    assert.equal((sitemap.match(/<url>/g) || []).length, 45);
    assert.match(sitemap, /products\/item-14\/14/);
    assert.match(sitemap, /xhtml:link/);
    const robots = await (await fetch(`${base}/robots.txt`)).text();
    assert.match(robots, /Sitemap: https:\/\/shop.example\/sitemap.xml/);
    assert.match(robots, /Allow: \/api\/images\//);
    for (const route of ["/products/missing/999", "/not-a-route", "/?page=99"])
      assert.equal((await fetch(base + route)).status, 404, route);
    const redirect = await fetch(`${base}/products/wrong-slug/1`, {
      redirect: "manual",
    });
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get("location"), "/products/item-1/1");
    assert.equal(
      (await fetch(`${base}/products/item-1/1`, { method: "HEAD" })).status,
      200,
    );
    const auth = await (await fetch(`${base}/auth`)).text();
    assert.match(auth, /noindex, follow/);
    assert.ok(requests.every((route) => !route.includes("/auth/")));
  } finally {
    await close(app);
    await close(api);
  }
});

test("API failures return 503 with noindex instead of a fake product or a successful empty page", async () => {
  const api = createServer((_req, res) => {
    res.writeHead(503);
    res.end();
  });
  const apiOrigin = await listen(api);
  const app = createServer((req, res) => {
    void handleRequest(req, res, {
      api: `${apiOrigin}/api`,
      publicApi: "/api",
      origin: "https://shop.example",
      template,
    });
  });
  const base = await listen(app);
  try {
    const response = await fetch(`${base}/products/item/1`);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("retry-after"), "30");
    assert.match(await response.text(), /noindex, follow/);
    assert.equal((await fetch(`${base}/sitemap.xml`)).status, 503);
  } finally {
    await close(app);
    await close(api);
  }
});

test("SEO serialization prevents HTML/script injection and omits placeholder offers", () => {
  const catalog = structuredClone(demoCatalog);
  catalog.products[0].nameI18n.ru = '</title><script>alert("x")</script>';
  catalog.variants[0].nameI18n = {};
  catalog.variants[0].price = "0";
  const data: PageData = {
    url: productUrl(catalog.products[0], catalog.variants[0]),
    origin: "https://shop.example",
    kind: "product",
    language: "ru",
    catalog,
    variantId: "1",
    images: {},
    rendered: true,
  };
  const head = seoHead(data);
  assert.ok(!head.includes('<script>alert("x")</script>'));
  const graph = JSON.parse(
    head.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1],
  )["@graph"];
  assert.equal(graph[0].offers, undefined);
  assert.equal(JSON.parse(safeJson({ value: "</script>" })).value, "</script>");
  assert.deepEqual(productRoute("/products/test/9007199254740993"), {
    slug: "test",
    variantId: "9007199254740993",
  });
  assert.equal(productRoute("/products/test/not-an-id"), null);
  assert.equal(
    productUrl({ slug: "SPA Pavilion — Concept" }, { id: "123" }),
    "/products/spa-pavilion-concept/123",
  );
});
