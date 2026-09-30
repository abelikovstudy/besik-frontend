import { useEffect } from "react";
import {
  ArrowRight,
  Grid2X2,
  Heart,
  House,
  Leaf,
  ShoppingBag,
  Truck,
} from "lucide-react";
import type { Category } from "../types";
import { useLanguage } from "../hooks/useLanguage";
import { Dialog } from "./Dialog";

interface SidebarProps {
  categories: Category[];
  category: string;
  favoritesOnly: boolean;
  open: boolean;
  onClose: () => void;
  onCategory: (id: string) => void;
  onHome: () => void;
  onFavorites: () => void;
  onCart: () => void;
  onInfo: (page: "about" | "delivery") => void;
}

export function Sidebar({
  categories,
  category,
  favoritesOnly,
  open,
  onClose,
  onCategory,
  onHome,
  onFavorites,
  onCart,
  onInfo,
}: SidebarProps) {
  const { t, localized } = useLanguage();
  // A mobile drawer must not keep the desktop page inert after a resize.
  useEffect(() => {
    if (!open) return;
    const media = matchMedia("(min-width: 1001px)");
    const closeOnDesktop = () => {
      if (media.matches) onClose();
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [open, onClose]);
  const navigate = (action: () => void) => {
    onClose();
    action();
  };
  const content = (
    <>
      <nav aria-label={t("Основная навигация")} className="sidebar-nav">
        <button onClick={() => navigate(onHome)}>
          <House size={18} />
          {t("Главная")}
        </button>
        <button
          className={!category && !favoritesOnly ? "active" : ""}
          aria-current={!category && !favoritesOnly ? "page" : undefined}
          onClick={() => navigate(() => onCategory(""))}
        >
          <Grid2X2 size={18} />
          {t("Весь каталог")}
        </button>
        <h2>{t("Категории")}</h2>
        {categories.map((item) => (
          <button
            key={item.id}
            className={`sidebar-category ${category === item.id && !favoritesOnly ? "active" : ""} ${item.parentId ? "subcategory" : ""}`}
            aria-current={
              category === item.id && !favoritesOnly ? "page" : undefined
            }
            onClick={() => navigate(() => onCategory(item.id))}
          >
            <span>{localized(item.nameI18n)}</span>
            <ArrowRight size={13} />
          </button>
        ))}
        <h2>{t("Покупателям")}</h2>
        <button
          className={favoritesOnly ? "active" : ""}
          aria-current={favoritesOnly ? "page" : undefined}
          onClick={() => navigate(onFavorites)}
        >
          <Heart size={18} />
          {t("Избранное")}
        </button>
        <button onClick={() => navigate(onCart)}>
          <ShoppingBag size={18} />
          {t("Корзина")}
        </button>
        <button onClick={() => navigate(() => onInfo("delivery"))}>
          <Truck size={18} />
          {t("Доставка и самовывоз")}
        </button>
        <button onClick={() => navigate(() => onInfo("about"))}>
          <Leaf size={18} />
          {t("О Shop")}
        </button>
      </nav>
      <div className="sidebar-note">
        <Leaf size={28} strokeWidth={1} />
        <p>
          {t("Простые вещи.")}
          <br />
          {t("Особенное настроение.")}
        </p>
      </div>
    </>
  );
  return (
    <>
      <aside className="desktop-sidebar" aria-label={t("Меню")}>
        {content}
      </aside>
      {open && (
        <Dialog title={t("Меню")} onClose={onClose} side>
          {content}
        </Dialog>
      )}
    </>
  );
}
