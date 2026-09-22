"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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

/**
 * Tabs that switch between views in place. Keyboard: Tab reaches the selected tab, arrow keys move
 * between tabs (skipping unavailable ones) and select as they go, Home and End jump to the ends.
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
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-1 border-b border-subtle"
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
                FOCUS_RING,
              )}
            >
              {tab.label}
            </button>
          );
        })}
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
