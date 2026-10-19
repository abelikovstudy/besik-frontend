import type { PageData } from "../hooks/usePage";
import {
  filterVariantEntries,
  localized,
  maxQuantity,
  stepOf,
} from "./catalog";
import { languages, translate } from "./translations";
import { catalogFilters, localizedUrl, pageNumber, productUrl } from "./routes";
import { productAttributes } from "./productDetails";

export const escapeHtml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export const safeJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
const plainText = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function seoHead(data: PageData) {
  const url = new URL(data.url, data.origin);
  const language = data.language;
  const entries = data.catalog
    ? filterVariantEntries(data.catalog, {
        query: "",
        category: "",
        sort: "newest",
        inStock: false,
      })
    : [];
  const entry = entries.find((item) => item.variant.id === data.variantId);
  let title = `Shop — ${translate("Хорошо быть дома.", language)}`;
  let description = translate(
    "Каталог товаров для дома. Описания, характеристики, цены и наличие.",
    language,
  );
  let path = "/";
  const page = pageNumber(url.searchParams.get("page"));
  if (page > 1 && data.kind === "catalog") {
    path = `/?page=${page}`;
    title += ` — ${translate("Страница", language)} ${page}`;
  }
  const graphs: Record<string, unknown>[] = [];
  let image: string | undefined;
  if (entry && data.catalog) {
    const { product, variant } = entry;
    path = productUrl(product, variant);
    title = `${localized(product.nameI18n, language)} — Shop`;
    const details = plainText(localized(product.descriptionI18n, language));
    description = (
      details ||
      `${localized(product.nameI18n, language)}. ${translate("Характеристики", language)}, ${translate("Артикул", language)}: ${variant.sku}.`
    ).slice(0, 170);
    image = data.images[variant.id]?.[0];
    const canonical = new URL(localizedUrl(path, language), data.origin).href;
    const productSchema: Record<string, unknown> = {
      "@type": "Product",
      "@id": `${canonical}#product`,
      name: localized(product.nameI18n, language),
      url: canonical,
      sku: variant.sku,
      ...(details ? { description: details } : {}),
      ...(data.images[variant.id]?.length
        ? { image: data.images[variant.id] }
        : {}),
      ...(product.brandName
        ? { brand: { "@type": "Brand", name: product.brandName } }
        : {}),
      additionalProperty: productAttributes(product, variant, language).map(
        (item) => ({
          "@type": "PropertyValue",
          name: translate(item.name, language),
          value: translate(item.value, language),
        }),
      ),
    };
    // A zero placeholder price is not advertised as a free offer.
    if (
      Number.isFinite(Number(variant.price)) &&
      Number(variant.price) > 0 &&
      /^[A-Z]{3}$/.test(variant.currency)
    ) {
      productSchema.offers = {
        "@type": "Offer",
        url: canonical,
        price: variant.price,
        priceCurrency: variant.currency,
        availability: `https://schema.org/${maxQuantity(data.catalog, variant) >= stepOf(data.catalog, variant) ? "InStock" : "OutOfStock"}`,
      };
    }
    graphs.push(productSchema);
    const category = data.catalog.categories.find(
      (item) => item.id === product.categoryId,
    );
    const crumbs = [
      {
        name: translate("Все товары", language),
        url: new URL(localizedUrl("/", language), data.origin).href,
      },
    ];
    if (category)
      crumbs.push({
        name: localized(category.nameI18n, language),
        url: new URL(
          localizedUrl(
            `/?category=${encodeURIComponent(category.id)}`,
            language,
          ),
          data.origin,
        ).href,
      });
    crumbs.push({
      name: localized(product.nameI18n, language),
      url: canonical,
    });
    graphs.push({
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    });
  } else if (data.kind === "catalog") {
    const visible = data.catalog
      ? filterVariantEntries(data.catalog, {
          ...catalogFilters(url.search),
          language,
        })
      : [];
    graphs.push({
      "@type": "ItemList",
      itemListElement: visible
        .slice((page - 1) * 12, page * 12)
        .map((item, index) => ({
          "@type": "ListItem",
          position: (page - 1) * 12 + index + 1,
          url: new URL(
            productUrl(item.product, item.variant, language),
            data.origin,
          ).href,
        })),
    });
  }
  const noindex =
    (data.kind !== "catalog" && data.kind !== "product") ||
    ["q", "view", "category", "sort", "stock", "demo", "cart"].some((key) =>
      url.searchParams.has(key),
    );
  if (data.kind === "not-found")
    title = `404 — ${translate("Страница не найдена", language)} — Shop`;
  if (data.kind === "unavailable")
    title = `503 — ${translate("Магазин временно недоступен", language)} — Shop`;
  if (data.kind === "auth") {
    title = `${translate("Вход и регистрация", language)} — Shop`;
    path = url.pathname;
  }
  if (data.kind === "not-found" || data.kind === "unavailable")
    path = url.pathname;
  const canonical = new URL(localizedUrl(path, language), data.origin).href;
  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:type" content="${entry ? "product" : "website"}">`,
    `<meta property="og:site_name" content="Shop">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:locale" content="${{ ru: "ru_RU", en: "en_US", ka: "ka_GE" }[language]}">`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
  ];
  if (!noindex) {
    for (const lang of languages)
      head.push(
        `<link rel="alternate" hreflang="${lang}" href="${escapeHtml(new URL(localizedUrl(path, lang), data.origin).href)}">`,
      );
    head.push(
      `<link rel="alternate" hreflang="x-default" href="${escapeHtml(new URL(path, data.origin).href)}">`,
    );
  }
  if (image)
    head.push(
      `<meta property="og:image" content="${escapeHtml(image)}">`,
      `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    );
  if (graphs.length && !noindex)
    head.push(
      `<script type="application/ld+json">${safeJson({ "@context": "https://schema.org", "@graph": graphs })}</script>`,
    );
  return head.join("\n");
}
