import { renderToString } from "react-dom/server";
import type { IncomingMessage, ServerResponse } from "node:http";
import App from "./App";
import { PageProvider, type PageData } from "./hooks/usePage";
import { LanguageProvider } from "./hooks/useLanguage";
import {
  catalogFilters,
  localizedUrl,
  pageNumber,
  productRoute,
  productSlug,
  productUrl,
} from "./lib/routes";
import { filterVariantEntries } from "./lib/catalog";
import { isLanguage, languages } from "./lib/translations";
import { escapeHtml, safeJson, seoHead } from "./lib/seo";
import { resolveImageUrl } from "./lib/images";
import { serverCatalog, serverImages } from "./server/data";

export interface ServerOptions {
  api: string;
  origin: string;
  publicApi: string;
  template: string;
}

export async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: ServerOptions,
) {
  const { origin, api, publicApi } = options;
  let url: URL;
  try {
    url = new URL(request.url || "/", origin);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  if (!["GET", "HEAD"].includes(request.method || "GET")) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  const send = (
    body: string,
    status = 200,
    type = "text/html; charset=utf-8",
  ) => {
    response.writeHead(status, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...(status === 503 ? { "Retry-After": "30" } : {}),
    });
    response.end(request.method === "HEAD" ? undefined : body);
  };
  if (url.pathname === "/robots.txt") {
    send(
      `User-agent: *\nAllow: /\nAllow: /api/images/\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,
      200,
      "text/plain; charset=utf-8",
    );
    return;
  }
  if (/^\/sitemap(?:-[0-9]+)?\.xml$/.test(url.pathname)) {
    try {
      const catalog = await serverCatalog(api);
      const entries = filterVariantEntries(catalog, {
        query: "",
        category: "",
        sort: "newest",
        inStock: false,
      });
      const paths = [
        "/",
        ...entries.map((item) => productUrl(item.product, item.variant)),
      ];
      const pages = Math.ceil(paths.length / 10_000);
      let body: string;
      if (url.pathname === "/sitemap.xml" && pages > 1) {
        body = `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: pages }, (_, i) => `<sitemap><loc>${origin}/sitemap-${i + 1}.xml</loc></sitemap>`).join("")}</sitemapindex>`;
      } else {
        const number =
          url.pathname === "/sitemap.xml"
            ? 1
            : Number(url.pathname.match(/[0-9]+/)?.[0]);
        if (number < 1 || number > pages) {
          send("Not found", 404, "text/plain");
          return;
        }
        body = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${paths
          .slice((number - 1) * 10_000, number * 10_000)
          .flatMap((path) =>
            languages.map(
              (language) =>
                `<url><loc>${escapeHtml(new URL(localizedUrl(path, language), origin).href)}</loc>${languages.map((alt) => `<xhtml:link rel="alternate" hreflang="${alt}" href="${escapeHtml(new URL(localizedUrl(path, alt), origin).href)}"/>`).join("")}</url>`,
            ),
          )
          .join("")}</urlset>`;
      }
      send(
        `<?xml version="1.0" encoding="UTF-8"?>${body}`,
        200,
        "application/xml; charset=utf-8",
      );
    } catch {
      send(
        "Sitemap is temporarily unavailable",
        503,
        "text/plain; charset=utf-8",
      );
    }
    return;
  }
  if (
    /^\/(?:assets\/|src\/|server\/|node_modules\/)|\.(?:js|css|map|ico)$/.test(
      url.pathname,
    )
  ) {
    send("Not found", 404, "text/plain; charset=utf-8");
    return;
  }
  const languageParam = url.searchParams.get("lang");
  const preferred = request.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("besik-language="))
    ?.split("=")[1];
  if (
    !languageParam &&
    isLanguage(preferred) &&
    preferred !== "ru" &&
    (url.pathname === "/" || productRoute(url.pathname))
  ) {
    response.writeHead(302, {
      Location: localizedUrl(`${url.pathname}${url.search}`, preferred),
      "Cache-Control": "private, no-store",
    });
    response.end();
    return;
  }
  const data: PageData = {
    url: `${url.pathname}${url.search}`,
    origin,
    language: isLanguage(languageParam) ? languageParam : "ru",
    kind: "not-found",
    catalog: null,
    images: {},
    rendered: true,
  };
  let status = 404;
  const route = productRoute(url.pathname);
  if (
    ["/auth", "/auth/", "/verify-email", "/verify-email/"].includes(
      url.pathname,
    )
  ) {
    data.kind = "auth";
    data.rendered = false;
    status = 200;
  } else if (url.pathname === "/" || route) {
    try {
      const demo =
        url.searchParams.get("demo") === "1" ||
        import.meta.env?.VITE_DEMO_MODE === "true";
      data.catalog = demo
        ? (await import("./data/demo")).demoCatalog
        : await serverCatalog(api);
      data.rendered = !demo;
      const entries = filterVariantEntries(data.catalog, {
        query: "",
        category: "",
        sort: "newest",
        inStock: false,
      });
      const entry = route
        ? entries.find((item) =>
            route.variantId
              ? item.variant.id === route.variantId
              : item.product.slug === route.slug ||
                productSlug(item.product) === route.slug,
          )
        : undefined;
      if (
        route &&
        entry &&
        (productSlug(entry.product) !== route.slug ||
          !route.variantId ||
          url.pathname.endsWith("/"))
      ) {
        response.writeHead(308, {
          Location: productUrl(
            entry.product,
            entry.variant,
            data.language,
            demo,
          ),
        });
        response.end();
        return;
      }
      const filtered = filterVariantEntries(data.catalog, {
        ...catalogFilters(url.search),
        language: data.language,
      });
      const page = pageNumber(url.searchParams.get("page"));
      if (
        (route && !entry) ||
        (!route && page > Math.max(1, Math.ceil(filtered.length / 12)))
      ) {
        data.kind = "not-found";
      } else {
        data.kind = route ? "product" : "catalog";
        status = 200;
        data.variantId = entry?.variant.id;
        const visible = entry
          ? [entry]
          : filtered.slice((page - 1) * 12, page * 12);
        await Promise.all(
          visible.map(async ({ product, variant }) => {
            let images: string[] = [];
            if (!demo)
              images = await serverImages(
                variant.id,
                api,
                publicApi,
                origin,
              ).catch(() => []);
            if (!images.length) {
              const fallback =
                variant.attributes?.imageUrl || product.attributes?.imageUrl;
              const resolved =
                typeof fallback === "string"
                  ? resolveImageUrl(fallback, publicApi, origin)
                  : undefined;
              if (resolved) images = [resolved];
            }
            data.images[variant.id] = images;
          }),
        );
      }
    } catch {
      status = 503;
      data.kind = "unavailable";
      data.catalog = null;
      data.error = "Не удалось загрузить товары. Попробуйте позже.";
    }
  }
  const app = data.rendered
    ? renderToString(
        <PageProvider data={data}>
          <LanguageProvider initialLanguage={data.language}>
            <App />
          </LanguageProvider>
        </PageProvider>,
      )
    : "";
  const html = options.template
    .replace('<html lang="ru">', `<html lang="${data.language}">`)
    .replace("<!--app-head-->", () => seoHead(data))
    .replace("<!--app-html-->", () => app)
    .replace(
      "<!--app-data-->",
      () =>
        `<script id="besik-page-data" type="application/json">${safeJson(data)}</script>`,
    );
  send(html, status);
}
