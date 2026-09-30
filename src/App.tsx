import { useLanguage } from "./hooks/useLanguage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Armchair,
  Check,
  ChevronDown,
  Heart,
  Lamp,
  Leaf,
  MapPin,
  Menu,
  Package,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  X,
} from "lucide-react";
import type { Variant } from "./types";
import {
  activeCategories,
  filterVariantEntries,
  maxQuantity,
  stepOf,
} from "./lib/catalog";
import { demoMode } from "./lib/api";
import {
  isCart,
  isFavorites,
  storageKey,
  useCatalog,
  usePersistentState,
} from "./hooks/useStore";
import { ProductCard } from "./components/ProductCard";
import { ProductDialog } from "./components/ProductDialog";
import { CartDialog } from "./components/CartDialog";
import { Dialog } from "./components/Dialog";
import { Sidebar } from "./components/Sidebar";
import { isLanguage } from "./lib/translations";
function readLocation() {
  const params = new URLSearchParams(window.location.search);
  return {
    query: params.get("q") || "",
    category: params.get("category") || "",
    sort: params.get("sort") || "newest",
    inStock: params.get("stock") === "1",
    favoritesOnly: params.get("view") === "favorites",
  };
}
const photos = {
  hero: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&q=85",
  living:
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85",
};
export default function App() {
  const { t, localized, countLabel, language, setLanguage } = useLanguage();
  const { catalog, setCatalog, error, reload } = useCatalog();
  const [filters, setFilters] = useState(readLocation);
  const [search, setSearch] = useState(filters.query);
  const [cart, setCart] = usePersistentState(storageKey("cart"), [], isCart);
  const [favorites, setFavorites] = usePersistentState(
    storageKey("variant-favorites"),
    [],
    isFavorites,
  );
  const [productId, setProductId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [info, setInfo] = useState<"delivery" | "about" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [limit, setLimit] = useState(12);
  const catalogRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const categories = catalog ? activeCategories(catalog.categories) : [];
  const products = useMemo(
    () =>
      catalog
        ? filterVariantEntries(catalog, {
            ...filters,
            language,
            favorites: filters.favoritesOnly ? favorites : undefined,
          })
        : [],
    [catalog, filters, favorites, language],
  );
  const selectedEntry = catalog
    ? filterVariantEntries(catalog, {
        query: "",
        category: "",
        sort: "newest",
        inStock: false,
      }).find((entry) => entry.variant.id === productId)
    : undefined;
  const selectedCategory = categories.find((c) => c.id === filters.category);
  const scrollToCatalog = () =>
    catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  useEffect(() => {
    const pop = () => {
      const next = readLocation();
      setFilters(next);
      setSearch(next.query);
    };
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    setLimit(12);
  }, [filters]);
  function updateFilters(changes: Partial<typeof filters>, scroll = false) {
    const next = { ...filters, ...changes };
    setFilters(next);
    if (changes.query !== undefined) setSearch(changes.query);
    const params = new URLSearchParams(window.location.search);
    const entries = {
      q: next.query,
      category: next.category,
      sort: next.sort === "newest" ? "" : next.sort,
      stock: next.inStock ? "1" : "",
      view: next.favoritesOnly ? "favorites" : "",
    };
    Object.entries(entries).forEach(([key, value]) =>
      value ? params.set(key, value) : params.delete(key),
    );
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${params.size ? `?${params}` : ""}`,
    );
    if (scroll) scrollToCatalog();
    setMenuOpen(false);
  }
  function notify(message: string) {
    clearTimeout(timer.current);
    setNotice(message);
    timer.current = setTimeout(() => setNotice(""), 3500);
  }
  function addToCart(variant: Variant) {
    if (!catalog) return false;
    const quantity =
      (cart.find((line) => line.variantId === variant.id)?.quantity || 0) +
      stepOf(catalog, variant);
    if (quantity > maxQuantity(catalog, variant) + 0.00001) {
      notify(t("В корзине уже всё доступное количество"));
      return false;
    }
    setCart((previous) =>
      previous.some((line) => line.variantId === variant.id)
        ? previous.map((line) =>
            line.variantId === variant.id
              ? { ...line, quantity: Number(quantity.toFixed(3)) }
              : line,
          )
        : [
            ...previous,
            { variantId: variant.id, quantity: stepOf(catalog, variant) },
          ],
    );
    notify(t("Товар добавлен в корзину"));
    return true;
  }
  function toggleFavorite(id: string) {
    setFavorites((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  }
  function resetFilters() {
    setSearch("");
    updateFilters({
      query: "",
      category: "",
      inStock: false,
      favoritesOnly: false,
      sort: "newest",
    });
  }
  return (
    <>
      <a className="skip-link" href="#catalog">
        {t("Перейти к товарам")}
      </a>
      {demoMode && (
        <div className="demo-banner">
          {t("Демонстрационный каталог · заказы отключены")}{" "}
          <a href="/">
            {t("Открыть магазин")}
            <ArrowRight size={12} />
          </a>
        </div>
      )}
      <div className="announcement">
        <span>{t("Маленькие детали. Большое чувство дома.")}</span>
        <span>
          <MapPin size={12} />
          {t("Сделано для вашей жизни в Грузии")}
        </span>
      </div>
      <header className="header">
        <div className="header-main container">
          <form
            className="search-form"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              updateFilters(
                { query: search.trim(), category: "", favoritesOnly: false },
                true,
              );
            }}
          >
            <Search size={19} />
            <input
              aria-label={t("Поиск товаров")}
              placeholder={t("Что сделает ваш дом уютнее?")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label={t("Очистить поиск")}
                onClick={() => {
                  setSearch("");
                  updateFilters({ query: "" });
                }}
              >
                <X size={16} />
              </button>
            )}
            <button className="search-submit" aria-label={t("Найти товары")}>
              <ArrowRight size={19} />
            </button>
          </form>
          <div className="header-actions">
            <label className="language-switch">
              <span className="sr-only">{t("Язык")}</span>
              <select
                value={language}
                onChange={(event) => {
                  if (isLanguage(event.target.value))
                    setLanguage(event.target.value);
                }}
              >
                <option value="en" lang="en">
                  EN
                </option>
                <option value="ka" lang="ka">
                  KA
                </option>
                <option value="ru" lang="ru">
                  RU
                </option>
              </select>
            </label>
            <button
              onClick={() =>
                updateFilters(
                  {
                    favoritesOnly: !filters.favoritesOnly,
                    category: "",
                    query: "",
                  },
                  true,
                )
              }
              className={`header-action ${filters.favoritesOnly ? "active" : ""}`}
              aria-label={t("Избранное, {0}", {
                "0": countLabel(favorites.length, [
                  t("товар"),
                  t("товара"),
                  t("товаров"),
                ]),
              })}
            >
              <Heart size={21} />
              <span>{t("Избранное")}</span>
              {favorites.length > 0 && <b>{favorites.length}</b>}
            </button>
            <button
              onClick={() => setCartOpen(true)}
              className="header-action"
              aria-label={t("Корзина, {0}", {
                "0": countLabel(cart.length, [
                  t("позиция"),
                  t("позиции"),
                  t("позиций"),
                ]),
              })}
            >
              <ShoppingBag size={21} />
              <span>{t("Корзина")}</span>
              <b>{cart.length}</b>
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label={t("Меню")}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <div className="store-layout">
        <Sidebar
          categories={categories}
          category={filters.category}
          favoritesOnly={filters.favoritesOnly}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onCategory={(id) =>
            updateFilters(
              { category: id, query: "", favoritesOnly: false },
              true,
            )
          }
          onHome={() => {
            resetFilters();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onFavorites={() =>
            updateFilters(
              { favoritesOnly: true, query: "", category: "" },
              true,
            )
          }
          onCart={() => setCartOpen(true)}
          onInfo={setInfo}
        />
        <div className="store-content">
          <main>
            <section className="hero container" aria-labelledby="hero-title">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="tiny-line" />
                  {t("Вещи со смыслом")}
                </span>
                <h1 id="hero-title">
                  {t("Хорошо")}
                  <br />
                  {t("быть")} <em>{t("дома.")}</em>
                </h1>
                <p>
                  {t("Ваш ритм. Ваше пространство.")}
                  <br />
                  {t("Вещи, которые делают каждый день")}
                  <br className="desktop-break" /> {t("немного приятнее.")}
                </p>
                <button
                  className="button primary"
                  onClick={() => {
                    resetFilters();
                    scrollToCatalog();
                  }}
                >
                  {t("Найти своё")}
                  <ArrowRight size={18} />
                </button>
                <div className="hero-footnote">
                  <span className="small-star">✳</span>
                  <span>
                    {t("Простые вещи.")}
                    <br />
                    {t("Особенное настроение.")}
                  </span>
                </div>
              </div>
              <div className="hero-photo">
                <img
                  src={photos.hero}
                  alt={t(
                    "Светлая гостиная с мягкой мебелью, натуральными оттенками и зелёными растениями",
                  )}
                  fetchPriority="high"
                />
                <div className="hero-photo-caption">
                  <span>THE ART OF EVERYDAY LIVING</span>
                  <span> COLLECTION</span>
                </div>
                <button
                  className="hero-discover"
                  onClick={scrollToCatalog}
                  aria-label={t("Открыть коллекцию")}
                >
                  <ArrowDown size={21} />
                </button>
              </div>
            </section>
            <div className="benefits container">
              <div>
                <Truck size={23} strokeWidth={1.4} />
                <span>
                  {t("Ближе к вашему дому")}
                  <small>{t("Доставка по адресу")}</small>
                </span>
              </div>
              <div>
                <Package size={23} strokeWidth={1.4} />
                <span>
                  {t("Как вам удобно")}
                  <small>{t("Доставка или самовывоз")}</small>
                </span>
              </div>
              <div>
                <Leaf size={23} strokeWidth={1.4} />
                <span>
                  {t("Меньше лишнего")}
                  <small>{t("Больше любимых вещей")}</small>
                </span>
              </div>
            </div>
            <section
              className="catalog-section container"
              id="catalog"
              ref={catalogRef}
              aria-labelledby="catalog-title"
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {t("Ваша следующая любимая вещь")}
                  </span>
                  <h2 id="catalog-title">
                    {filters.favoritesOnly
                      ? t("Ваше избранное")
                      : filters.query
                        ? t("Результаты поиска")
                        : selectedCategory
                          ? localized(selectedCategory.nameI18n)
                          : t("Найдите своё")}
                  </h2>
                </div>
                <p>
                  {filters.query
                    ? t("По запросу «{0}»", { "0": filters.query })
                    : t("Для больших перемен и маленьких радостей.")}
                </p>
              </div>
              <div className="catalog-toolbar">
                <div
                  className="category-tabs"
                  aria-label={t("Категории товаров")}
                >
                  <button
                    className={!filters.category ? "selected" : ""}
                    onClick={() => updateFilters({ category: "" })}
                  >
                    {t("Все товары")}
                  </button>
                  {categories.map((category) => (
                    <button
                      className={
                        filters.category === category.id ? "selected" : ""
                      }
                      key={category.id}
                      onClick={() => updateFilters({ category: category.id })}
                    >
                      {localized(category.nameI18n)}
                    </button>
                  ))}
                </div>
                <label className="sort-select">
                  <SlidersHorizontal size={15} />
                  <select
                    aria-label={t("Сортировка товаров")}
                    value={filters.sort}
                    onChange={(e) => updateFilters({ sort: e.target.value })}
                  >
                    <option value="newest">{t("Сначала новые")}</option>
                    <option value="price-asc">
                      {t("Цена: по возрастанию")}
                    </option>
                    <option value="price-desc">{t("Цена: по убыванию")}</option>
                    <option value="name">{t("По названию")}</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
              </div>
              <div className="catalog-meta">
                <span>
                  {catalog
                    ? countLabel(products.length, [
                        t("товар"),
                        t("товара"),
                        t("товаров"),
                      ])
                    : t("Загружаем коллекцию…")}
                  {(filters.query ||
                    filters.category ||
                    filters.favoritesOnly) && (
                    <button className="reset-button" onClick={resetFilters}>
                      {t("Сбросить фильтры")}
                      <X size={12} />
                    </button>
                  )}
                </span>
                <label className="stock-toggle">
                  <input
                    type="checkbox"
                    checked={filters.inStock}
                    onChange={(e) =>
                      updateFilters({ inStock: e.target.checked })
                    }
                  />
                  {t("Только в наличии")}
                </label>
              </div>
              {error ? (
                <div className="empty-state" role="alert">
                  <Package size={38} strokeWidth={1} />
                  <h3>{t("Магазин скоро вернётся")}</h3>
                  <p>{t(error)}</p>
                  <button className="button primary" onClick={reload}>
                    {t("Попробовать снова")}
                  </button>
                  <a className="demo-link" href="/?demo=1">
                    {t("Посмотреть демонстрационный каталог")}
                  </a>
                </div>
              ) : !catalog ? (
                <div
                  className="product-grid"
                  aria-label={t("Загрузка товаров")}
                  aria-busy="true"
                >
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="skeleton-card">
                      <div />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>
              ) : !products.length ? (
                <div className="empty-state">
                  <Search size={38} strokeWidth={1} />
                  <h3>
                    {filters.favoritesOnly
                      ? t("Сохраните то, что понравилось")
                      : t("Пока ничего не нашлось")}
                  </h3>
                  <p>
                    {filters.favoritesOnly
                      ? t(
                          "Нажмите на сердечко рядом с товаром — он будет ждать вас здесь.",
                        )
                      : t(
                          "Попробуйте другой запрос или выберите другую категорию.",
                        )}
                  </p>
                  <button className="button secondary" onClick={resetFilters}>
                    {t("Показать все товары")}
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="product-grid">
                    {products.slice(0, limit).map(({ product, variant }) => (
                      <ProductCard
                        key={variant.id}
                        product={product}
                        variant={variant}
                        catalog={catalog}
                        favorite={favorites.includes(variant.id)}
                        onFavorite={() => toggleFavorite(variant.id)}
                        onOpen={() => setProductId(variant.id)}
                        onAdd={addToCart}
                      />
                    ))}
                  </div>
                  {limit < products.length && (
                    <div className="load-more">
                      <button
                        className="button secondary"
                        onClick={() => setLimit((l) => l + 12)}
                      >
                        {t("Показать ещё")}
                        <PlusIcon />
                      </button>
                      <span className="muted">
                        {t("Показано {shown} из {total}", {
                          shown: Math.min(limit, products.length),
                          total: products.length,
                        })}
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>
            <section
              className="editorial container"
              aria-labelledby="editorial-title"
            >
              <div className="editorial-image">
                <img
                  src={photos.living}
                  loading="lazy"
                  alt={t("Уютная гостиная в естественных оттенках")}
                />
                <span>{t("МЕСТО ДЛЯ СЕБЯ")}</span>
              </div>
              <div className="editorial-copy">
                <span className="eyebrow">{t("Вдохновение рядом")}</span>
                <h2 id="editorial-title">
                  {t("Не просто вещи.")}
                  <br />
                  <em>{t("Ваше настроение.")}</em>
                </h2>
                <p>
                  {t(
                    "Дом складывается из деталей. Из любимой чашки, мягкого света и кресла, в котором хочется остаться подольше.",
                  )}
                </p>
                <p>{t("Соберите пространство, которое рассказывает о вас.")}</p>
                <button
                  className="text-button"
                  onClick={() => {
                    resetFilters();
                    scrollToCatalog();
                  }}
                >
                  {t("Собрать свой уют")}
                  <ArrowRight size={18} />
                </button>
                <Leaf className="editorial-leaf" size={85} strokeWidth={0.6} />
              </div>
            </section>
            <section className="closing container">
              <span className="small-star">✳</span>
              <h2>
                {t("Пусть дома будет")} <em>{t("хорошо.")}</em>
              </h2>
              <p>{t("А мы поможем найти всё, что для этого нужно.")}</p>
            </section>
          </main>
          <footer>
            <div className="footer-main container">
              <div>
                <a className="logo" href="#">
                  Shop<span>®</span>
                </a>
                <p>
                  {t("Вещи для дома.")}
                  <br />
                  {t("Место для жизни.")}
                </p>
              </div>
              <div>
                <h3>{t("Найдите своё")}</h3>
                <button
                  onClick={() => {
                    resetFilters();
                    scrollToCatalog();
                  }}
                >
                  {t("Все товары")}
                </button>
                <button
                  onClick={() =>
                    updateFilters(
                      { favoritesOnly: true, category: "", query: "" },
                      true,
                    )
                  }
                >
                  {t("Избранное")}
                </button>
                <button onClick={() => setCartOpen(true)}>
                  {t("Корзина")}
                </button>
              </div>
              <div>
                <h3>{t("Рядом с вами")}</h3>
                <button onClick={() => setInfo("delivery")}>
                  {t("Доставка и самовывоз")}
                </button>
                <button onClick={() => setInfo("about")}>
                  {t("О магазине")}
                </button>
              </div>
              <div className="footer-message">
                <Armchair size={36} strokeWidth={1} />
                <span>
                  {t("Уют начинается")}
                  <br />
                  {t("с маленьких деталей.")}
                </span>
              </div>
            </div>
            <div className="footer-bottom container">
              <span>© {new Date().getFullYear()} Shop</span>
              <span>
                {t("С заботой о вашем пространстве")}
                <Heart size={12} />
              </span>
              <span>{t("Грузия · GEL ₾")}</span>
            </div>
          </footer>
        </div>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
          <button
            onClick={() => {
              setProductId(null);
              setCartOpen(true);
              setNotice("");
            }}
          >
            {t("Открыть корзину")}
            <ArrowRight size={15} />
          </button>
        </div>
      )}
      {selectedEntry && catalog && (
        <ProductDialog
          key={selectedEntry.variant.id}
          product={selectedEntry.product}
          variant={selectedEntry.variant}
          catalog={catalog}
          favorite={favorites.includes(selectedEntry.variant.id)}
          onFavorite={() => toggleFavorite(selectedEntry.variant.id)}
          onClose={() => setProductId(null)}
          onAdd={addToCart}
        />
      )}
      {cartOpen && catalog && (
        <CartDialog
          cart={cart}
          catalog={catalog}
          setCart={setCart}
          setCatalog={setCatalog}
          onClose={() => setCartOpen(false)}
        />
      )}
      {cartOpen && !catalog && (
        <Dialog title={t("Корзина")} onClose={() => setCartOpen(false)}>
          <div className="empty-state">
            <ShoppingBag size={38} />
            <p>
              {t(
                "Для проверки цен и наличия нужно загрузить каталог. Ваша корзина сохранена.",
              )}
            </p>
            <button
              className="button primary"
              onClick={() => {
                reload();
                setCartOpen(false);
              }}
            >
              {t("Загрузить каталог")}
            </button>
          </div>
        </Dialog>
      )}
      {info && (
        <Dialog
          title={
            info === "delivery"
              ? t("Доставка и самовывоз")
              : t("Знакомьтесь, Shop")
          }
          onClose={() => setInfo(null)}
        >
          <div className="information">
            {info === "delivery" ? (
              <>
                <Truck size={36} strokeWidth={1} />
                <h3>{t("Покупки в вашем ритме")}</h3>
                <p>
                  {t(
                    "При оформлении заказа выберите доставку по адресу или бесплатный самовывоз.",
                  )}
                </p>
                <h4>{t("Доставка")}</h4>
                <p>
                  {t(
                    "Укажите город, улицу, дом и контактный телефон. Стоимость доставки рассчитывается магазином при создании заказа и отображается в его подтверждении.",
                  )}
                </p>
                <h4>{t("Самовывоз")}</h4>
                <p>
                  {t(
                    "Оставьте имя и телефон. Адрес и время получения необходимо согласовать с магазином.",
                  )}
                </p>
                <p className="muted">
                  {t(
                    "Создание заказа не списывает деньги. Онлайн-оплата пока недоступна.",
                  )}
                </p>
              </>
            ) : (
              <>
                <Lamp size={36} strokeWidth={1} />
                <h3>{t("Хорошо быть дома.")}</h3>
                <p>
                  {t(
                    "Shop — место для вещей, которые становятся частью повседневной жизни. Мы верим, что уют складывается из простых, любимых деталей.",
                  )}
                </p>
                <p>
                  {t(
                    "Рассматривайте, выбирайте, сохраняйте в избранное. Найдите то, что подходит именно вам.",
                  )}
                </p>
                <button
                  className="button primary"
                  onClick={() => {
                    setInfo(null);
                    scrollToCatalog();
                  }}
                >
                  {t("В каталог")}
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
function PlusIcon() {
  return (
    <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>
      +
    </span>
  );
}
