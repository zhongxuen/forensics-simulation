"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Button } from "./button";
import { CloseIcon } from "./icons";

export type DialogSize = "sm" | "md";

const SIZE_CLASSES: Readonly<Record<DialogSize, string>> = {
  sm: "max-w-sm",
  md: "max-w-lg",
};

interface DialogSurfaceProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons along the bottom, main action last. */
  actions?: ReactNode;
  /** Shows the Close button. */
  onClose?: () => void;
  size?: DialogSize;
  titleId?: string;
  descriptionId?: string;
  className?: string;
}

/**
 * The dialog's visible panel: title, optional description, content, and actions. Dialog wraps it in
 * a modal; on its own it renders in place, for static previews.
 */
export function DialogSurface({
  title,
  description,
  children,
  actions,
  onClose,
  size = "md",
  titleId,
  descriptionId,
  className,
}: DialogSurfaceProps) {
  return (
    <div
      className={cx(
        "w-full rounded-xl border border-strong bg-surface-raised p-5 text-primary shadow-2xl",
        SIZE_CLASSES[size],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg leading-7 font-semibold text-balance">
            {title}
          </h2>
          {description !== undefined && (
            <p id={descriptionId} className="mt-1 leading-6 text-secondary">
              {description}
            </p>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            label="Close"
            icon={<CloseIcon />}
            onClick={onClose}
            className="-mt-1 -mr-2"
          />
        )}
      </div>
      {children !== undefined && <div className="mt-4 leading-7 text-secondary">{children}</div>}
      {actions !== undefined && (
        <div className="mt-6 flex flex-wrap justify-end gap-2">{actions}</div>
      )}
    </div>
  );
}

interface DialogProps {
  open: boolean;
  /** Called when the learner closes it: the Close button, Escape, or a click outside. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  size?: DialogSize;
}

/**
 * A modal dialog, built on the native <dialog> element: it traps focus, closes on Escape, and
 * hands focus back to whatever had it before opening.
 */
export function Dialog({ open, onClose, size = "md", ...surface }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={surface.description !== undefined ? descriptionId : undefined}
      // Escape closes the native dialog, which fires `close`; so does dialog.close() above.
      onClose={() => {
        returnFocusRef.current?.focus();
        returnFocusRef.current = null;
        onClose();
      }}
      // A click on the <dialog> itself, not on the panel inside it, is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cx(
        "m-auto w-[calc(100%-2rem)] overflow-visible border-0 bg-transparent p-0 text-primary backdrop:bg-surface-base/80 open:animate-fade-in",
        SIZE_CLASSES[size],
      )}
    >
      <DialogSurface
        {...surface}
        size={size}
        onClose={onClose}
        titleId={titleId}
        descriptionId={descriptionId}
      />
    </dialog>
  );
}
