import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { FOCUS_RING } from "./focus-ring";

/** `raised` sits on the page; `overlay` sits on something already raised, one step lighter. */
export type CardElevation = "raised" | "overlay";

export type CardPadding = "sm" | "md" | "lg";

/**
 * `default`: a plain surface. `letter`: a document you were handed, like a client's written
 * permission: the raised surface with a top rule in --status-info (the permission colour), and an
 * optional "Signed:" line at the foot. Paper-toned by its layout, not by a new colour, so it only
 * uses pairs the contrast audit measures.
 */
export type CardVariant = "default" | "letter";

const ELEVATION_CLASSES: Readonly<Record<CardElevation, string>> = {
  raised: "bg-surface-raised",
  overlay: "bg-surface-overlay",
};

const PADDING_CLASSES: Readonly<Record<CardPadding, string>> = {
  sm: "p-3",
  md: "p-5",
  lg: "p-6 sm:p-8",
};

interface CardStyle {
  elevation?: CardElevation;
  padding?: CardPadding;
  variant?: CardVariant;
  /**
   * Letters only: who signed it, shown as "Signed: …" under a rule at the foot of the card
   * ("Delia Quillfen, owner, Quillfen Freight").
   */
  signed?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * With `href`, the whole card is one link (a mission in a list, say): keep its content short and
 * free of other controls. Without it, a plain container.
 */
export type CardProps = CardStyle &
  ({ href: string; as?: never } | { href?: undefined; as?: "div" | "article" | "section" });

/** A surface that groups related content. */
export function Card({
  elevation = "raised",
  padding = "md",
  variant = "default",
  signed,
  children,
  className,
  href,
  as: Element = "div",
}: CardProps) {
  const letter = variant === "letter";
  const classes = cx(
    "block rounded-xl border border-subtle text-primary",
    ELEVATION_CLASSES[elevation],
    PADDING_CLASSES[padding],
    letter && "border-t-4 border-t-status-info",
    className,
  );

  const content =
    letter && signed !== undefined ? (
      <>
        {children}
        <p className="mt-6 flex flex-wrap items-baseline gap-x-2 border-t border-subtle pt-3 type-small">
          <span className="font-semibold text-muted">Signed:</span>
          <span className="text-primary italic">{signed}</span>
        </p>
      </>
    ) : (
      children
    );

  if (href !== undefined) {
    return (
      <Link
        href={href}
        className={cx(
          classes,
          "transition-colors hover:border-accent",
          elevation === "raised" && "hover:bg-surface-overlay",
          FOCUS_RING,
        )}
      >
        {content}
      </Link>
    );
  }

  return <Element className={classes}>{content}</Element>;
}
