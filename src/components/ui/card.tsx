import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { FOCUS_RING } from "./focus-ring";

/** `raised` sits on the page; `overlay` sits on something already raised, one step lighter. */
export type CardElevation = "raised" | "overlay";

export type CardPadding = "sm" | "md" | "lg";

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
  children,
  className,
  href,
  as: Element = "div",
}: CardProps) {
  const classes = cx(
    "block rounded-xl border border-subtle text-primary",
    ELEVATION_CLASSES[elevation],
    PADDING_CLASSES[padding],
    className,
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
        {children}
      </Link>
    );
  }

  return <Element className={classes}>{children}</Element>;
}
