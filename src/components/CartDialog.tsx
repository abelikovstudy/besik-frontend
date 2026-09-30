import { useLanguage } from "../hooks/useLanguage";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import type { CartLine, Catalog, Order } from "../types";
import { createOrder, demoMode, loadCatalog } from "../lib/api";
import { cartDetails, validateCart } from "../lib/cart";
import { orderInput } from "../lib/checkout";
import { maxQuantity, quantityString, stepOf } from "../lib/catalog";
import { Dialog } from "./Dialog";
import { ProductImage } from "./ProductCard";
export function CartDialog({
  cart,
  catalog,
  setCart,
  setCatalog,
  onClose,
}: {
  cart: CartLine[];
  catalog: Catalog;
  setCart: (cart: CartLine[]) => void;
  setCatalog: (catalog: Catalog) => void;
  onClose: () => void;
}) {
  const { t, localized, money } = useLanguage();
  const [checkout, setCheckout] = useState(false);
  const [method, setMethod] = useState<"delivery" | "pickup">("delivery");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const lines = cartDetails(catalog, cart);
  const totals = lines.reduce<Record<string, number>>((sums, line) => {
    if (line.variant)
      sums[line.variant.currency] =
        Math.round(((sums[line.variant.currency] || 0) + line.total) * 100) /
        100;
    return sums;
  }, {});
  const validation = validateCart(catalog, cart);
  const update = (id: string, quantity: number) => {
    setError("");
    setCart(
      cart.map((line) =>
        line.variantId === id
          ? { ...line, quantity: Number(quantity.toFixed(3)) }
          : line,
      ),
    );
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || demoMode) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const input = orderInput(cart, method, form);
      const fresh = await loadCatalog();
      setCatalog(fresh);
      const issue = validateCart(fresh, cart);
      if (issue) {
        setCheckout(false);
        throw new Error(issue);
      }
      const updated = cartDetails(fresh, cart);
      if (
        updated.some(
          (line, i) =>
            line.variant?.price !== lines[i].variant?.price ||
            line.variant?.currency !== lines[i].variant?.currency,
        )
      ) {
        setCheckout(false);
        throw new Error(
          t(
            "Цены изменились. Проверьте обновлённую сумму и продолжите оформление.",
          ),
        );
      }
      const result = await createOrder(input);
      setOrder(result);
      setCart([]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("Не удалось отправить заказ."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        order
          ? t("Спасибо за заказ")
          : checkout
            ? t("Оформление заказа")
            : t("Ваша корзина")
      }
      onClose={onClose}
      busy={busy}
    >
      {order ? (
        <div className="order-success">
          <span className="success-icon">
            <Check size={32} />
          </span>
          <h3>{t("Заказ №{number} создан", { number: order.orderNumber })}</h3>
          <p>{t("Сохраните номер заказа. Оплата ещё не произведена.")}</p>
          <dl className="attributes">
            <div>
              <dt>{t("Товары и доставка")}</dt>
              <dd>{money(order.grandTotal, order.currency)}</dd>
            </div>
            <div>
              <dt>{t("В том числе доставка")}</dt>
              <dd>{money(order.deliveryTotal, order.currency)}</dd>
            </div>
          </dl>
          <button className="button primary full" onClick={onClose}>
            {t("Продолжить покупки")}
          </button>
        </div>
      ) : !cart.length ? (
        <div className="empty-state">
          <ShoppingBag size={40} strokeWidth={1} />
          <h3>{t("Здесь пока пусто")}</h3>
          <p>{t("Найдите вещи, с которыми вам будет хорошо.")}</p>
          <button className="button primary" onClick={onClose}>
            {t("За покупками")}
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          {!checkout ? (
            <div className="cart-lines">
              {lines.map((line) => (
                <div className="cart-line" key={line.variantId}>
                  {line.product && (
                    <ProductImage
                      product={line.product}
                      variant={line.variant}
                    />
                  )}
                  <div className="cart-line-copy">
                    <strong>
                      {line.product
                        ? localized(line.product.nameI18n)
                        : t("Недоступный товар")}
                    </strong>
                    <span className="muted">
                      {line.variant && localized(line.variant.nameI18n)}
                    </span>
                    {line.variant && (
                      <>
                        <span>{money(line.total, line.variant.currency)}</span>
                        <div className="quantity-control">
                          <button
                            aria-label={t("Уменьшить количество")}
                            disabled={
                              line.quantity <= stepOf(catalog, line.variant)
                            }
                            onClick={() =>
                              update(
                                line.variantId,
                                line.quantity - stepOf(catalog, line.variant!),
                              )
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <span>{quantityString(line.quantity)}</span>
                          <button
                            aria-label={t("Увеличить количество")}
                            disabled={
                              line.quantity + stepOf(catalog, line.variant) >
                              maxQuantity(catalog, line.variant) + 0.00001
                            }
                            onClick={() =>
                              update(
                                line.variantId,
                                line.quantity + stepOf(catalog, line.variant!),
                              )
                            }
                          >
                            <Plus size={14} />
                          </button>
                          <small>
                            {localized(
                              catalog.units.find(
                                (u) => u.id === line.variant!.unitId,
                              )?.symbolI18n,
                            )}
                          </small>
                        </div>
                      </>
                    )}
                    {line.error && (
                      <p className="error-text">{t(line.error)}</p>
                    )}
                  </div>
                  <button
                    className="icon-button"
                    aria-label={t("Удалить {0}", {
                      "0": line.product
                        ? localized(line.product.nameI18n)
                        : t("товар"),
                    })}
                    onClick={() =>
                      setCart(
                        cart.filter(
                          (item) => item.variantId !== line.variantId,
                        ),
                      )
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <button
              className="text-button back-button"
              onClick={() => setCheckout(false)}
              disabled={busy}
            >
              <ArrowLeft size={16} />
              {t("Вернуться в корзину")}
            </button>
          )}
          <div className="cart-summary">
            <span>{t("Сумма товаров")}</span>
            <strong>
              {Object.entries(totals)
                .map(([currency, amount]) => money(amount, currency))
                .join(" + ")}
            </strong>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {t(error)}
            </p>
          )}
          {validation && <p className="form-error">{t(validation)}</p>}
          {demoMode && (
            <p className="demo-explanation">
              {t(
                "Вы смотрите демонстрационный каталог. Оформление заказа станет доступно при подключении магазина.",
              )}
            </p>
          )}
          {!checkout ? (
            <>
              <p className="muted">
                {t(
                  "Самовывоз — бесплатно. Стоимость доставки рассчитывается магазином при создании заказа.",
                )}
              </p>
              <button
                className="button primary full"
                disabled={Boolean(validation) || demoMode}
                onClick={() => setCheckout(true)}
              >
                {t("Перейти к оформлению")}
                <ArrowRight size={17} />
              </button>
            </>
          ) : (
            <form onSubmit={submit} className="checkout-form">
              <fieldset disabled={busy}>
                <legend className="sr-only">
                  {t("Контактные данные и доставка")}
                </legend>
                <div className="delivery-options">
                  <label>
                    <input
                      type="radio"
                      name="method"
                      checked={method === "delivery"}
                      onChange={() => setMethod("delivery")}
                    />
                    {t("Доставка")}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="method"
                      checked={method === "pickup"}
                      onChange={() => setMethod("pickup")}
                    />
                    {t("Самовывоз · бесплатно")}
                  </label>
                </div>
                <label className="field">
                  {t("Ваше имя")}
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={100}
                  />
                </label>
                <label className="field">
                  {t("Номер телефона")}
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+995"
                    required
                    maxLength={20}
                  />
                </label>
                {method === "delivery" && (
                  <>
                    <label className="field">
                      {t("Город")}
                      <input
                        name="city"
                        autoComplete="address-level2"
                        defaultValue={t("Тбилиси")}
                        required
                        maxLength={100}
                      />
                    </label>
                    <label className="field">
                      {t("Улица и дом")}
                      <input
                        name="address"
                        autoComplete="address-line1"
                        required
                        maxLength={250}
                      />
                    </label>
                    <label className="field">
                      {t("Квартира / офис")}
                      <input
                        name="apartment"
                        autoComplete="address-line2"
                        maxLength={50}
                      />
                    </label>
                  </>
                )}
                <label className="field">
                  {t("Комментарий")}
                  <span className="muted">{t("(необязательно)")}</span>
                  <textarea name="note" rows={2} maxLength={1000} />
                </label>
                <p className="muted">
                  {method === "delivery"
                    ? t(
                        "Стоимость доставки добавит магазин. Итоговая сумма появится после создания заказа.",
                      )
                    : t(
                        "Адрес и время самовывоза необходимо согласовать с магазином.",
                      )}{" "}
                  {t("Онлайн-оплата на этом этапе не требуется.")}
                </p>
                <button
                  className="button primary full"
                  type="submit"
                  disabled={busy || Boolean(validation)}
                >
                  {busy ? t("Создаём заказ…") : t("Создать заказ")}
                  {!busy && <ArrowRight size={16} />}
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
    </Dialog>
  );
}
