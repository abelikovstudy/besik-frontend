import { createContext, useContext, type ReactNode } from "react";
import type { Catalog } from "../types";
import type { Language } from "../lib/translations";

export interface PageData {
  url: string;
  origin: string;
  language: Language;
  kind: "catalog" | "product" | "auth" | "not-found" | "unavailable";
  catalog: Catalog | null;
  variantId?: string;
  images: Record<string, string[]>;
  error?: string;
  rendered: boolean;
}

const PageContext = createContext<PageData | null>(null);
export function PageProvider({
  data,
  children,
}: {
  data: PageData;
  children: ReactNode;
}) {
  return <PageContext.Provider value={data}>{children}</PageContext.Provider>;
}
export function usePage() {
  const data = useContext(PageContext);
  if (!data) throw new Error("PageProvider is required");
  return data;
}
