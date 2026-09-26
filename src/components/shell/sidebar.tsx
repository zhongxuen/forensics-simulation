"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";
import { APP_SECTIONS, sectionForPathname, type AppSection } from "@/lib/app-sections";
import { cx } from "@/lib/cx";
import type { NextStep } from "@/lib/next-step";
import { CandleMark } from "@/components/ui/candle-mark";
import { CloseIcon } from "@/components/ui/icons";
import { ChevronsLeftIcon, SECTION_ICONS, ShieldIcon } from "./icons";
import { FOCUS_RING, RAIL_TOOLTIP } from "./shell-styles";
import { StartHereLink } from "./start-here-link";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

/** `nextStep` is null where the sidebar shows none: inside a case, it would point at itself. */
type SidebarProps = { nextStep: NextStep | null } & (
  | {
      /** The persistent desktop sidebar, collapsible to an icon rail. */
      variant: "desktop";
    }
  | {
      /** The same contents inside the mobile menu drawer. */
      variant: "drawer";
      onClose: () => void;
    }
);

export function Sidebar(props: SidebarProps) {
  const { nextStep, variant } = props;
  const pathname = usePathname();
  const current = sectionForPathname(pathname);
  const onNavigate = variant === "drawer" ? props.onClose : undefined;

  return (
    <div className="flex h-full flex-col gap-5 px-3 py-4">
      <div className="flex items-center justify-between gap-2">
        <Brand onNavigate={onNavigate} />
        {variant === "drawer" && (
          <button
            type="button"
            data-drawer-initial-focus
            onClick={props.onClose}
            aria-label="Close menu"
            className={cx(
              "grid size-10 place-items-center rounded-md text-secondary hover:bg-surface-overlay hover:text-primary",
              FOCUS_RING,
            )}
          >
            <CloseIcon className="size-5" />
          </button>
        )}
      </div>

      {nextStep && (
        <StartHereLink
          step={nextStep}
          variant="sidebar"
          current={pathname === nextStep.href}
          onNavigate={onNavigate}
        />
      )}

      {/* Padding inside the scroll area keeps focus rings from being clipped. */}
      <nav
        aria-label="Main"
        className="-mx-2 -my-1 flex-1 [scrollbar-width:thin] [scrollbar-color:var(--border-strong)_transparent] overflow-y-auto px-2 py-1 rail:overflow-visible"
      >
        <ul className="space-y-1">
          {APP_SECTIONS.map((section) => (
            <li key={section.id}>
              <NavItem
                section={section}
                active={section.id === current?.id}
                exact={pathname === section.href}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-2 border-t border-subtle pt-3">
        <p className="px-3 text-xs leading-5 text-muted rail:hidden">
          Everything here is simulated. Nothing you do touches a real computer.
        </p>
        <PrivacyLink current={pathname === PRIVACY_HREF} onNavigate={onNavigate} />
        {variant === "desktop" && <CollapseToggle />}
      </div>
    </div>
  );
}

function Brand({ onNavigate }: { onNavigate: (() => void) | undefined }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className={cx(
        "group relative flex min-w-0 items-center gap-2.5 rounded-md py-1 pr-2 rail:mx-auto rail:pr-0",
        FOCUS_RING,
      )}
    >
      {/* Candlewright's candle: the lamp the evidence room works by (UIUX.md §3.1). */}
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-accent-subtle text-accent"
      >
        <CandleMark className="size-5" />
      </span>
      <span className={cx("truncate font-semibold tracking-tight", RAIL_TOOLTIP)}>
        Candlewright: Incident Room
      </span>
    </Link>
  );
}

interface NavItemProps {
  section: AppSection;
  /** The learner is somewhere in this section. */
  active: boolean;
  /** The learner is on this section's own page, not a page inside it. */
  exact: boolean;
  onNavigate: (() => void) | undefined;
}

function NavItem({ section, active, exact, onNavigate }: NavItemProps) {
  const id = useId();
  const Icon = SECTION_ICONS[section.id];

  return (
    <Link
      href={section.href}
      onClick={onNavigate}
      aria-current={exact ? "page" : active ? "true" : undefined}
      // Name is the label alone; the subtitle is read after it as a description.
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-subtitle`}
      data-active={active || undefined}
      className={cx(
        "group relative flex gap-3 rounded-md px-3 py-2 text-secondary hover:bg-surface-overlay hover:text-primary",
        "data-active:bg-accent-subtle data-active:text-primary",
        // The accent bar marks the current section without relying on colour alone.
        "before:absolute before:inset-y-2 before:left-0 before:w-0.75 before:rounded-full data-active:before:bg-accent",
        "rail:mx-auto rail:size-11 rail:items-center rail:justify-center rail:p-0",
        FOCUS_RING,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-muted group-hover:text-secondary group-data-active:text-accent rail:mt-0" />
      <span className={cx("min-w-0", RAIL_TOOLTIP)}>
        <span id={`${id}-label`} className="block leading-6 font-medium">
          {section.label}
        </span>
        <span id={`${id}-subtitle`} className="block text-sm leading-5 text-muted">
          {section.subtitle}
        </span>
      </span>
    </Link>
  );
}

const PRIVACY_HREF = "/privacy";

/** The "What we store" page, reachable from every app page. */
function PrivacyLink({
  current,
  onNavigate,
}: {
  current: boolean;
  onNavigate: (() => void) | undefined;
}) {
  return (
    <Link
      href={PRIVACY_HREF}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cx(
        "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-overlay hover:text-primary",
        "rail:mx-auto rail:size-11 rail:justify-center rail:p-0",
        FOCUS_RING,
      )}
    >
      <ShieldIcon className="size-5 shrink-0" />
      <span className={RAIL_TOOLTIP}>What we store</span>
    </Link>
  );
}

function CollapseToggle() {
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <button
      type="button"
      onClick={() => setCollapsed(!collapsed)}
      aria-expanded={!collapsed}
      aria-controls="app-sidebar"
      className={cx(
        "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-overlay hover:text-primary",
        "rail:mx-auto rail:size-11 rail:justify-center rail:p-0",
        FOCUS_RING,
      )}
    >
      <ChevronsLeftIcon className="size-5 shrink-0 rail:rotate-180" />
      <span className={RAIL_TOOLTIP}>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
    </button>
  );
}
