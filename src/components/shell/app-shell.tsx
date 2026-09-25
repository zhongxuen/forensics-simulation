"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import { sectionForPathname } from "@/lib/app-sections";
import { cx } from "@/lib/cx";
import { FIRST_STEP } from "@/lib/next-step";
import { nextStepFor, type NextStepCase } from "@/lib/next-step-from-runs";
import { updateSettings, useSettings } from "@/lib/settings";
import { Breadcrumb } from "./breadcrumb";
import { CommandPalette, SearchButton, type CommandPaletteHandle } from "./command-palette";
import { MenuIcon } from "./icons";
import { LeaveGuardProvider } from "./leave-guard";
import { MissionProgressIndicator, MissionProgressProvider } from "./mission-progress";
import { FOCUS_RING } from "./shell-styles";
import { Sidebar } from "./sidebar";
import { StartHereLink } from "./start-here-link";
import { useSavedRuns } from "@/hooks/use-saved-runs";
import { SidebarViewContext } from "./use-sidebar-collapsed";

interface AppShellProps {
  /** The chapter's released cases in order, for "Start here" and "Continue Case 1 · 1 of 5". */
  chapter: readonly NextStepCase[];
  /**
   * The title of each page inside a section, by pathname, for the breadcrumb (`/cases/case-01` →
   * "The clean copy"). A page not listed shows its section alone.
   */
  pageTitles: Readonly<Record<string, string>>;
  children: ReactNode;
}

/** A case's own page, where a case run happens: `/cases/case-01`. */
const CASE_RUN_PATH = /^\/cases\/[^/]+\/?$/;

/** Matches Tailwind's `md` breakpoint, where the drawer gives way to the persistent sidebar. */
const DESKTOP_QUERY = "(width >= 48rem)";

/**
 * The frame every product page renders in: a sidebar with "Start here" and the section links, a
 * top bar, the main content region, and the command palette (⌘K / Ctrl+K).
 *
 * From `md` up the sidebar is always visible and collapses to an icon rail. Below `md` it opens as
 * a drawer: a native modal <dialog>, which traps focus, closes on Escape, and returns focus to the
 * menu button.
 *
 * The top bar shows a breadcrumb (`Cases / The clean copy`), the current mission's progress (only
 * inside a mission: see ShowMissionProgress), the one SIMULATED marker, and the search button.
 * While a mission run is in progress, leaving asks first (LeaveGuard).
 *
 * "Start here" follows the runs saved in this browser: "Continue Case 1 · 1 of 5" with a case in
 * progress, and hidden inside a case, where it would point at where you already are. Inside a case
 * the sidebar also starts collapsed to the rail; toggling it there lasts until you leave the case,
 * and the saved setting is never touched, so it's back as it was on the next page.
 */
