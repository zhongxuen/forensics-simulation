"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "@/lib/cx";
import { FOCUS_RING } from "./focus-ring";

export interface TabItem {
  /** Stable and unique within the tab list. */
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
  /** Shown but can't be picked. Say nearby why it's unavailable. */
  readonly disabled?: boolean;
}

/** Controlled (`selectedId` with `onSelect`), or uncontrolled with an optional starting tab. */
type TabsSelection =
  | { selectedId: string; onSelect: (id: string) => void; defaultSelectedId?: never }
  | { selectedId?: never; onSelect?: (id: string) => void; defaultSelectedId?: string };

type TabsProps = TabsSelection & {
  /** What the tabs switch between, for screen readers: "Mission views". */
  label: string;
  tabs: readonly TabItem[];
  className?: string;
};

const firstEnabled = (tabs: readonly TabItem[]) => tabs.find((tab) => !tab.disabled)?.id;

/** Where the selected tab's underline sits, measured from the tab list's top left corner. */
interface IndicatorBox {
  readonly left: number;
  /** Tabs can wrap onto a second row, so the bar moves down as well as across. */
  readonly top: number;
  readonly width: number;
  /** False for the first placement, so the bar appears in place instead of sliding in. */
  readonly slide: boolean;
}

/**
 * Tabs that switch between views in place. Keyboard: Tab reaches the selected tab, arrow keys move
 * between tabs (skipping unavailable ones) and select as they go, Home and End jump to the ends.
 *
 * The selected tab's underline slides to the tab you pick (fx-slide: instant under reduced
 * motion). Until the tabs are measured (the server render, and before hydration), each tab draws
 * its own bar, so the selection is always marked.
 */
export function Tabs({
  label,
  tabs,
  selectedId,
  onSelect,
  defaultSelectedId,
  className,
}: TabsProps) {
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [internalId, setInternalId] = useState(defaultSelectedId);

  const wanted = selectedId ?? internalId;
  const current = tabs.some((tab) => tab.id === wanted && !tab.disabled)
    ? wanted
    : firstEnabled(tabs);

  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<IndicatorBox | undefined>(undefined);

  // Measure the selected tab, now and whenever the tab list changes size (a label wraps, the
  // window narrows).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || current === undefined) return;
    const place = () => {
      const tab = tabRefs.current.get(current);
      if (!tab) return;
      // Where the per-tab bar it replaces sits: inset 8px each side, along the tab's bottom 2px.
      const left = tab.offsetLeft + 8;
      const top = tab.offsetTop + tab.offsetHeight - 2;
      const width = Math.max(0, tab.offsetWidth - 16);
      setIndicator((previous) =>
        previous?.left === left && previous.top === top && previous.width === width
          ? previous
          : { left, top, width, slide: previous !== undefined },
      );
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [current]);

  const select = (id: string) => {
    if (selectedId === undefined) setInternalId(id);
    onSelect?.(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = tabs.filter((tab) => !tab.disabled);
    const index = enabled.findIndex((tab) => tab.id === current);
    let next: TabItem | undefined;
    if (event.key === "ArrowRight") next = enabled[(index + 1) % enabled.length];
    else if (event.key === "ArrowLeft")
      next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled.at(-1);
    if (!next) return;

    event.preventDefault();
    select(next.id);
    tabRefs.current.get(next.id)?.focus();
  };

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        data-indicator={indicator === undefined ? undefined : "ready"}
        className="group/tabs relative flex flex-wrap gap-1 border-b border-subtle"
      >
        {tabs.map((tab) => {
          const selected = tab.id === current;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) tabRefs.current.set(tab.id, element);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => select(tab.id)}
              className={cx(
                "relative -mb-px rounded-t-md px-3 pt-2 pb-2.5 text-sm font-medium text-secondary",
                "not-disabled:hover:bg-surface-overlay not-disabled:hover:text-primary",
                "disabled:cursor-not-allowed disabled:text-muted",
                // The bar marks the selected tab without relying on colour alone.
                "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full",
                "aria-selected:text-primary aria-selected:after:bg-accent",
                // Once measured, the one sliding bar below takes over.
                "group-data-[indicator=ready]/tabs:after:bg-transparent",
                FOCUS_RING,
              )}
            >
              {tab.label}
            </button>
          );
        })}
        {indicator !== undefined && (
          <span
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute top-0 left-0 h-0.5 rounded-full bg-accent",
              indicator.slide && "fx-slide",
            )}
            style={{ translate: `${indicator.left}px ${indicator.top}px`, width: indicator.width }}
          />
        )}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== current}
          // Lets keyboard users reach the panel's text when it has nothing focusable inside.
          tabIndex={0}
          className={cx("mt-4 rounded-md", FOCUS_RING)}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
