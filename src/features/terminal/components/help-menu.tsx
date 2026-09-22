"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { buttonClassName } from "@/components/ui/button";
import { cx } from "@/lib/cx";

export interface HelpMenuItem {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
}

/**
 * The terminal's Help menu: a button that opens a short list. Arrow keys move through it, Enter
 * picks, Escape closes and puts focus back on the button.
 */
export function HelpMenu({ items }: { items: readonly HelpMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.parentElement?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = itemRefs.current.findIndex((item) => item === document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      itemRefs.current[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      itemRefs.current[event.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName({ variant: "ghost", size: "sm" })}
      >
        Help
        <span aria-hidden="true" className="text-xs">
          ▾
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Terminal help"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-40 mt-1 w-60 animate-fade-in rounded-lg border border-strong bg-surface-overlay p-1 shadow-xl"
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[i] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cx(
                "block w-full rounded-md px-3 py-2 text-left text-sm text-primary hover:bg-surface-raised focus:bg-surface-raised focus:outline-2 focus:outline-focus-ring",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
