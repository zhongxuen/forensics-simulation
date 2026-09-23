"use client";

import {
  lazy,
  Suspense,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type KeyboardEvent,
  type LazyExoticComponent,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import { Spinner } from "@/components/ui/spinner";
import type { SaveStatus } from "@/lib/case-storage";
import { cx } from "@/lib/cx";
import { Terminal, type TerminalSession } from "@/features/terminal";
import type { EvidenceSet } from "@/sim/types";
import type { RunnableCase } from "../run/case-definition";
import type { CaseRunAction, CaseRunState } from "../run/case-run";
import { caseProgress } from "../run/evaluate";
import {
  PANE_LABELS,
  PANE_ORDER,
  WORKSPACE_PANES,
  type PaneId,
  type WorkspacePaneProps,
} from "../workspace-panes";
import { LaterPane } from "./later-pane";
import { StorageBanner } from "./storage-banner";

/** Each registered pane's component, loaded the first time its tab opens. */
const PANE_COMPONENTS: ReadonlyMap<
  PaneId,
  LazyExoticComponent<ComponentType<WorkspacePaneProps>>
> = new Map(WORKSPACE_PANES.map((pane) => [pane.id, lazy(pane.load)]));

/** Wide enough for the terminal and a pane side by side. Below it, one at a time. */
const DESKTOP_QUERY = "(min-width: 64rem)";

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;

type ViewId = "terminal" | PaneId;

interface CaseWorkspaceProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
  session: TerminalSession;
  evidence: EvidenceSet | null | undefined;
  headingRef: RefObject<HTMLHeadingElement | null>;
  saveStatus: SaveStatus;
}

/**
 * The workspace (docs/plan/05-workspace-ui.md §Workspace layout). On a wide screen the terminal is
 * always on the left and the panes are tabs on the right: Evidence, Timeline, Board, Objectives.
 * On a narrow one (down to 360 px) one view shows at a time, with the terminal as the first tab.
 * The terminal never unmounts, so a half-typed line survives a tab change, and a pane stays
 * mounted once opened, so it keeps its place.
 *
 * The SIMULATED marker sits in the header, so it shows whichever view is open.
 */
