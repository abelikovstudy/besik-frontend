import { useEffect, useState } from "react";
import type { CartLine, Catalog } from "../types";
import { demoMode, loadCatalog } from "../lib/api";

function readStorage<T>(
  key: string,
  fallback: T,
  validate: (data: unknown) => data is T,
): T {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) || "null");
    return validate(data) ? data : fallback;
  } catch {
    return fallback;
  }
}
export function usePersistentState<T>(
  key: string,
  fallback: T,
  validate: (data: unknown) => data is T,
) {
  const [value, setValue] = useState<T>(() =>
    readStorage(key, fallback, validate),
  );
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* In-memory state still works when storage is unavailable. */
    }
  }, [key, value]);
  return [value, setValue] as const;
}
export const isCart = (data: unknown): data is CartLine[] =>
  Array.isArray(data) &&
  data.every(
    (line) =>
      line &&
      typeof line.variantId === "string" &&
      typeof line.quantity === "number" &&
      Number.isFinite(line.quantity) &&
      line.quantity > 0,
  ) &&
  new Set(data.map((line) => line.variantId)).size === data.length;
export const isFavorites = (data: unknown): data is string[] =>
  Array.isArray(data) && data.every((id) => typeof id === "string");
export const storageKey = (name: string) =>
  `besik-${demoMode ? "demo" : "live"}-${name}-v1`;

export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    loadCatalog(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCatalog(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Не удалось загрузить товары. Проверьте соединение или попробуйте немного позже.",
          );
      });
    return () => controller.abort();
  }, [attempt]);
  return {
    catalog,
    setCatalog,
    error,
    reload: () => {
      setCatalog(null);
      setAttempt((a) => a + 1);
    },
  };
}
