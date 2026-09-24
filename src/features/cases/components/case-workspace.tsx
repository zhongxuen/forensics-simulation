"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useId,
  useMemo,
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
import { LightbulbIcon } from "@/components/ui/icons";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import { Spinner } from "@/components/ui/spinner";
import { ToastViewport } from "@/components/ui/toast";
import type { SaveStatus } from "@/lib/case-storage";
import { cx } from "@/lib/cx";
import {
  buildMentorTranscript,
  MENTOR_FIRST_NAME,
  MentorPanel,
  NudgeChip,
  useNudge,
  type MentorSession,
} from "@/features/mentor";
import { Terminal, type TerminalSession } from "@/features/terminal";
import { useSettings } from "@/lib/settings";
import type { BrowsedImage, EvidenceSet } from "@/sim/types";
import type { RunnableCase } from "../run/case-definition";
import type { CaseRunAction, CaseRunState } from "../run/case-run";
import { currentObjective } from "../run/case-run";
import { caseProgress } from "../run/evaluate";
import {
  PANE_LABELS,
  PANE_ORDER,
  WORKSPACE_PANES,
  type PaneId,
  type PaneWorkstation,
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

/**
 * Which of the mentor's three row-bearing views a pane is (docs/plan/14-mentor.md §Spec). Only a
 * visible pane can have a row pointed at, so the selected tab is the one that asked. The Objectives
 * pane has no rows to explain; it never calls `explain`, and its entry only keeps the map total.
 */
const PANE_VIEW: Readonly<Record<PaneId, "evidence" | "timeline" | "board">> = {
  evidence: "evidence",
  timeline: "timeline",
  board: "board",
  objectives: "evidence",
};

interface CaseWorkspaceProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
  session: TerminalSession;
  /** Opens a disk image through the engine for the Evidence Browser, logged for replay. */
  browse: (path: string) => BrowsedImage | undefined;
  evidence: EvidenceSet | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  saveStatus: SaveStatus;
  /**
   * Noor, for this attempt (docs/plan/14-mentor.md). The mentor is an enhancement, never a
   * dependency: leave it out and the workspace loses the Ask Noor button, the Explain buttons and
   * the nudge chip, and everything else works exactly as it did.
   */
  mentor?: MentorSession;
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
  browse,
  evidence,
  headingRef,
  saveStatus,
  mentor,
}: CaseWorkspaceProps) {
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => false);
  const [pane, setPane] = useState<PaneId>("objectives");
  const [view, setView] = useState<ViewId>("objectives");
  const [opened, setOpened] = useState<readonly PaneId[]>(["objectives"]);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const baseId = useId();
  const tabRefs = useRef(new Map<ViewId, HTMLButtonElement>());
  const { done, total } = caseProgress(caseDef, run.completed);
  // The step the player is on, so a hint or an explanation has the right context.
  const objectiveId = currentObjective(caseDef, run)?.id;

  const tabs: readonly ViewId[] = desktop ? PANE_ORDER : ["terminal", ...PANE_ORDER];
  const selected: ViewId = desktop || view !== "terminal" ? pane : "terminal";
  const label = (id: ViewId) => (id === "terminal" ? "Terminal" : PANE_LABELS[id]);

  const select = useCallback((id: ViewId) => {
    setView(id);
    if (id === "terminal") return;
    setPane(id);
    setOpened((previous) => (previous.includes(id) ? previous : [...previous, id]));
  }, []);

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

  // Noor's drawer (docs/plan/14-mentor.md). It only ever opens because the player asked: Ask
  // Noor, Show me a hint, Explain this, or the nudge chip. Nothing opens it by itself.
  const settings = useSettings();
  const [mentorOpen, setMentorOpen] = useState(false);
  const [hintObjective, setHintObjective] = useState<string>();
  const openMentor = useCallback((objectiveId?: string) => {
    if (objectiveId !== undefined) setHintObjective(objectiveId);
    setMentorOpen(true);
  }, []);

  // The only player text that ever leaves the browser, and only when they ask the mentor for
  // something: their recent commands and what the workstation showed, already capped.
  const transcript = useMemo(
    () => (mentor ? buildMentorTranscript(session.blocks) : []),
    [mentor, session.blocks],
  );

  const askHint = useCallback(
    (id: string) => {
      mentor?.askHint(id, transcript);
    },
    [mentor, transcript],
  );

  // "Want a nudge?" (docs/plan/14-mentor.md): the chip offers a hint when the player seems stuck —
  // a few commands that didn't work since their last tick, or a few minutes without one. It never
  // opens anything by itself, it can be dismissed until the next tick, and `nudgeChip` on
  // /settings turns it off for good.
  const failures = useMemo(
    () => run.events.filter((event) => event.type === "command.run" && event.exitCode !== 0).length,
    [run.events],
  );
  const nudge = useNudge({
    progress: run.completed.length,
    failures,
    enabled: mentor !== undefined && settings.nudgeChip && !mentorOpen,
  });

  // "Show in terminal": the command goes to the prompt, unrun, and the terminal comes into view.
  const [fillRequest, setFillRequest] = useState<{ id: number; line: string }>();
  // "Show in Evidence Browser" and the like: the pane's tab opens, and only that pane is asked to
  // bring the artefact into view.
  const [reveal, setReveal] = useState<{ pane: PaneId; ref: string; id: number }>();
  const workstation = useMemo<PaneWorkstation>(
    () => ({
      sim: session.sim,
      browse,
      showInTerminal: (line) => {
        setFillRequest((previous) => ({ id: (previous?.id ?? 0) + 1, line }));
        setView("terminal");
      },
      show: (target, ref) => {
        if (ref !== undefined) {
          setReveal((previous) => ({ pane: target, ref, id: (previous?.id ?? 0) + 1 }));
        }
        select(target);
      },
      // "Explain this" on a row of whichever pane asked (docs/plan/14-mentor.md §Spec). The pane
      // hands over the row as it drew it and its own plain-language fallback; the evidence set
      // never travels. Undefined without a mentor, and then no pane shows an Explain button.
      ...(mentor && {
        explain: (row) => {
          mentor.explain({
            question: {
              kind: "row",
              view: PANE_VIEW[pane],
              text: row.text,
              ...(row.title !== undefined && { title: row.title }),
            },
            transcript,
            fallback: row.fallback,
            ...(objectiveId !== undefined && { objectiveId }),
          });
          openMentor();
        },
      }),
    }),
    [session.sim, browse, select, mentor, pane, transcript, objectiveId, openMentor],
  );
  const paneProps: WorkspacePaneProps = { caseDef, run, dispatch, evidence, workstation };
  const propsFor = (id: PaneId): WorkspacePaneProps =>
    reveal?.pane === id ? { ...paneProps, reveal: { ref: reveal.ref, id: reveal.id } } : paneProps;
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
          {mentor && (
            <Button
              variant="secondary"
              size="sm"
              icon={<LightbulbIcon />}
              aria-expanded={mentorOpen}
              onClick={() => (mentorOpen ? setMentorOpen(false) : openMentor(objectiveId))}
            >
              Ask {MENTOR_FIRST_NAME}
            </Button>
          )}
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
          <Terminal
            session={session}
            outputClassName="h-[24rem] lg:h-[32rem]"
            {...(fillRequest && { fillRequest })}
            {...(mentor && {
              // "Explain this" on any terminal line, error or whole result. The terminal builds the
              // request, its own explainer included, so the answer never depends on the mentor
              // being available (docs/plan/14-mentor.md §Spec).
              onExplain: (request) => {
                mentor.explain({
                  question: {
                    kind: "output",
                    command: request.command,
                    text: request.text,
                    scope: request.scope,
                    error: request.error,
                  },
                  transcript,
                  fallback: request.fallback,
                  ...(objectiveId !== undefined && { objectiveId }),
                });
                openMentor();
              },
            })}
          />
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
                    <Pane {...propsFor(id)} />
                  </Suspense>
                ) : (
                  <LaterPane id={id} onShowObjectives={() => select("objectives")} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {mentor && (
        <>
          <MentorPanel
            open={mentorOpen}
            onClose={() => setMentorOpen(false)}
            caseDef={caseDef}
            completed={run.completed}
            objectiveId={hintObjective ?? objectiveId}
            onSelectObjective={setHintObjective}
            state={mentor.state}
            onAskHint={askHint}
          />
          {nudge.show && (
            <ToastViewport>
              <NudgeChip
                onAccept={() => {
                  nudge.dismiss();
                  openMentor(objectiveId);
                }}
                onDismiss={nudge.dismiss}
              />
            </ToastViewport>
          )}
        </>
      )}

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
