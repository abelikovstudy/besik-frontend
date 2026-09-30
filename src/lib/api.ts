import type { Catalog, Order, OrderInput, ProductVariantImage } from "../types";
import { resolveImageUrl } from "./images";

const baseUrl = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
export const demoMode =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  new URLSearchParams(window.location.search).get("demo") === "1";

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(15000);
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      signal: options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout,
    });
  } catch (error) {
    if (options.method === "POST")
      throw new Error(
        "Ответ магазина не получен. Заказ мог быть создан. Уточните его статус у магазина, прежде чем отправлять повторно.",
      );
    throw error;
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const message = error?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(". ")
        : typeof message === "string"
          ? message
          : "Сервис временно недоступен. Попробуйте ещё раз.",
    );
  }
  return response.json();
}
export async function loadCatalog(signal?: AbortSignal): Promise<Catalog> {
  if (demoMode) return (await import("../data/demo")).demoCatalog;
  const [products, categories, variants, units, inventory] = await Promise.all([
    apiRequest<Catalog["products"]>("/products", { signal }),
    apiRequest<Catalog["categories"]>("/categories", { signal }),
    apiRequest<Catalog["variants"]>("/product-variants/active", { signal }),
    apiRequest<Catalog["units"]>("/units", { signal }),
    apiRequest<Catalog["inventory"]>("/inventory/available", { signal }),
  ]);
  if (![products, categories, variants, units, inventory].every(Array.isArray))
    throw new Error(
      "Не удалось прочитать каталог магазина. Попробуйте позднее.",
    );
  return { products, categories, variants, units, inventory };
}
export const createOrder = (order: OrderInput) => {
  if (demoMode) throw new Error("В деморежиме заказы не отправляются.");
  return apiRequest<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(order),
  });
};

// Share requests between the catalog, product dialog and cart. Failed requests
// are evicted so opening the product again can retry them.
const imageRequests = new Map<
  string,
  { expires: number; request: Promise<string[]> }
>();
export function loadVariantImages(id: string): Promise<string[]> {
  if (demoMode) return Promise.resolve([]);
  const cached = imageRequests.get(id);
  if (cached && cached.expires > Date.now()) return cached.request;
  const request = apiRequest<ProductVariantImage[]>(
    `/product-variants/${encodeURIComponent(id)}/images`,
  )
    .then((data) => {
      if (!Array.isArray(data)) throw new Error("Invalid variant image list");
      return data.flatMap((image) => {
        const url =
          typeof image?.imageUrl === "string"
            ? resolveImageUrl(image.imageUrl, baseUrl, window.location.origin)
            : undefined;
        return url ? [url] : [];
      });
    })
    .catch((error) => {
      imageRequests.delete(id);
      throw error;
    });
  imageRequests.set(id, { expires: Date.now() + 60_000, request });
  return request;
}
