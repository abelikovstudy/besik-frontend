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

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("besik-language");
      return isLanguage(saved) ? saved : "ru";
    } catch {
      return "ru";
    }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `Shop — ${translate("Хорошо быть дома.", language)}`;
    try {
      localStorage.setItem("besik-language", language);
    } catch {
      /* Selection still works without storage. */
    }
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage }), [language]);
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
