import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Category } from "../types";
import { useLanguage } from "../hooks/useLanguage";

export function CategoryTabs({
  categories,
  category,
  onSelect,
}: {
  categories: Category[];
  category: string;
  onSelect: (id: string) => void;
}) {
  const { t, localized, language } = useLanguage();
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const measurement = useRef<HTMLDivElement>(null);
  const firstChip = useRef<HTMLButtonElement>(null);
  const [rows, setRows] = useState(1);
  const [visibleCount, setVisibleCount] = useState(1);
  const options = useMemo(() => {
    // Keep the active filter visible, including categories chosen in the sidebar.
    const selected = categories.find((item) => item.id === category);
    const others = categories.filter((item) => item.id !== selected?.id);
    return [
      ...(selected
        ? [{ id: selected.id, label: localized(selected.nameI18n) }]
        : []),
      { id: "", label: t("Все товары") },
      ...others.map((item) => ({
        id: item.id,
        label: localized(item.nameI18n),
      })),
    ];
  }, [categories, category, language]);

  useLayoutEffect(() => {
    const element = container.current;
    const probe = measurement.current;
    if (!element || !probe) return;

    const measure = () => {
      const width = element.getBoundingClientRect().width;
      if (!width) return;
      const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
      const chips = Array.from(probe.children).slice(0, options.length);
      const widths = chips.map((chip) => chip.getBoundingClientRect().width);
      const total =
        widths.reduce((sum, value) => sum + value, 0) +
        gap * (widths.length - 1);
      const controls = total > width || rows > 1;
      const available = Math.max(
        1,
        width -
          (controls
            ? probe.lastElementChild!.getBoundingClientRect().width + gap
            : 0),
      );
      let row = 1;
      let used = 0;
      let count = 0;
      for (const naturalWidth of widths) {
        const chipWidth = Math.min(naturalWidth, available);
        if (used && used + gap + chipWidth > available) {
          row++;
          used = 0;
        }
        if (row > rows) break;
        used += (used ? gap : 0) + chipWidth;
        count++;
      }
      setVisibleCount(Math.max(1, count));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // Chip measurements also change when fonts load or a breakpoint changes.
    for (const chip of probe.children) observer.observe(chip);
    return () => observer.disconnect();
  }, [options, rows]);

  const hasMore = visibleCount < options.length;
  return (
    <div
      className="category-tabs"
      role="group"
      aria-label={t("Категории товаров")}
      ref={container}
    >
      <div className="category-tabs-list" id={id}>
        {options.slice(0, visibleCount).map((option, index) => (
          <button
            ref={index === 0 ? firstChip : undefined}
            type="button"
            className={`category-chip${category === option.id ? " selected" : ""}`}
            key={option.id}
            aria-pressed={category === option.id}
            title={option.label}
            onClick={() => onSelect(option.id)}
          >
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      {(hasMore || rows > 1) && (
        <div className="category-tabs-controls">
          {hasMore && (
            <button
              type="button"
              className="category-more"
              aria-label={t("Показать ещё категории")}
              title={t("Показать ещё категории")}
              aria-expanded={rows > 1}
              aria-controls={id}
              onClick={() => setRows((value) => value + 1)}
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          )}
          {rows > 1 && (
            <button
              type="button"
              className="category-more"
              aria-label={t("Свернуть категории")}
              title={t("Свернуть категории")}
              aria-expanded={rows > 1}
              aria-controls={id}
              onClick={() => {
                setRows(1);
                firstChip.current?.focus();
              }}
            >
              <Minus size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      <div
        className="category-tabs-measure"
        ref={measurement}
        aria-hidden="true"
      >
        {options.map((option) => (
          <span className="category-chip" key={option.id}>
            {option.label}
          </span>
        ))}
        <span className="category-more">+</span>
      </div>
    </div>
  );
}
