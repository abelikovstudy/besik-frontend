import { test } from "node:test";
import assert from "node:assert/strict";
import { authPageUrl, safeReturnTo } from "./auth";

const location = new URL("https://shop.example/?q=lamp&category=5#catalog");
Object.defineProperty(globalThis, "window", {
  value: { location },
  configurable: true,
});

test("auth return links preserve catalog filters and optionally reopen the cart", () => {
  const target = "/?q=lamp&category=5#catalog";
  assert.equal(safeReturnTo(target), target);
  assert.equal(safeReturnTo(`https://shop.example${target}`), target);
  assert.equal(new URL(authPageUrl(), location).pathname, "/auth");
  assert.equal(
    new URL(authPageUrl(), location).searchParams.get("returnTo"),
    target,
  );
  const checkout = new URL(
    new URL(authPageUrl(true), location).searchParams.get("returnTo")!,
    location,
  );
  assert.equal(checkout.searchParams.get("cart"), "1");
  assert.equal(checkout.searchParams.get("q"), "lamp");
  assert.equal(checkout.hash, "#catalog");
});

test("return links cannot leave the storefront or create an auth redirect loop", () => {
  for (const target of [
    null,
    "https://other.example/",
    "//other.example/",
    "/\\other.example/",
    "javascript:alert(1)",
    "/auth",
    "/verify-email?token=secret",
    "/api/auth/logout",
    "https://shop.example.other.example/",
    "http://shop.example/",
    "http://[",
  ])
    assert.equal(safeReturnTo(target), "/", String(target));
});

test("authentication can return to a product page while preserving language and cart", () => {
  assert.equal(
    safeReturnTo("/products/item/9007199254740993?lang=en"),
    "/products/item/9007199254740993?lang=en",
  );
  const link = new URL(
    authPageUrl(true, "https://shop.example/products/item/4?lang=ka"),
    location,
  );
  assert.equal(link.searchParams.get("lang"), "ka");
  assert.equal(
    link.searchParams.get("returnTo"),
    "/products/item/4?lang=ka&cart=1",
  );
});
