import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isLanguage, translate, type Language } from "../lib/translations";
import { localized, money, countLabel } from "../lib/catalog";
import type { I18n } from "../types";
import { localizedUrl } from "../lib/routes";

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
} | null>(null);

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguage] = useState<Language>(() => {
    if (initialLanguage) return initialLanguage;
    try {
      const saved = localStorage.getItem("besik-language");
      return isLanguage(saved) ? saved : "ru";
    } catch {
      return "ru";
    }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    if (!initialLanguage)
      document.title = `Shop — ${translate("Хорошо быть дома.", language)}`;
    try {
      const saved = localStorage.getItem("besik-language");
      const url = new URL(window.location.href);
      if (
        initialLanguage &&
        !url.searchParams.has("lang") &&
        isLanguage(saved) &&
        saved !== language &&
        (url.pathname === "/" || url.pathname.startsWith("/products/"))
      ) {
        window.location.replace(
          localizedUrl(`${url.pathname}${url.search}${url.hash}`, saved),
        );
        return;
      }
      localStorage.setItem("besik-language", language);
      document.cookie = `besik-language=${language}; Path=/; SameSite=Lax; Max-Age=31536000`;
    } catch {
      /* Selection still works without storage. */
    }
  }, [language]);
  const value = useMemo(
    () => ({
      language,
      setLanguage: (next: Language) => {
        if (next === language) return;
        const { pathname, search, hash } = window.location;
        if (pathname === "/" || pathname.startsWith("/products/")) {
          // Persist before navigation: the next request must not redirect back
          // to the old preferred language when switching to the default URL.
          try {
            localStorage.setItem("besik-language", next);
          } catch {
            /* Storage is optional. */
          }
          document.cookie = `besik-language=${next}; Path=/; SameSite=Lax; Max-Age=31536000`;
          window.location.assign(
            localizedUrl(`${pathname}${search}${hash}`, next),
          );
        } else {
          setLanguage(next);
        }
      },
    }),
    [language],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is required");
  const { language } = context;
  return {
    ...context,
    t: (message: string, values?: Record<string, string | number>) =>
      translate(message, language, values),
    localized: (value: I18n | undefined) => localized(value, language),
    money: (value: number | string, currency = "GEL") =>
      money(value, currency, language),
    countLabel: (count: number, forms: [string, string, string]) =>
      countLabel(count, forms, language),
  };
}
