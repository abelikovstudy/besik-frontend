import { useEffect, useState } from "react";
import type { CartLine, Catalog } from "../types";
import { demoMode, loadCatalog } from "../lib/api";
import { usePage } from "./usePage";

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
  // The initial browser render must match the public server HTML. Restore private
  // browser state after hydration, before allowing the persistence effect to run.
  const [value, setValue] = useState<T>(fallback);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const restore = () => {
      setValue(readStorage(key, fallback, validate));
      setRestored(true);
    };
    const changed = (event: StorageEvent) => {
      if (event.key === key || event.key === null) restore();
    };
    restore();
    // Native page navigation can restore a document from the back/forward cache.
    window.addEventListener("pageshow", restore);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("storage", changed);
    };
  }, [key]);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* In-memory state still works when storage is unavailable. */
    }
  }, [key, value, restored]);
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

export function useCatalog(enabled = true) {
  const initial = usePage();
  const [catalog, setCatalog] = useState<Catalog | null>(initial.catalog);
  const [error, setError] = useState(initial.error || "");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (attempt === 0 && (initial.catalog || initial.error)) return;
    setCatalog(null);
    setError("");
    if (!enabled) return;
    const controller = new AbortController();
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
  }, [attempt, enabled]);
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