export function AppShell({ chapter, pageTitles, children }: AppShellProps) {
  const pathname = usePathname();
  const section = sectionForPathname(pathname);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const paletteRef = useRef<CommandPaletteHandle>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const savedRuns = useSavedRuns(pathname);
  const nextStep = useMemo(
    () => (savedRuns ? nextStepFor(savedRuns, chapter) : FIRST_STEP),
    [savedRuns, chapter],
  );
  const inCaseRun = CASE_RUN_PATH.test(pathname);
  const onStartPage = pathname === nextStep.href;

  // Inside a case run: collapsed unless the player expanded it on this page.
  const savedCollapsed = useSettings().sidebarCollapsed;
  const [caseView, setCaseView] = useState<{ pathname: string; collapsed: boolean } | null>(null);
  const caseCollapsed = caseView?.pathname === pathname ? caseView.collapsed : true;
  const sidebarView = useMemo(
    () =>
      inCaseRun
        ? ([caseCollapsed, (collapsed: boolean) => setCaseView({ pathname, collapsed })] as const)
        : ([
            savedCollapsed,
            (collapsed: boolean) => updateSettings({ sidebarCollapsed: collapsed }),
          ] as const),
    [inCaseRun, caseCollapsed, savedCollapsed, pathname],
  );

  const openDrawer = () => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    drawer.showModal();
    // Start on "Close menu" rather than the first link, so closing is one keypress away.
    drawer.querySelector<HTMLElement>("[data-drawer-initial-focus]")?.focus();
    setDrawerOpen(true);
  };
  // The dialog's close event updates drawerOpen, however it was closed.
  const closeDrawer = () => drawerRef.current?.close();

  // A drawer left open while the window widens would be hidden but still modal, blocking the page.
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (desktop.matches) drawerRef.current?.close();
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  return (
    <MissionProgressProvider>
      <LeaveGuardProvider>
        <div
          className="flex flex-1 bg-surface-base text-primary"
          // Read by the `rail:` variant (src/styles/globals.css), so the case's rail is in the HTML.
          data-sidebar-view={inCaseRun ? (caseCollapsed ? "rail" : "full") : undefined}
        >
          <a
            href="#main-content"
            className={cx(
              "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-surface-base",
              FOCUS_RING,
            )}
          >
            Skip to main content
          </a>

          <div
            id="app-sidebar"
            className="sticky top-0 z-30 hidden h-dvh w-80 shrink-0 border-r border-subtle bg-surface-raised md:block rail:w-18"
          >
            <SidebarViewContext value={sidebarView}>
              <Sidebar variant="desktop" nextStep={inCaseRun ? null : nextStep} />
            </SidebarViewContext>
          </div>

          <dialog
            ref={drawerRef}
            id="app-drawer"
            aria-label="Menu"
            onClose={() => setDrawerOpen(false)}
            // A click on the dialog element itself, not its contents, is a click on the backdrop.
            onClick={(event) => {
              if (event.target === event.currentTarget) closeDrawer();
            }}
            className="m-0 h-dvh max-h-dvh w-80 max-w-[85vw] border-r border-subtle bg-surface-raised text-primary backdrop:bg-surface-base/80 md:hidden"
          >
            <Sidebar
              variant="drawer"
              nextStep={inCaseRun ? null : nextStep}
              onClose={closeDrawer}
            />
          </dialog>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-subtle bg-surface-base/90 px-4 backdrop-blur-sm sm:gap-3 sm:px-6">
              <button
                type="button"
                onClick={openDrawer}
                aria-label="Open menu"
                aria-haspopup="dialog"
                aria-expanded={drawerOpen}
                aria-controls="app-drawer"
                className={cx(
                  "-ml-1 grid size-10 shrink-0 place-items-center rounded-md text-secondary hover:bg-surface-raised hover:text-primary md:hidden",
                  FOCUS_RING,
                )}
              >
                <MenuIcon className="size-5" />
              </button>

              <Breadcrumb section={section} title={pageTitles[pathname]} />

              <MissionProgressIndicator />
              <SimulatedBadge size="sm" side="bottom" align="end" />
              <SearchButton onClick={() => paletteRef.current?.open()} />
            </header>

            {/* Small screens hide the sidebar, so Start here gets its own bar, pinned where thumbs
              reach. It comes right after the header in tab order. Not inside a case, where the
              case's own controls need the room. */}
            {!inCaseRun && (
              <div className="fixed inset-x-0 bottom-0 z-20 border-t border-subtle bg-surface-base/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-6 md:hidden">
                <StartHereLink step={nextStep} variant="bar" current={onStartPage} />
              </div>
            )}

            <main
              id="main-content"
              // Lets the skip link move focus here. Not a control, so it needs no focus ring.
              tabIndex={-1}
              // Bottom padding on small screens clears the Start here bar.
              className={cx(
                "flex-1 px-4 pt-8 outline-none sm:px-6 md:pb-8 lg:px-10 lg:py-12",
                inCaseRun ? "pb-8" : "pb-32",
              )}
            >
              {/* Its own hydration boundary: a key pressed before the page has finished hydrating
                  (a Tab, ⌘K) only waits for the part it lands in, not the whole page (INP). */}
              <Suspense>{children}</Suspense>
            </main>
          </div>

          <CommandPalette ref={paletteRef} nextStep={nextStep} />
        </div>
      </LeaveGuardProvider>
    </MissionProgressProvider>
  );
}
