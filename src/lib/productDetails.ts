import type { Product, Variant } from "../types";
import { isLanguage, type Language } from "./translations";
import { localized } from "./catalog";

export function productAttributes(
  product: Product,
  variant: Variant,
  language: Language,
) {
  const format = (value: unknown): string => {
    if (value == null) return "";
    if (Array.isArray(value))
      return value.map(format).filter(Boolean).join(", ");
    if (typeof value === "object") {
      const entries = Object.entries(value);
      const names = entries.filter(
        ([key, item]) => isLanguage(key) && typeof item === "string",
      );
      if (names.length) return localized(Object.fromEntries(names), language);
      return entries.map(([key, item]) => `${key}: ${format(item)}`).join("; ");
    }
    return String(value);
  };
  return Object.entries({ ...product.attributes, ...variant.attributes })
    .filter(([key]) => !["imageUrl", "images"].includes(key))
    .map(([key, value]) => {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "valueI18n" in value
      ) {
        const translatedKey = "keyI18n" in value ? format(value.keyI18n) : "";
        return { name: translatedKey || key, value: format(value.valueI18n) };
      }
      return { name: key, value: format(value) };
    })
    .filter((item) => item.value.trim());
}
