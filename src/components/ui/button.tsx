import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { FOCUS_RING } from "./focus-ring";
import { Spinner } from "./spinner";

/**
 * `primary`: the one main action on a screen ("Start mission"). Accent-filled.
 * `secondary`: other actions ("Show me a hint"). Outlined.
 * `ghost`: low-emphasis actions in toolbars and dismiss buttons.
 * `danger`: actions that throw something away ("Restart mission"). Nothing in the app is
 * irreversible, but these still deserve a second look.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export type ButtonSize = "sm" | "md" | "lg";

/**
 * A button either shows text (with an optional icon before it), or is icon-only. An icon-only
 * button must carry `label`, its accessible name, which also shows as a native tooltip.
 */
export type ButtonContent =
  | { children: ReactNode; icon?: ReactNode; label?: never }
  | { label: string; icon: ReactNode; children?: never };

interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-accent text-surface-base not-disabled:hover:bg-accent-hover",
  secondary:
    "border border-strong bg-surface-raised text-primary not-disabled:hover:border-accent not-disabled:hover:bg-surface-overlay",
  ghost: "text-secondary not-disabled:hover:bg-surface-overlay not-disabled:hover:text-primary",
  danger:
    "border border-status-danger text-status-danger not-disabled:hover:bg-status-danger not-disabled:hover:text-surface-base",
};

const TEXT_SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: "h-8 gap-1.5 px-3 text-sm [&_svg]:size-4",
  md: "h-10 gap-2 px-4 text-base [&_svg]:size-4.5",
  lg: "h-12 gap-2.5 px-5 text-lg [&_svg]:size-5",
};

const ICON_SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: "size-8 [&_svg]:size-4",
  md: "size-10 [&_svg]:size-5",
  lg: "size-12 [&_svg]:size-6",
};

/** The classes for a button's look, for anything that should look like one. */
export function buttonClassName({
  variant = "secondary",
  size = "md",
  iconOnly = false,
}: ButtonStyle & { iconOnly?: boolean }): string {
  return cx(
    "inline-flex shrink-0 items-center justify-center rounded-md font-semibold whitespace-nowrap transition-colors select-none",
    // Disabled controls are exempt from contrast rules, but these colours pass anyway.
    "disabled:cursor-not-allowed disabled:border-subtle disabled:bg-surface-overlay disabled:text-muted",
    "aria-busy:cursor-progress",
    iconOnly ? ICON_SIZE_CLASSES[size] : TEXT_SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    FOCUS_RING,
  );
}

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "aria-label" | "type"
>;

export type ButtonProps = ButtonStyle &
  ButtonContent &
  NativeButtonProps & {
    /** Defaults to "button", so a button inside a form never submits it by accident. */
    type?: "button" | "submit" | "reset";
    /**
     * Shows a spinner and ignores clicks until the work finishes. The button stays focusable and
     * keeps its label, so keyboard and screen reader users don't lose their place.
     */
    loading?: boolean;
  };

export function Button({
  variant,
  size,
  loading = false,
  icon,
  label,
  children,
  className,
  type = "button",
  onClick,
  ...props
}: ButtonProps) {
  const iconOnly = label !== undefined;
  const leading = loading ? <Spinner /> : icon;

  return (
    <button
      // While loading it can't submit its form. No handler is swapped in for that, so a server
      // component can render a loading button too.
      type={loading ? "button" : type}
      aria-label={label}
      title={label}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? undefined : onClick}
      className={cx(buttonClassName({ variant, size, iconOnly }), className)}
      {...props}
    >
      {leading}
      {!iconOnly && children}
    </button>
  );
}

export type ButtonLinkProps = ButtonStyle &
  ButtonContent &
  Omit<ComponentProps<typeof Link>, "children" | "aria-label">;

/**
 * A link that looks like a button, for actions that go somewhere ("Start here"). A link can't be
 * disabled: if there's nowhere to go, don't show it, and say why in words.
 */
export function ButtonLink({
  variant,
  size,
  icon,
  label,
  children,
  className,
  ...props
}: ButtonLinkProps) {
  const iconOnly = label !== undefined;

  return (
    <Link
      aria-label={label}
      title={label}
      className={cx(buttonClassName({ variant, size, iconOnly }), className)}
      {...props}
    >
      {icon}
      {!iconOnly && children}
    </Link>
  );
}
