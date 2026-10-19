import { useState } from "react";
import { ArrowLeft, Check, Heart, ShoppingBag } from "lucide-react";
import type { Catalog, Product, Variant } from "../types";
import { useLanguage } from "../hooks/useLanguage";
import { maxQuantity, stepOf } from "../lib/catalog";
import { localizedUrl, productUrl } from "../lib/routes";
import { productAttributes } from "../lib/productDetails";
import { ProductImage } from "./ProductCard";
import { demoMode } from "../lib/api";

export function ProductPage({
  product,
  variant,
  catalog,
  favorite,
  onFavorite,
  onAdd,
}: {
  product: Product;
  variant: Variant;
  catalog: Catalog;
  favorite: boolean;
  onFavorite: () => void;
  onAdd: (variant: Variant) => boolean;
}) {
  const { t, language, localized, money } = useLanguage();
  const [feedback, setFeedback] = useState("");
  const available = maxQuantity(catalog, variant) >= stepOf(catalog, variant);
  const category = catalog.categories.find(
    (item) => item.id === product.categoryId,
  );
  const unit = catalog.units.find((item) => item.id === variant.unitId);
  const attributes = productAttributes(product, variant, language);
  const variants = catalog.variants.filter(
    (item) =>
      item.productId === product.id &&
      item.isActive &&
      catalog.units.some((u) => u.id === item.unitId && u.isActive),
  );
  return (
    <article className="product-page container" id="product-content">
      <nav className="breadcrumbs" aria-label={t("Навигация по сайту")}>
        <a href={localizedUrl("/#catalog", language)}>{t("Все товары")}</a>
        {category && (
          <>
            <span aria-hidden="true">/</span>
            <a
              href={localizedUrl(
                `/?category=${encodeURIComponent(category.id)}#catalog`,
                language,
              )}
            >
              {localized(category.nameI18n)}
            </a>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{localized(product.nameI18n)}</span>
      </nav>
      <h1>{localized(product.nameI18n)}</h1>
      <div className="product-detail">
        <ProductImage
          product={product}
          variant={variant}
          className="detail-image"
          gallery
          priority
        />
        <div className="detail-copy">
          {product.brandName && (
            <span className="eyebrow">{product.brandName}</span>
          )}
          <div className="detail-price">
            {money(variant.price, variant.currency)}{" "}
            <small>/ {localized(unit?.symbolI18n) || t("шт.")}</small>
          </div>
          <p className={`stock ${available ? "" : "unavailable"}`}>
            <Check size={15} />
            {t(available ? "В наличии" : "Пока нет в наличии")}
          </p>
          <p className="muted">
            {t("Артикул")}: {variant.sku}
          </p>
          <div className="detail-actions">
            <button
              className="button primary"
              disabled={!available}
              onClick={() =>
                setFeedback(
                  t(
                    onAdd(variant)
                      ? "Добавлено в корзину"
                      : "Доступное количество уже в корзине",
                  ),
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
          {variants.length > 1 && (
            <nav className="product-variants" aria-label={t("Варианты товара")}>
              <h2>{t("Варианты товара")}</h2>
              {variants.map((item) => (
                <a
                  key={item.id}
                  className={item.id === variant.id ? "selected" : ""}
                  aria-current={item.id === variant.id ? "page" : undefined}
                  href={productUrl(product, item, language, demoMode)}
                >
                  {localized(item.nameI18n) || item.sku}
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>
      <div className="product-information">
        <section aria-labelledby="product-description">
          <h2 id="product-description">{t("Описание")}</h2>
          <p className="detail-description">
            {localized(product.descriptionI18n) ||
              t("Описание пока не добавлено.")}
          </p>
        </section>
        <section aria-labelledby="product-attributes">
          <h2 id="product-attributes">{t("Характеристики")}</h2>
          <dl className="attributes">
            <div>
              <dt>{t("Артикул")}</dt>
              <dd>{variant.sku}</dd>
            </div>
            {product.brandName && (
              <div>
                <dt>{t("Бренд")}</dt>
                <dd>{product.brandName}</dd>
              </div>
            )}
            {attributes.map((item) => (
              <div key={item.name}>
                <dt>{t(item.name)}</dt>
                <dd>{t(item.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <a className="text-button" href={localizedUrl("/#catalog", language)}>
        <ArrowLeft size={17} />
        {t("Вернуться в каталог")}
      </a>
    </article>
  );
}
