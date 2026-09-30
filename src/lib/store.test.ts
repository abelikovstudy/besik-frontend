import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveImageUrl } from "./images";

test("variant image URLs resolve against the API without duplicating its prefix", () => {
  const origin = "https://shop.example";
  assert.equal(
    resolveImageUrl("/images/a.jpg", "/api", origin),
    `${origin}/api/images/a.jpg`,
  );
  assert.equal(
    resolveImageUrl("images/a.jpg", "https://backend.example/api", origin),
    "https://backend.example/api/images/a.jpg",
  );
  assert.equal(
    resolveImageUrl("/api/images/a.jpg", "https://backend.example/api", origin),
    "https://backend.example/api/images/a.jpg",
  );
  assert.equal(
    resolveImageUrl("https://cdn.example/a.jpg", "/api", origin),
    "https://cdn.example/a.jpg",
  );
  assert.equal(
    resolveImageUrl("javascript:alert(1)", "/api", origin),
    undefined,
  );
  assert.equal(resolveImageUrl("", "/api", origin), undefined);
});
import { demoCatalog } from "../data/demo";
import { filterVariantEntries } from "./catalog";
import {
  activeCategories,
  categoryIds,
  filterProducts,
  maxQuantity,
  quantityString,
  stockOf,
  visibleProducts,
  localized,
  money,
  countLabel,
} from "./catalog";
import { cartDetails, validateCart } from "./cart";
import { orderInput } from "./checkout";
import { isLanguage, translate, translations } from "./translations";

const filters = { query: "", category: "", sort: "newest", inStock: false };
const copy = () => structuredClone(demoCatalog);

test("catalog shows separate variants and filters their own price, SKU and stock", () => {
  const data = copy();
  const first = filterVariantEntries(data, filters)[0];
  assert.ok(first);
  const variant = {
    ...first.variant,
    id: "extra-variant",
    sku: "UNIQUE-EXTRA-SKU",
    nameI18n: { ru: "Отдельный вариант", en: "" },
    price: "0.01",
  };
  data.variants.push(variant);
  const entries = filterVariantEntries(data, { ...filters, sort: "price-asc" });
  assert.equal(entries[0].variant.id, variant.id);
  assert.ok(entries.some((entry) => entry.variant.id === first.variant.id));
  assert.equal(entries[0].product.nameI18n.ru, "Отдельный вариант");
  assert.equal(
    entries[0].product.nameI18n.en,
    data.products.find((p) => p.id === variant.productId)!.nameI18n.en,
  );
  assert.equal(
    entries[0].product.descriptionI18n,
    first.product.descriptionI18n,
  );
  assert.deepEqual(
    filterVariantEntries(data, { ...filters, query: variant.sku }).map(
      (entry) => entry.variant.id,
    ),
    [variant.id],
  );
  assert.ok(
    !filterVariantEntries(data, { ...filters, inStock: true }).some(
      (entry) => entry.variant.id === variant.id,
    ),
  );
  assert.deepEqual(
    filterVariantEntries(data, { ...filters, favorites: [variant.id] }).map(
      (entry) => entry.variant.id,
    ),
    [variant.id],
  );
  variant.isActive = false;
  assert.ok(
    !filterVariantEntries(data, filters).some(
      (entry) => entry.variant.id === variant.id,
    ),
  );
});

test("localized content uses the selected language and a nonempty fallback", () => {
  assert.equal(
    localized({ ru: "Стул", en: "Chair", ka: "სკამი" }, "ka"),
    "სკამი",
  );
  assert.equal(localized({ ru: "Стул", en: "Chair" }, "en"), "Chair");
  assert.equal(localized({ ru: "Стул", ka: "  " }, "ka"), "Стул");
  assert.equal(localized({ en: "Chair" }, "ka"), "Chair");
  assert.equal(localized(undefined, "en"), "");
  assert.equal(isLanguage("ka"), true);
  assert.equal(isLanguage("unknown"), false);
});

