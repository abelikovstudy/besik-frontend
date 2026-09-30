import type { CartLine, Catalog } from "../types";
import {
  maxQuantity,
  stepOf,
  visibleProducts,
  variantProduct,
} from "./catalog";

export function cartDetails(catalog: Catalog, cart: CartLine[]) {
  const products = visibleProducts(catalog);
  return cart.map((line) => {
    const variant = catalog.variants.find(
      (v) => v.id === line.variantId && v.isActive,
    );
    const product = variant && products.find((p) => p.id === variant.productId);
    if (
      !variant ||
      !product ||
      !catalog.units.some((unit) => unit.id === variant.unitId && unit.isActive)
    )
      return {
        ...line,
        variant: undefined,
        product: undefined,
        error: "Товар больше недоступен",
        total: 0,
      };
    const max = maxQuantity(catalog, variant);
    const step = stepOf(catalog, variant);
    const error =
      line.quantity > max
        ? "Количество превышает остаток"
        : line.quantity < step ||
            Math.abs(line.quantity / step - Math.round(line.quantity / step)) >
              0.00001
          ? "Проверьте количество"
          : "";
    return {
      ...line,
      variant,
      product: variantProduct(product, variant),
      error,
      total: Math.round(Number(variant.price) * 100 * line.quantity) / 100,
    };
  });
}
export function validateCart(
  catalog: Catalog,
  cart: CartLine[],
): string | undefined {
  if (!cart.length) return "Добавьте товары в корзину.";
  const details = cartDetails(catalog, cart);
  if (details.some((line) => line.error))
    return "Наличие товаров изменилось. Проверьте корзину перед оформлением.";
  if (new Set(details.map((line) => line.variant!.currency)).size > 1)
    return "Товары в разных валютах нужно оформить отдельными заказами.";
}
