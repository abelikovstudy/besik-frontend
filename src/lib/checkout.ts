import type { CartLine, OrderInput } from "../types";
import { quantityString } from "./catalog";

// Only the server supplies prices and totals. Pickup contacts travel in the note
// because the current contract forbids deliveryAddress for pickup orders.
export function orderInput(
  cart: CartLine[],
  method: OrderInput["deliveryMethod"],
  form: FormData,
): OrderInput {
  const value = (key: string) => String(form.get(key) || "").trim();
  const phone = value("phone");
  if (
    !value("name") ||
    !/^\+?[\d\s()-]+$/.test(phone) ||
    phone.replace(/\D/g, "").length < 7 ||
    phone.replace(/\D/g, "").length > 15
  ) {
    throw new Error("Укажите имя и корректный номер телефона.");
  }
  if (method === "delivery" && (!value("city") || !value("address"))) {
    throw new Error("Укажите город и адрес доставки.");
  }
  return {
    items: cart.map((line) => ({
      variantId: line.variantId,
      quantity: quantityString(line.quantity),
    })),
    deliveryMethod: method,
    ...(method === "delivery"
      ? {
          deliveryAddress: {
            city: value("city"),
            addressLine: value("address"),
            apartment: value("apartment") || undefined,
            recipientName: value("name"),
            recipientPhone: phone,
          },
        }
      : {}),
    customerNote: [
      method === "pickup"
        ? `Самовывоз. Получатель: ${value("name")}. Телефон: ${phone}.`
        : "",
      value("note"),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
