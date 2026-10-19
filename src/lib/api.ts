import type {
  Catalog,
  Order,
  OrderInput,
  ProductVariantImage,
  SessionUser,
} from "../types";
import { resolveImageUrl } from "./images";

const baseUrl = (import.meta.env?.VITE_API_URL || "/api").replace(/\/+$/, "");
export const demoMode =
  import.meta.env?.VITE_DEMO_MODE === "true" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "1");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method))
    headers.set("X-CSRF-Protection", "1");
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(15000);
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      method,
      credentials: "include",
      headers,
      signal: options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout,
    });
  } catch (error) {
    if (method === "POST" && ["/orders", "/me/orders"].includes(path))
      throw new Error(
        "Ответ магазина не получен. Заказ мог быть создан. Уточните его статус у магазина, прежде чем отправлять повторно.",
      );
    throw error;
  }
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login")
      window.dispatchEvent(new Event("besik-session-expired"));
    const error = await response.json().catch(() => null);
    const message = error?.message;
    throw new ApiError(
      response.status === 401
        ? path === "/auth/login"
          ? "Не удалось войти. Проверьте логин и пароль."
          : "Сессия завершена. Войдите снова."
        : Array.isArray(message)
          ? message.join(". ")
          : typeof message === "string"
            ? message
            : "Сервис временно недоступен. Попробуйте ещё раз.",
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const getSession = (signal?: AbortSignal) =>
  apiRequest<SessionUser>("/auth/me", { cache: "no-store", signal });
export const login = (username: string, password: string) =>
  apiRequest<{ expiresAt: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
export const logout = () =>
  apiRequest<void>("/auth/logout", { method: "POST" });
export const getAuthOptions = (signal?: AbortSignal) =>
  apiRequest<{ googleEnabled: boolean; emailEnabled: boolean }>(
    "/auth/options",
    {
      cache: "no-store",
      signal,
    },
  );
export const register = (username: string, email: string, password: string) =>
  apiRequest<{ emailVerificationRequired: true }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
export const resendVerification = (email: string) =>
  apiRequest<{ message: string }>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
export const verifyEmail = (token: string) =>
  apiRequest<{ emailVerified: true }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
export const startGoogleSignIn = () =>
  apiRequest<{ authorizationUrl: string }>("/auth/google/start", {
    method: "POST",
  });
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
export const createOrder = (order: OrderInput, user: SessionUser | null) => {
  if (demoMode) throw new Error("В деморежиме заказы не отправляются.");
  if (!user) throw new Error("Сессия завершена. Войдите снова.");
  return apiRequest<Order>(user.role === "user" ? "/me/orders" : "/orders", {
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
