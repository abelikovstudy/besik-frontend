import { useLanguage } from "../hooks/useLanguage";
import { Heart, Plus, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { loadVariantImages } from "../lib/api";
import type { Catalog, Product, Variant } from "../types";
import { maxQuantity, productImage, stepOf } from "../lib/catalog";
export function ProductImage({
  product,
  variant,
  className = "",
  gallery = false,
}: {
  product: Product;
  variant?: Variant;
  className?: string;
  gallery?: boolean;
}) {
  const { t, localized } = useLanguage();
  const [images, setImages] = useState<{ id: string; urls: string[] }>();
  const [selected, setSelected] = useState<string>();
  const [failed, setFailed] = useState<string[]>([]);
  const variantId = variant?.id;
  useEffect(() => {
    let active = true;
    setSelected(undefined);
    setFailed([]);
    if (variantId) {
      loadVariantImages(variantId).then(
        (urls) => {
          if (active) setImages({ id: variantId, urls });
        },
        () => {
          if (active) setImages({ id: variantId, urls: [] });
        },
      );
    }
    return () => {
      active = false;
    };
  }, [variantId]);
  const urls = images?.id === variantId ? images?.urls || [] : [];
  const fallback = productImage(product, variant);
  const available = (urls.length ? urls : fallback ? [fallback] : []).filter(
    (url) => !failed.includes(url),
  );
  const src =
    selected && available.includes(selected) ? selected : available[0];
  const image = src ? (
    <img
      className={className}
      src={src}
      alt={localized(product.nameI18n)}
      loading="lazy"
      onError={() => setFailed((previous) => [...previous, src])}
    />
  ) : (
    <div className={`image-placeholder ${className}`}>
      <Package size={48} strokeWidth={1} />
      <span>{t("Фото скоро появится")}</span>
    </div>
  );
  return gallery ? (
    <div className="product-gallery">
      {image}
      {available.length > 1 && (
        <div className="image-thumbnails">
          {available.map((url, index) => (
            <button
              key={url}
              type="button"
              aria-label={`${localized(product.nameI18n)} — ${index + 1}`}
              aria-pressed={url === src}
              onClick={() => setSelected(url)}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                onError={() => setFailed((previous) => [...previous, url])}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  ) : (
    image
  );
}
export function ProductCard({
  product,
  variant,
  catalog,
  favorite,
  onFavorite,
  onOpen,
  onAdd,
}: {
  product: Product;
  variant: Variant;
  catalog: Catalog;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
  onAdd: (variant: Variant) => void;
}) {
  const { t, localized, money } = useLanguage();
  const available = maxQuantity(catalog, variant) >= stepOf(catalog, variant);
  const unit = catalog.units.find((item) => item.id === variant.unitId);
  return (
    <article className="product-card">
      <div className="product-visual">
        <button
          className="product-image-button"
          onClick={onOpen}
          aria-label={t("Подробнее: {0}", { "0": localized(product.nameI18n) })}
        >
          <ProductImage product={product} variant={variant} />
        </button>
        {!available && (
          <span className="product-badge">{t("Скоро в наличии")}</span>
        )}
        <button
          className={`favorite-button ${favorite ? "selected" : ""}`}
          onClick={onFavorite}
          aria-label={t(
            favorite
              ? "Убрать из избранного: {name}"
              : "Добавить в избранное: {name}",
            { name: localized(product.nameI18n) },
          )}
          aria-pressed={favorite}
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <span className="product-brand">
          {product.brandName || "Shop collection"}
        </span>
        <button className="product-title" onClick={onOpen}>
          {localized(product.nameI18n)}
        </button>
        <div className="product-bottom">
          <span>
            {money(variant.price, variant.currency)}
            {unit?.allowsFraction && (
              <small className="unit-label">
                {" "}
                / {localized(unit.symbolI18n)}
              </small>
            )}
          </span>
          <button
            className="add-button"
            disabled={!available}
            aria-label={t("В корзину: {0}", {
              "0": localized(product.nameI18n),
            })}
            onClick={() => (unit?.allowsFraction ? onOpen() : onAdd(variant))}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </article>
  );
}
