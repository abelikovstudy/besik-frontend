import type { Catalog, Category, I18n, Product, Variant } from "../types";
import type { Language } from "./translations";

export const localized = (value: I18n | undefined, language: Language = "ru") =>
  value?.[language]?.trim() ||
  value?.ru?.trim() ||
  value?.en?.trim() ||
  value?.ka?.trim() ||
  "";
export const money = (
  value: number | string,
  currency = "GEL",
  language: Language = "ru",
) =>
  new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  })
    .format(Number(value))
    .replace("GEL", "₾");
export function countLabel(
  count: number,
  forms: [string, string, string],
  language: Language = "ru",
) {
  const rule = new Intl.PluralRules(language).select(count);
  return `${count} ${forms[rule === "one" ? 0 : rule === "few" ? 1 : 2]}`;
}
export const variantsOf = (catalog: Catalog, productId: string) =>
  catalog.variants.filter(
    (v) =>
      v.productId === productId &&
      v.isActive &&
      catalog.units.some((u) => u.id === v.unitId && u.isActive),
  );
export const stockOf = (catalog: Catalog, variantId: string) =>
  Math.max(
    0,
    Math.round(
      catalog.inventory
        .filter((i) => i.variantId === variantId)
        .reduce((sum, i) => sum + Number(i.availableQty), 0) * 1000,
    ) / 1000,
  );
export const stepOf = (catalog: Catalog, variant: Variant) =>
  catalog.units.find((u) => u.id === variant.unitId)?.allowsFraction ? 0.1 : 1;
export const maxQuantity = (catalog: Catalog, variant: Variant) =>
  Math.floor(
    (stockOf(catalog, variant.id) + 0.000001) / stepOf(catalog, variant),
  ) * stepOf(catalog, variant);
export const quantityString = (quantity: number) =>
  Number(quantity.toFixed(3)).toString();
export function categoryIds(
  categories: Category[],
  selected: string,
): Set<string> {
  const ids = new Set([selected]);
  let size = 0;
  while (size !== ids.size) {
    size = ids.size;
    categories.forEach((c) => {
      if (c.parentId && ids.has(c.parentId)) ids.add(c.id);
    });
  }
  return ids;
}
export function activeCategories(categories: Category[]) {
  const hidden = new Set<string>();
  categories
    .filter((c) => !c.isActive)
    .forEach((c) =>
      categoryIds(categories, c.id).forEach((id) => hidden.add(id)),
    );
  return categories.filter((c) => !hidden.has(c.id));
}
export function visibleProducts(catalog: Catalog) {
  const ids = new Set(activeCategories(catalog.categories).map((c) => c.id));
  return catalog.products.filter(
    (p) =>
      (!p.categoryId || ids.has(p.categoryId)) &&
      variantsOf(catalog, p.id).length > 0,
  );
}
export function filterProducts(
  catalog: Catalog,
  options: {
    query: string;
    category: string;
    sort: string;
    inStock: boolean;
    favorites?: string[];
    language?: Language;
  },
) {
  const ids = categoryIds(catalog.categories, options.category);
  const words = options.query
    .toLocaleLowerCase(options.language || "ru")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const result = visibleProducts(catalog).filter((p) => {
    const variants = variantsOf(catalog, p.id);
    const text = [
      ...Object.values(p.nameI18n),
      p.brandName,
      ...Object.values(p.descriptionI18n),
      ...variants.map((v) => v.sku),
    ]
      .join(" ")
      .toLocaleLowerCase(options.language || "ru");
    return (
      (!options.category || ids.has(p.categoryId || "")) &&
      words.every((word) => text.includes(word)) &&
      (!options.inStock ||
        variants.some((v) => maxQuantity(catalog, v) >= stepOf(catalog, v))) &&
      (!options.favorites || options.favorites.includes(p.id))
    );
  });
  const price = (p: Product) =>
    Math.min(...variantsOf(catalog, p.id).map((v) => Number(v.price)));
  return result.sort((a, b) =>
    options.sort === "price-asc"
      ? price(a) - price(b)
      : options.sort === "price-desc"
        ? price(b) - price(a)
        : options.sort === "name"
          ? localized(a.nameI18n, options.language).localeCompare(
              localized(b.nameI18n, options.language),
              options.language || "ru",
            )
          : Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}
export function variantProduct(product: Product, variant: Variant): Product {
  const nameI18n = { ...product.nameI18n };
  for (const language of ["ru", "en", "ka"] as const) {
    if (variant.nameI18n?.[language]?.trim())
      nameI18n[language] = variant.nameI18n[language];
  }
  return {
    ...product,
    nameI18n,
    attributes: { ...product.attributes, ...variant.attributes },
  };
}

export function filterVariantEntries(
  catalog: Catalog,
  options: Parameters<typeof filterProducts>[1],
) {
  const products = new Map(visibleProducts(catalog).map((p) => [p.id, p]));
  const ids = categoryIds(catalog.categories, options.category);
  const words = options.query
    .toLocaleLowerCase(options.language || "ru")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return catalog.variants
    .flatMap((variant) => {
      const source = products.get(variant.productId);
      if (
        !source ||
        !variant.isActive ||
        !catalog.units.some((u) => u.id === variant.unitId && u.isActive)
      )
        return [];
      const product = variantProduct(source, variant);
      const text = [
        ...Object.values(source.nameI18n),
        ...Object.values(product.nameI18n),
        ...Object.values(product.descriptionI18n),
        product.brandName,
        variant.sku,
      ]
        .join(" ")
        .toLocaleLowerCase(options.language || "ru");
      if (
        (options.category && !ids.has(product.categoryId || "")) ||
        !words.every((word) => text.includes(word)) ||
        (options.inStock &&
          maxQuantity(catalog, variant) < stepOf(catalog, variant)) ||
        (options.favorites && !options.favorites.includes(variant.id))
      )
        return [];
      return [{ product, variant }];
    })
    .sort((a, b) =>
      options.sort === "price-asc"
        ? Number(a.variant.price) - Number(b.variant.price)
        : options.sort === "price-desc"
          ? Number(b.variant.price) - Number(a.variant.price)
          : options.sort === "name"
            ? localized(a.product.nameI18n, options.language).localeCompare(
                localized(b.product.nameI18n, options.language),
                options.language || "ru",
              )
            : Date.parse(b.product.createdAt) - Date.parse(a.product.createdAt),
    );
}

export function productImage(
  product: Product,
  variant?: Variant,
): string | undefined {
  const image = variant?.attributes?.imageUrl || product.attributes?.imageUrl;
  if (typeof image !== "string") return undefined;
  try {
    const url = new URL(
      image,
      typeof window === "undefined"
        ? "http://image.local"
        : window.location.origin,
    );
    if (url.origin === "http://image.local")
      return `${url.pathname}${url.search}`;
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
