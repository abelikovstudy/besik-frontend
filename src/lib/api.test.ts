import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

const browser = Object.assign(new EventTarget(), {
  location: new URL("https://shop.example/"),
});
Object.defineProperty(globalThis, "window", {
  value: browser,
  configurable: true,
});
const {
  apiRequest,
  ApiError,
  login,
  logout,
  createOrder,
  loadCatalog,
  getAuthOptions,
  register,
  resendVerification,
  verifyEmail,
  startGoogleSignIn,
} = await import("./api");
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("all write methods send the session cookie and required CSRF header", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/api/resource");
      assert.equal(options?.credentials, "include");
      const headers = new Headers(options?.headers);
      assert.equal(headers.get("X-CSRF-Protection"), "1");
      assert.equal(headers.get("X-Custom"), "preserved");
      return new Response(null, { status: 204 });
    };
    assert.equal(
      await apiRequest("/resource", {
        method,
        headers: new Headers({ "X-Custom": "preserved" }),
      }),
      undefined,
    );
  }
});

test("guests load the catalog without calling authentication endpoints", async () => {
  const { demoCatalog } = await import("../data/demo");
  const responses = new Map<string, unknown>([
    ["/api/products", demoCatalog.products],
    ["/api/categories", demoCatalog.categories],
    ["/api/product-variants/active", demoCatalog.variants],
    ["/api/units", demoCatalog.units],
    ["/api/inventory/available", demoCatalog.inventory],
  ]);
  const requested: string[] = [];
  globalThis.fetch = async (url, options) => {
    const route = String(url);
    assert.ok(responses.has(route), route);
    assert.equal(new Headers(options?.headers).has("Authorization"), false);
    requested.push(route);
    return Response.json(responses.get(route));
  };
  assert.deepEqual(await loadCatalog(), demoCatalog);
  assert.equal(requested.length, responses.size);
});

test("login posts credentials only to /api/auth/login", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/auth/login");
    assert.equal(options?.credentials, "include");
    assert.equal(
      new Headers(options?.headers).get("Content-Type"),
      "application/json",
    );
    assert.equal(new Headers(options?.headers).get("X-CSRF-Protection"), "1");
    assert.deepEqual(JSON.parse(String(options?.body)), {
      username: "test-user",
      password: "test-password",
    });
    return Response.json({ expiresAt: "2026-10-16T12:00:00Z" });
  };
  assert.deepEqual(await login("test-user", "test-password"), {
    expiresAt: "2026-10-16T12:00:00Z",
  });
});

test("registration and email verification follow the backend contract without creating a session", async () => {
  const requests: Array<{ path: string; body: unknown }> = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.method, "POST");
    assert.equal(options.credentials, "include");
    assert.equal(new Headers(options.headers).get("X-CSRF-Protection"), "1");
    requests.push({
      path: String(url),
      body: JSON.parse(String(options.body)),
    });
    return Response.json({ emailVerificationRequired: true });
  };
  await register("shopper", "shopper@example.com", "long-test-password");
  await resendVerification("shopper@example.com");
  await verifyEmail("a".repeat(64));
  assert.deepEqual(requests, [
    {
      path: "/api/auth/register",
      body: {
        username: "shopper",
        email: "shopper@example.com",
        password: "long-test-password",
      },
    },
    {
      path: "/api/auth/resend-verification",
      body: { email: "shopper@example.com" },
    },
    { path: "/api/auth/verify-email", body: { token: "a".repeat(64) } },
  ]);
});

test("Google OAuth starts on the backend and provider options bypass the cache", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/auth/options");
    assert.equal(options?.cache, "no-store");
    return Response.json({ googleEnabled: true, emailEnabled: false });
  };
  assert.deepEqual(await getAuthOptions(), {
    googleEnabled: true,
    emailEnabled: false,
  });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/auth/google/start");
    assert.equal(options?.method, "POST");
    assert.equal(options.credentials, "include");
    assert.equal(new Headers(options.headers).get("X-CSRF-Protection"), "1");
    assert.equal(options.body, undefined);
    return Response.json({
      authorizationUrl:
        "https://accounts.google.com/o/oauth2/v2/auth?state=test",
    });
  };
  assert.match(
    (await startGoogleSignIn()).authorizationUrl,
    /^https:\/\/accounts.google.com\//,
  );
});

test("GET uses cookies and logout accepts an empty 204 response", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options?.credentials, "include");
    assert.equal(new Headers(options?.headers).has("X-CSRF-Protection"), false);
    return Response.json({ id: "root", username: "owner", role: "root" });
  };
  assert.equal((await apiRequest<{ role: string }>("/auth/me")).role, "root");
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await logout(), undefined);
});

test("expired sessions notify the UI, invalid login does not", async () => {
  let expired = 0;
  const listener = () => {
    expired++;
  };
  browser.addEventListener("besik-session-expired", listener);
  try {
    globalThis.fetch = async () =>
      Response.json({ message: "Unauthorized" }, { status: 401 });
    await assert.rejects(
      apiRequest("/products"),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
    assert.equal(expired, 1);
    await assert.rejects(login("bad", "bad"), /Проверьте логин и пароль/);
    assert.equal(expired, 1);
  } finally {
    browser.removeEventListener("besik-session-expired", listener);
  }
});

test("failed login requests never claim an order might have been created", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Network unavailable");
  };
  await assert.rejects(login("user", "password"), /Network unavailable/);
  await assert.rejects(
    apiRequest("/orders", { method: "POST" }),
    /Заказ мог быть создан/,
  );
});

test("customer and staff checkout use their own routes and preserve string quantities", async () => {
  const order = {
    items: [{ variantId: "9007199254740993", quantity: "1.125" }],
    deliveryMethod: "pickup" as const,
    customerNote: "test",
  };
  for (const role of ["user", "admin", "root"] as const) {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, role === "user" ? "/api/me/orders" : "/api/orders");
      assert.deepEqual(JSON.parse(String(options?.body)), order);
      return Response.json({ id: "9007199254740999" });
    };
    assert.equal(
      (await createOrder(order, { id: "account", username: "user", role })).id,
      "9007199254740999",
    );
  }
  assert.throws(() => createOrder(order, null), /Войдите снова/);
});
