import type { Catalog, ProductVariantImage } from "../types";
import { resolveImageUrl } from "../lib/images";

const cache = new Map<string, { until: number; promise: Promise<unknown> }>();
async function publicJson<T>(url: string, ttl = 30_000): Promise<T> {
  const stored = cache.get(url);
  if (stored && stored.until > Date.now()) return stored.promise as Promise<T>;
  const promise = fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok)
        throw new Error(`Public API returned ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      cache.delete(url);
      throw error;
    });
  cache.set(url, { until: Date.now() + ttl, promise });
  if (cache.size > 1000)
    for (const [key, value] of cache)
      if (value.until <= Date.now()) cache.delete(key);
  return promise as Promise<T>;
}

export async function serverCatalog(api: string): Promise<Catalog> {
  const [products, categories, variants, units, inventory] = await Promise.all([
    publicJson<Catalog["products"]>(`${api}/products`),
    publicJson<Catalog["categories"]>(`${api}/categories`),
    publicJson<Catalog["variants"]>(`${api}/product-variants/active`),
    publicJson<Catalog["units"]>(`${api}/units`),
    publicJson<Catalog["inventory"]>(`${api}/inventory/available`),
  ]);
  if (![products, categories, variants, units, inventory].every(Array.isArray))
    throw new Error("Invalid public catalog");
  const productIds = new Set(variants.map((item) => item.productId));
  return {
    products: products.filter((item) => productIds.has(item.id)),
    categories,
    variants,
    units,
    inventory,
  };
}

export async function serverImages(
  id: string,
  api: string,
  publicApi: string,
  origin: string,
): Promise<string[]> {
  const images = await publicJson<ProductVariantImage[]>(
    `${api}/product-variants/${encodeURIComponent(id)}/images`,
    60_000,
  );
  if (!Array.isArray(images)) throw new Error("Invalid product images");
  return images.flatMap((image) =>
    typeof image.imageUrl === "string"
      ? resolveImageUrl(image.imageUrl, publicApi, origin) || []
      : [],
  );
}