test("search finds translated products and alphabetical sorting follows the selected language", () => {
  assert.equal(
    filterProducts(demoCatalog, {
      ...filters,
      query: "სავარძელი",
      language: "ka",
    })[0]?.id,
    "1",
  );
  assert.equal(
    filterProducts(demoCatalog, {
      ...filters,
      query: "armchair",
      language: "en",
    })[0]?.id,
    "1",
  );
  const data = copy();
  data.products = data.products.slice(0, 2);
  data.products[0].nameI18n = { ru: "Абрикос", en: "Zebra", ka: "ბალი" };
  data.products[1].nameI18n = { ru: "Яблоко", en: "Apple", ka: "ატამი" };
  assert.equal(
    filterProducts(data, { ...filters, sort: "name", language: "ru" })[0].id,
    "1",
  );
  assert.equal(
    filterProducts(data, { ...filters, sort: "name", language: "en" })[0].id,
    "2",
  );
  assert.equal(
    filterProducts(data, { ...filters, sort: "name", language: "ka" })[0].id,
    "2",
  );
});

test("translations preserve dynamic values and format prices and counts by locale", () => {
  assert.equal(
    translate("Заказ №{number} создан", "en", { number: "9007199254740993" }),
    "Order #9007199254740993 has been created",
  );
  assert.equal(
    translate("По запросу «{0}»", "en", { "0": "$& <script>" }),
    "Results for “$& <script>”",
  );
  assert.equal(countLabel(1, ["item", "items", "items"], "en"), "1 item");
  assert.equal(countLabel(2, ["товар", "товара", "товаров"], "ru"), "2 товара");
  assert.match(money("12.50", "GEL", "en"), /12\.50/);
  assert.match(money("12.50", "GEL", "ru"), /12,50/);
  for (const [source, values] of Object.entries(translations)) {
    for (const value of values) {
      assert.ok(value.trim(), `Empty translation: ${source}`);
      assert.equal(
        /[а-яё]/i.test(value),
        false,
        `Untranslated text: ${source}`,
      );
    }
  }
});

test("checkout keeps string quantities and omits address for pickup", () => {
  const form = new FormData();
  form.set("name", "  Test Customer  ");
  form.set("phone", "+995555000000");
  form.set("city", "Tbilisi");
  form.set("address", "Test Street 1");
  form.set("note", "Test note");
  const cart = [{ variantId: "9007199254740993", quantity: 1.5 }];
  const pickup = orderInput(cart, "pickup", form);
  assert.equal("deliveryAddress" in pickup, false);
  assert.equal("price" in pickup.items[0], false);
  assert.equal(pickup.items[0].quantity, "1.5");
  assert.match(pickup.customerNote, /Test Customer/);
  const delivery = orderInput(cart, "delivery", form);
  assert.equal(delivery.deliveryAddress?.recipientName, "Test Customer");
  assert.equal(delivery.deliveryAddress?.addressLine, "Test Street 1");
  form.set("phone", "-------");
  assert.throws(() => orderInput(cart, "pickup", form), /телефона/);
  form.set("phone", "+995555000000");
  form.set("address", "   ");
  assert.throws(() => orderInput(cart, "delivery", form), /адрес/);
});

test("cart rejects a deactivated unit even if another variant keeps the product visible", () => {
  const data = copy();
  data.units.push({ ...data.units[0], id: "2", isActive: false });
  data.variants.push({ ...data.variants[0], id: "99", unitId: "2" });
  data.inventory.push({ variantId: "99", availableQty: "10" });
  assert.ok(validateCart(data, [{ variantId: "99", quantity: 1 }]));
});

