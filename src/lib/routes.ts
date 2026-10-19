import type { Product, Variant } from "../types";
import type { Language } from "./translations";

export function localizedUrl(path: string, language: Language): string {
  const url = new URL(path, "http://route.local");
  if (language === "ru") url.searchParams.delete("lang");
  else url.searchParams.set("lang", language);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function productSlug(product: Pick<Product, "slug">) {
  return (
    product.slug
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "") || "product"
  );
}

export function productUrl(
  product: Pick<Product, "slug">,
  variant: Pick<Variant, "id">,
  language: Language = "ru",
  demo = false,
) {
  return localizedUrl(
    `/products/${encodeURIComponent(productSlug(product))}/${encodeURIComponent(variant.id)}${demo ? "?demo=1" : ""}`,
    language,
  );
}

export function productRoute(
  pathname: string,
): { slug: string; variantId?: string } | null {
  const match = /^\/products\/([^/]+)(?:\/([0-9]+))?\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return { slug: decodeURIComponent(match[1]), variantId: match[2] };
  } catch {
    return null;
  }
}

export function pageNumber(value: string | null): number {
  const page = Number(value || 1);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function catalogFilters(search: string) {
  const params = new URLSearchParams(search);
  return {
    query: params.get("q") || "",
    category: params.get("category") || "",
    sort: params.get("sort") || "newest",
    inStock: params.get("stock") === "1",
    favoritesOnly: params.get("view") === "favorites",
  };
}