export function CaseWorkspace({
  caseDef,
  run,
  dispatch,
  session,
  evidence,
  headingRef,
  saveStatus,
}: CaseWorkspaceProps) {
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => false);
  const [pane, setPane] = useState<PaneId>("objectives");
  const [view, setView] = useState<ViewId>("objectives");
  const [opened, setOpened] = useState<readonly PaneId[]>(["objectives"]);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const baseId = useId();
  const tabRefs = useRef(new Map<ViewId, HTMLButtonElement>());
  const { done, total } = caseProgress(caseDef, run.completed);

  const tabs: readonly ViewId[] = desktop ? PANE_ORDER : ["terminal", ...PANE_ORDER];
  const selected: ViewId = desktop || view !== "terminal" ? pane : "terminal";
  const label = (id: ViewId) => (id === "terminal" ? "Terminal" : PANE_LABELS[id]);

  const select = (id: ViewId) => {
    setView(id);
    if (id === "terminal") return;
    setPane(id);
    if (!opened.includes(id)) setOpened([...opened, id]);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.indexOf(selected);
    let next: ViewId | undefined;
    if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
    else if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
    else if (event.key === "Home") next = tabs[0];
    else if (event.key === "End") next = tabs.at(-1);
    if (!next) return;
    event.preventDefault();
    select(next);
    tabRefs.current.get(next)?.focus();
  };

  const paneProps: WorkspacePaneProps = { caseDef, run, dispatch, evidence };
  const tabId = (id: ViewId) => `${baseId}-tab-${id}`;
  const panelId = (id: ViewId) => `${baseId}-panel-${id}`;
  const terminalShown = desktop || selected === "terminal";

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-accent">Case</span>
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
            <span className="text-secondary">
              {done} of {total} objectives done
            </span>
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight text-balance outline-none"
          >
            {caseDef.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SimulatedBadge side="bottom" align="end" />
          <Button variant="danger" size="sm" onClick={() => setConfirmRestart(true)}>
            Start the case again
          </Button>
        </div>
      </header>

      <div className="mt-3">
        <StorageBanner status={saveStatus} />
      </div>

      <div
        className={cx(
          "mt-4 gap-6",
          desktop && "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start",
        )}
      >
        {!desktop && (
          <ViewTabs
            tabs={tabs}
            selected={selected}
            label={label}
            tabId={tabId}
            panelId={panelId}
            tabRefs={tabRefs}
            onSelect={select}
            onKeyDown={onTabKeyDown}
          />
        )}

        <div
          {...(!desktop && {
            role: "tabpanel",
            id: panelId("terminal"),
            "aria-labelledby": tabId("terminal"),
          })}
          hidden={!terminalShown}
          className={cx("min-w-0", !desktop && "mt-4")}
        >
          <Terminal session={session} outputClassName="h-[24rem] lg:h-[32rem]" />
        </div>

        <div className="min-w-0">
          {desktop && (
            <ViewTabs
              tabs={tabs}
              selected={selected}
              label={label}
              tabId={tabId}
              panelId={panelId}
              tabRefs={tabRefs}
              onSelect={select}
              onKeyDown={onTabKeyDown}
            />
          )}
          {PANE_ORDER.map((id) => {
            const Pane = PANE_COMPONENTS.get(id);
            return (
              <div
                key={id}
                role="tabpanel"
                id={panelId(id)}
                aria-labelledby={tabId(id)}
                hidden={selected !== id}
                tabIndex={0}
                className={cx("mt-4 rounded-md", FOCUS_RING)}
              >
                {!opened.includes(id) ? null : Pane ? (
                  <Suspense
                    fallback={
                      <p role="status" className="flex items-center gap-3 py-10 text-secondary">
                        <Spinner />
                        Opening {PANE_LABELS[id]}…
                      </p>
                    }
                  >
                    <Pane {...paneProps} />
                  </Suspense>
                ) : (
                  <LaterPane
                    id={id}
                    pins={run.pins.length}
                    onShowObjectives={() => select("objectives")}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        title="Start this case again?"
        description="Your commands, notes, pins and ticks for this case will be cleared, and you'll go back to the briefing."
        size="sm"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmRestart(false)}>
              Keep going
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmRestart(false);
                dispatch({ type: "restart" });
              }}
            >
              Start the case again
            </Button>
          </>
        }
      />
    </div>
  );
}

interface ViewTabsProps {
  tabs: readonly ViewId[];
  selected: ViewId;
  label: (id: ViewId) => string;
  tabId: (id: ViewId) => string;
  panelId: (id: ViewId) => string;
  tabRefs: RefObject<Map<ViewId, HTMLButtonElement>>;
  onSelect: (id: ViewId) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * The workspace's tab bar. Tab reaches the selected tab; the arrow keys move between tabs and
 * select as they go; Home and End jump to the ends.
 */
function ViewTabs({
  tabs,
  selected,
  label,
  tabId,
  panelId,
  tabRefs,
  onSelect,
  onKeyDown,
}: ViewTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Workspace views"
      onKeyDown={onKeyDown}
      className="flex gap-1 overflow-x-auto border-b border-subtle"
    >
      {tabs.map((id) => (
        <button
          key={id}
          ref={(element) => {
            if (element) tabRefs.current.set(id, element);
            else tabRefs.current.delete(id);
          }}
          type="button"
          role="tab"
          id={tabId(id)}
          aria-selected={id === selected}
          aria-controls={panelId(id)}
          tabIndex={id === selected ? 0 : -1}
          onClick={() => onSelect(id)}
          className={cx(
            "relative -mb-px shrink-0 rounded-t-md px-3 pt-2 pb-2.5 text-sm font-medium text-secondary",
            "hover:bg-surface-overlay hover:text-primary",
            // The bar marks the selected tab without relying on colour alone.
            "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full",
            "aria-selected:text-primary aria-selected:after:bg-accent",
            FOCUS_RING,
          )}
        >
          {label(id)}
        </button>
      ))}
    </div>
  );
}