test("search matches names, brand and SKU without case sensitivity", () => {
  assert.equal(
    filterProducts(demoCatalog, { ...filters, query: " lounge NORD " })[0]?.id,
    "1",
  );
  assert.equal(
    filterProducts(demoCatalog, { ...filters, query: "bsk-006" })[0]?.id,
    "6",
  );
  assert.equal(
    filterProducts(demoCatalog, { ...filters, query: "неизвестный товар" })
      .length,
    0,
  );
});
test("category includes descendants and handles cyclic input safely", () => {
  const data = copy();
  data.categories[1].parentId = "1";
  data.categories[0].parentId = "2";
  assert.deepEqual([...categoryIds(data.categories, "1")], ["1", "2"]);
  assert.equal(filterProducts(data, { ...filters, category: "1" }).length, 3);
});
test("inactive branches and variants never appear in the catalog", () => {
  const data = copy();
  data.categories[1].parentId = "1";
  data.categories[0].isActive = false;
  data.variants[3].isActive = false;
  assert.equal(activeCategories(data.categories).length, 3);
  assert.deepEqual(
    visibleProducts(data).map((p) => p.id),
    ["2", "3", "6", "8"],
  );
});

test("draft products retain their active variants in the catalog and cart", () => {
  const data = copy();
  const entry = filterVariantEntries(data, filters)[0];
  data.products.find((p) => p.id === entry.product.id)!.status = "draft";
  assert.ok(
    filterVariantEntries(data, filters).some(
      (item) => item.variant.id === entry.variant.id,
    ),
  );
  const line = cartDetails(data, [
    { variantId: entry.variant.id, quantity: 1 },
  ])[0];
  assert.equal(line.variant?.id, entry.variant.id);
  assert.equal(line.product?.status, "draft");
});
test("sorting is numeric and stock and favorites filters compose", () => {
  assert.equal(
    filterProducts(demoCatalog, { ...filters, sort: "price-asc" })[0].id,
    "6",
  );
  assert.equal(
    filterProducts(demoCatalog, { ...filters, sort: "price-desc" })[0].id,
    "1",
  );
  assert.deepEqual(
    filterProducts(demoCatalog, {
      ...filters,
      inStock: true,
      favorites: ["1", "8"],
    }).map((p) => p.id),
    ["1"],
  );
});
test("fractional inventory is summed across warehouses and quantities stay precise", () => {
  const data = copy();
  data.units[0].allowsFraction = true;
  data.inventory = [
    { variantId: "1", availableQty: "0.1" },
    { variantId: "1", availableQty: "0.2" },
  ];
  assert.equal(stockOf(data, "1"), 0.3);
  assert.equal(quantityString(maxQuantity(data, data.variants[0])), "0.3");
  assert.equal(quantityString(0.1 + 0.2), "0.3");
  assert.equal(
    validateCart(data, [{ variantId: "1", quantity: 0.3 }]),
    undefined,
  );
  assert.ok(validateCart(data, [{ variantId: "1", quantity: 0.4 }]));
});
test("cart rejects missing variants, out-of-stock items and fractional piece counts", () => {
  assert.ok(validateCart(demoCatalog, [{ variantId: "999", quantity: 1 }]));
  assert.ok(validateCart(demoCatalog, [{ variantId: "8", quantity: 1 }]));
  assert.ok(validateCart(demoCatalog, [{ variantId: "1", quantity: 0.5 }]));
  assert.ok(validateCart(demoCatalog, []));
});
test("mixed currencies cannot be submitted as a single order", () => {
  const data = copy();
  data.variants[1].currency = "USD";
  assert.match(
    validateCart(data, [
      { variantId: "1", quantity: 1 },
      { variantId: "2", quantity: 1 },
    ])!,
    /валютах/,
  );
});
test("line totals round to currency precision and retain bigint IDs", () => {
  const data = copy();
  data.variants[0].id = "9007199254740993";
  data.variants[0].price = "12.55";
  data.units[0].allowsFraction = true;
  data.inventory = [{ variantId: "9007199254740993", availableQty: "3" }];
  const [line] = cartDetails(data, [
    { variantId: "9007199254740993", quantity: 1.5 },
  ]);
  assert.equal(line.total, 18.83);
  assert.equal(line.variantId, "9007199254740993");
  assert.equal(line.error, "");
});
