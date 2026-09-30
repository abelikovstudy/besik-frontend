import { useLanguage } from "../hooks/useLanguage";
import { useState } from "react";
import { Check, Heart, ShoppingBag } from "lucide-react";
import type { Catalog, Product, Variant } from "../types";
import { maxQuantity, stepOf } from "../lib/catalog";
import { Dialog } from "./Dialog";
import { ProductImage } from "./ProductCard";
export function ProductDialog({
  product,
  variant,
  catalog,
  onClose,
  onAdd,
  favorite,
  onFavorite,
}: {
  product: Product;
  variant: Variant;
  catalog: Catalog;
  onClose: () => void;
  onAdd: (variant: Variant) => boolean;
  favorite: boolean;
  onFavorite: () => void;
}) {
  const { t, localized, money, language } = useLanguage();
  const [feedback, setFeedback] = useState("");
  const available = maxQuantity(catalog, variant) >= stepOf(catalog, variant);
  const unit = catalog.units.find((u) => u.id === variant.unitId);
  const attributes = Object.entries({
    ...product.attributes,
    ...variant.attributes,
  }).filter(
    ([key, value]) =>
      !["imageUrl", "images"].includes(key) &&
      ["string", "number", "boolean"].includes(typeof value),
  );
  return (
    <Dialog title={localized(product.nameI18n)} onClose={onClose} wide>
      <div className="product-detail">
        <ProductImage
          product={product}
          variant={variant}
          className="detail-image"
          gallery
        />
        <div className="detail-copy">
          <span className="eyebrow">
            {product.brandName || "Shop collection"}
          </span>
          <p className="detail-description">
            {localized(product.descriptionI18n) ||
              t("Детали, которые находят своё место в вашем доме.")}
          </p>
          <div className="detail-price">
            {money(variant.price, variant.currency)}{" "}
            <small>/ {localized(unit?.symbolI18n) || t("шт.")}</small>
          </div>
          <p className={`stock ${available ? "" : "unavailable"}`}>
            <Check size={15} />
            {available ? t("В наличии") : t("Пока нет в наличии")}
          </p>
          <div className="detail-actions">
            <button
              className="button primary"
              disabled={!available}
              onClick={() =>
                setFeedback(
                  onAdd(variant)
                    ? t("Добавлено в корзину")
                    : t("Доступное количество уже в корзине"),
                )
              }
            >
              <ShoppingBag size={18} />
              {t("В корзину")}
            </button>
            <button
              className="button secondary"
              aria-label={t("Избранное")}
              aria-pressed={favorite}
              onClick={onFavorite}
            >
              <Heart size={19} fill={favorite ? "currentColor" : "none"} />
            </button>
          </div>
          {feedback && (
            <p className="stock" role="status">
              <Check size={15} />
              {feedback}
            </p>
          )}
          {unit?.allowsFraction && (
            <p className="muted">
              {t(
                "Добавляется по {step} {unit}. Количество можно изменить в корзине.",
                {
                  step: new Intl.NumberFormat(language).format(0.1),
                  unit: localized(unit.symbolI18n),
                },
              )}
            </p>
          )}
          <dl className="attributes">
            <div>
              <dt>{t("Артикул")}</dt>
              <dd>{variant.sku}</dd>
            </div>
            {attributes.map(([key, value]) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd>{t(String(value))}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Dialog>
  );
}
