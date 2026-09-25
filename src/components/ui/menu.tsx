"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./button";
import { FOCUS_RING } from "./focus-ring";

export interface MenuItem {
  /** Stable and unique within the menu. */
  readonly id: string;
  /** Says what happens: "Start the case again", "Copy transcript". */
  readonly label: string;
  readonly onSelect: () => void;
  /** Decorative, before the label. */
  readonly icon?: ReactNode;
  /**
   * `danger` for an item that throws something away. It still opens its confirm dialog: the menu
   * only moves destructive actions away from eye level (UIUX.md §4.3).
   */
  readonly tone?: "default" | "danger";
  /** Shown but can't be picked. Say nearby why it's unavailable. */
  readonly disabled?: boolean;
}

interface MenuProps {
  /** The button's text: "Case" for the "⋯ Case" menu. */
  label: string;
  items: readonly MenuItem[];
  /** Before the label. Defaults to "⋯". Decorative: the label names the menu. */
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Which edge of the button the list lines up with. Default `end`, for menus at a right edge. */
  align?: "start" | "end";
  className?: string;
}

/** Three dots: "more actions". */
function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

/**
 * A button that opens a short list of actions: the "⋯ Case" overflow menu, where the actions that
 * don't belong at eye level live. The ARIA menu button pattern:
 *
 * - The button has aria-haspopup="menu" and aria-expanded. Enter, Space or Arrow Down opens the
 *   menu on its first item; Arrow Up opens it on its last.
 * - In the menu, Arrow Up and Down move (wrapping, skipping disabled items), Home and End jump,
 *   and a letter jumps to the next item starting with it.
 * - Enter or Space picks an item. Escape closes. Either way focus returns to the button, before
 *   the item's action runs, so a dialog it opens hands focus back there too.
 * - Tab, or a click outside, closes the menu and lets focus move on.
 */
export function Menu({
  label,
  items,
  icon = <MoreIcon />,
  variant = "ghost",
  size = "sm",
  align = "end",
  className,
}: MenuProps) {
  const baseId = useId();
  const menuId = `${baseId}-menu`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  const enabled = items.filter((item) => !item.disabled);

  const focusItem = (id: string | undefined) => {
    setActiveId(id);
    if (id !== undefined) itemRefs.current.get(id)?.focus();
  };

  const openMenu = (at: "first" | "last") => {
    setOpen(true);
    setActiveId(at === "first" ? enabled[0]?.id : enabled.at(-1)?.id);
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setActiveId(undefined);
    if (returnFocus) buttonRef.current?.focus();
  };

  // Focus the active item once the list is on screen.
  useEffect(() => {
    if (open && activeId !== undefined) itemRefs.current.get(activeId)?.focus();
  }, [open, activeId]);

  // A click or tap anywhere outside closes the menu, leaving focus where the click put it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setActiveId(undefined);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const pick = (item: MenuItem) => {
    if (item.disabled) return;
    close(true);
    item.onSelect();
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(event.key === "ArrowDown" ? "first" : "last");
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const index = enabled.findIndex((item) => item.id === activeId);
    let next: MenuItem | undefined;
    if (event.key === "ArrowDown") next = enabled[(index + 1) % enabled.length];
    else if (event.key === "ArrowUp") next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled.at(-1);
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    } else if (event.key === "Tab") {
      close(false);
      return;
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      const letter = event.key.toLowerCase();
      const rotated = [...enabled.slice(index + 1), ...enabled.slice(0, index + 1)];
      next = rotated.find((item) => item.label.toLowerCase().startsWith(letter));
    }
    if (!next) return;
    event.preventDefault();
    focusItem(next.id);
  };

  return (
    <div ref={rootRef} className={cx("relative inline-block", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openMenu("first"))}
        onKeyDown={onButtonKeyDown}
        className={cx(buttonClassName({ variant, size }), FOCUS_RING)}
      >
        {icon}
        {label}
      </button>

      {open && (
        <ul
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cx(
            "absolute top-full z-30 mt-1 min-w-56 animate-fade-in rounded-lg border border-strong bg-surface-overlay p-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                ref={(element) => {
                  if (element) itemRefs.current.set(item.id, element);
                  else itemRefs.current.delete(item.id);
                }}
                type="button"
                role="menuitem"
                tabIndex={item.id === activeId ? 0 : -1}
                aria-disabled={item.disabled || undefined}
                onClick={() => pick(item)}
                onMouseEnter={() => !item.disabled && focusItem(item.id)}
                className={cx(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left type-small font-medium [&_svg]:size-4 [&_svg]:shrink-0",
                  item.disabled
                    ? "cursor-not-allowed text-muted"
                    : item.tone === "danger"
                      ? "text-status-danger hover:bg-surface-raised focus-visible:bg-surface-raised"
                      : "text-primary hover:bg-surface-raised focus-visible:bg-surface-raised",
                  FOCUS_RING,
                )}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
