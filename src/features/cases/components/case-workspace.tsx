"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
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
import { LightbulbIcon, TerminalIcon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { SplitPane } from "@/components/ui/split-pane";
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
import { objectiveSuggestions } from "../run/suggestions";
import {
  PANE_LABELS,
  PANE_ORDER,
  WORKSPACE_PANES,
  type PaneId,
  type PaneWorkstation,
  type WorkspacePaneProps,
} from "../workspace-panes";
import { LaterPane } from "./later-pane";
import { NowStrip } from "./now-strip";
import { StorageBanner } from "./storage-banner";

/** Each registered pane's component, loaded the first time its tab opens. */
const PANE_COMPONENTS: ReadonlyMap<
  PaneId,
  LazyExoticComponent<ComponentType<WorkspacePaneProps>>
> = new Map(WORKSPACE_PANES.map((pane) => [pane.id, lazy(pane.load)]));

/** Wide enough for the terminal and a pane side by side (1024 px). Below it, one at a time. */
const DESKTOP_QUERY = "(min-width: 64rem)";

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;

/**
 * The height of what the player can see, in px, and whether an on-screen keyboard is taking some
 * of it. On a phone the workspace sizes itself to this, so the terminal's prompt stays above the
 * keyboard instead of behind it. Undefined where the browser can't say (and in tests).
 */
function useVisibleHeight(): { height: number | undefined; keyboard: boolean } {
  const [state, setState] = useState<{ height: number | undefined; keyboard: boolean }>({
    height: undefined,
    keyboard: false,
  });
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const height = Math.round(viewport.height);
      // A keyboard takes a good part of the screen; a browser's toolbar sliding away doesn't.
      const keyboard = window.innerHeight - viewport.height > 150;
      setState((previous) =>
        previous.height === height && previous.keyboard === keyboard
          ? previous
          : { height, keyboard },
      );
    };
    update();
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, []);
  return state;
}

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

/**
 * What each tab holds that can grow while you're looking elsewhere, so it can show a dot: the
 * Objectives tab's ticks and messages, and the Board's pins.
 */
function tabContent(run: CaseRunState): Readonly<Record<PaneId, number>> {
  return {
    objectives: run.completed.length + run.story.length,
    evidence: 0,
    timeline: 0,
    board: run.pins.length,
  };
}

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
 * The workspace (docs/plan/05-workspace-ui.md §Workspace layout, redrawn by UIUX.md §6). It fills
 * the screen below the app's top bar, so the page itself never scrolls: the terminal and each pane
 * scroll on their own.
 *
 * - A compact header: the case's title (the top bar carries the breadcrumb and the one SIMULATED
 *   marker), a progress ring, Ask Noor, and a "⋯ Case" menu holding Start the case again, away
 *   from eye level and still behind its confirm dialog.
 * - The Now strip: the current objective, why on demand, a free hint, and the team's newest line.
 * - From 1024 px: the terminal on the left and the tabbed panes on the right (Objectives, Evidence,
 *   Timeline, Board), with a handle between them (drag it, or use the arrow keys). Focus pane
 *   gives the pane the whole width and turns the terminal into a drawer over it (Esc closes it,
 *   and focus goes back to the button that opened it).
 * - Below 1024 px: one view at a time, with a tab bar along the bottom (the terminal is the first
 *   tab). The workspace follows the visible height, so an on-screen keyboard never hides the
 *   prompt; while one is up, the tab bar and the Now strip's extras step aside.
 *
 * The terminal never unmounts while the layout stays the same (Focus pane and its drawer only
 * restyle it), so a half-typed line survives; a pane stays mounted once opened, so it keeps its
 * place. The Board tab counts its pins, and a tab that gained something while you were elsewhere
 * shows a dot until you look.
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
  const visible = useVisibleHeight();
  const keyboard = !desktop && visible.keyboard;
  const [pane, setPane] = useState<PaneId>("objectives");
  const [view, setView] = useState<ViewId>("objectives");
  const [opened, setOpened] = useState<readonly PaneId[]>(["objectives"]);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [ratio, setRatio] = useState(50);
  const [focusPane, setFocusPane] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const baseId = useId();
  const tabRefs = useRef(new Map<ViewId, HTMLButtonElement>());
  const terminalRef = useRef<HTMLDivElement>(null);
  const { done, total } = caseProgress(caseDef, run.completed);
  // The step the player is on, so a hint or an explanation has the right context.
  const objectiveId = currentObjective(caseDef, run)?.id;

  const tabs: readonly ViewId[] = desktop ? PANE_ORDER : ["terminal", ...PANE_ORDER];
  const selected: ViewId = desktop || view !== "terminal" ? pane : "terminal";
  const label = (id: ViewId) => (id === "terminal" ? "Terminal" : PANE_LABELS[id]);
  // Focus pane is a wide-screen layout; on a phone every view already has the whole width.
  const drawer = desktop && focusPane;
  const drawerButtonId = `${baseId}-drawer-button`;

  // A dot on a tab that gained something since the player last had it open (adjusting state
  // while rendering: the tab they're on is always seen, and a count that drops resets).
  const content = tabContent(run);
  const [seen, setSeen] = useState(content);
  const stale = PANE_ORDER.filter(
    (id) => seen[id] !== content[id] && (id === selected || content[id] < seen[id]),
  );
  if (stale.length > 0) {
    setSeen({ ...seen, ...Object.fromEntries(stale.map((id) => [id, content[id]])) });
  }
  const fresh = (id: ViewId) => id !== "terminal" && id !== selected && content[id] > seen[id];

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

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    document.getElementById(drawerButtonId)?.focus();
  }, [drawerButtonId]);

  // The drawer puts the player at the prompt when it opens.
  useEffect(() => {
    if (!drawer || !drawerOpen) return;
    terminalRef.current?.querySelector<HTMLElement>('[aria-label^="Command"]')?.focus();
  }, [drawer, drawerOpen]);

  const onDrawerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The terminal uses Escape itself while searching its history; that press stays there.
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    closeDrawer();
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

  // "Show in terminal": the command goes to the prompt, unrun, and the terminal comes into view
  // (its drawer, while a pane has the focus).
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
        setDrawerOpen(true);
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

  const viewTabs = (placement: "top" | "bottom") => (
    <ViewTabs
      tabs={tabs}
      selected={selected}
      label={label}
      tabId={tabId}
      panelId={panelId}
      tabRefs={tabRefs}
      onSelect={select}
      onKeyDown={onTabKeyDown}
      placement={placement}
      pins={run.pins.length}
      fresh={fresh}
      hidden={placement === "bottom" && keyboard}
    />
  );

  const terminal = (
    <div
      ref={terminalRef}
      id={panelId("terminal")}
      {...(!desktop && { role: "tabpanel", "aria-labelledby": tabId("terminal") })}
      {...(drawer && { role: "dialog", "aria-label": "Terminal", "aria-modal": false })}
      hidden={desktop ? drawer && !drawerOpen : selected !== "terminal"}
      onKeyDown={drawer ? onDrawerKeyDown : undefined}
      className={cx(
        "h-full min-w-0",
        drawer &&
          "absolute inset-y-0 left-0 z-30 flex w-[min(46rem,94%)] animate-fade-in flex-col gap-2 rounded-xl border border-strong bg-surface-base p-2 shadow-2xl",
      )}
    >
      {drawer && (
        <div className="flex shrink-0 items-center justify-between gap-3 pl-2">
          <p className="type-small text-secondary">The terminal, over the pane. Esc closes it.</p>
          <Button variant="ghost" size="sm" onClick={closeDrawer}>
            Close the terminal
          </Button>
        </div>
      )}
      <Terminal
        session={session}
        // A containing block, so the terminal's screen-reader-only text stays inside its own
        // scrolling box instead of stretching the page.
        className={cx("relative h-full", drawer && "min-h-0 flex-1")}
        outputClassName="min-h-0 flex-1"
        suggestions={objectiveSuggestions(caseDef, run)}
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
  );

  const panels = PANE_ORDER.map((id) => {
    const Pane = PANE_COMPONENTS.get(id);
    return (
      <div
        key={id}
        role="tabpanel"
        id={panelId(id)}
        aria-labelledby={tabId(id)}
        hidden={selected !== id}
        // Reaches the pane's text from the keyboard, and scrolls it with the arrow keys.
        tabIndex={0}
        className={cx(
          "relative h-full overflow-y-auto overscroll-contain rounded-md",
          desktop ? "pt-4 pr-2 pb-4" : "px-0.5 pb-4",
          FOCUS_RING,
        )}
      >
        {!opened.includes(id) ? null : Pane ? (
          <Suspense fallback={<PaneLoading label={PANE_LABELS[id]} />}>
            <Pane {...propsFor(id)} />
          </Suspense>
        ) : (
          <LaterPane id={id} onShowObjectives={() => select("objectives")} />
        )}
      </div>
    );
  });

  return (
    <div
      // Takes the whole of <main> (cancelling the shell's padding: pt-8 pb-8, lg:py-12, and
      // px-4 / sm:px-6 / lg:px-10) and exactly the height below the 4rem top bar, so the page never
      // scrolls. On a phone that height is what's visible above the keyboard.
      className="-mx-4 -mt-8 -mb-8 flex flex-col gap-3 px-3 pt-3 pb-2 sm:-mx-6 sm:px-4 lg:-mx-10 lg:-my-12 lg:min-h-[34rem] lg:px-5 lg:pb-4"
      style={{
        height:
          !desktop && visible.height !== undefined
            ? `calc(${visible.height}px - 4rem)`
            : "calc(100dvh - 4rem)",
      }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="min-w-0 type-section-title text-balance outline-none"
        >
          {caseDef.title}
        </h1>
        <div className="flex items-center gap-2">
          <ProgressRing size="sm" value={done} max={total} label="Objectives done" />
          {/* The ring is the accessible count; this says it in words for everyone else. */}
          <span aria-hidden="true" className="type-small text-secondary">
            {done} of {total} objectives done
          </span>
        </div>
        {saveStatus !== "blocked" && (
          <StorageBanner status={saveStatus} className="hidden sm:block" />
        )}
        <div className="ml-auto flex items-center gap-1">
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
          <Menu
            label="Case"
            items={[
              {
                id: "restart",
                label: "Start the case again",
                tone: "danger",
                onSelect: () => setConfirmRestart(true),
              },
            ]}
          />
        </div>
      </header>

      {saveStatus === "blocked" && <StorageBanner status={saveStatus} className="shrink-0" />}

      <NowStrip caseDef={caseDef} run={run} dispatch={dispatch} compact={keyboard} />

      {desktop ? (
        <div className="relative min-h-0 flex-1">
          <SplitPane
            label="Resize the terminal and the case views"
            // Focus pane: the terminal's share goes to nothing (it lives in the drawer), and the
            // handle steps aside.
            ratio={focusPane ? 0 : ratio}
            onRatioChange={(next) => {
              if (!focusPane) setRatio(next);
            }}
            min={focusPane ? 0 : 25}
            max={focusPane ? 0 : 75}
            className={cx("h-full", focusPane && "[&>[role=separator]]:hidden")}
            start={terminal}
            end={
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex shrink-0 items-end gap-2 border-b border-subtle">
                  <div className="min-w-0 flex-1">{viewTabs("top")}</div>
                  <div className="flex shrink-0 items-center gap-1 pb-1.5">
                    {focusPane && (
                      <Button
                        id={drawerButtonId}
                        variant="secondary"
                        size="sm"
                        icon={<TerminalIcon />}
                        aria-expanded={drawerOpen}
                        aria-controls={panelId("terminal")}
                        onClick={() => (drawerOpen ? closeDrawer() : setDrawerOpen(true))}
                      >
                        Terminal
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-pressed={focusPane}
                      icon={<FocusIcon />}
                      onClick={() => {
                        setFocusPane(!focusPane);
                        setDrawerOpen(false);
                      }}
                    >
                      Focus pane
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1">{panels}</div>
              </div>
            }
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="min-h-0 flex-1">
            {terminal}
            {panels}
          </div>
          {viewTabs("bottom")}
        </div>
      )}

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

/** Two arrows pointing apart: "give this more room". */
function FocusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
    </svg>
  );
}

/** Skeleton rows while a pane's code arrives, instead of a spinner and a sentence. */
function PaneLoading({ label }: { label: string }) {
  return <Skeleton label={`Opening ${label}…`} rows={5} className="py-2" />;
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
  /** Above the panes on a wide screen; along the bottom, thumb-high, on a phone. */
  placement: "top" | "bottom";
  /** How many pins the Board holds. */
  pins: number;
  /** Whether a tab gained something since the player last had it open. */
  fresh: (id: ViewId) => boolean;
  /** Steps aside (still mounted) while an on-screen keyboard is up. */
  hidden?: boolean;
}

/** Where the selected tab's bar sits, measured from the tab list's top left corner. */
interface IndicatorBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  /** False for the first placement, so the bar appears in place instead of sliding in. */
  readonly slide: boolean;
}

/**
 * The workspace's tab bar. Tab reaches the selected tab; the arrow keys move between tabs and
 * select as they go; Home and End jump to the ends. The selected tab's bar slides to the tab you
 * pick (fx-slide, instant under reduced motion); until it's measured, each tab draws its own.
 *
 * The Board shows its pin count, which pops when it changes, and a tab that gained something
 * while you were elsewhere shows a dot. Both are decoration for sighted players: the tab's name
 * stays its label, and a screen reader hears the same news as the tab's description.
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
  placement,
  pins,
  fresh,
  hidden = false,
}: ViewTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<IndicatorBox>();
  const bottom = placement === "bottom";

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || hidden) return;
    const place = () => {
      const tab = tabRefs.current.get(selected);
      if (!tab) return;
      const left = tab.offsetLeft + 8;
      const top = bottom ? tab.offsetTop : tab.offsetTop + tab.offsetHeight - 2;
      const width = Math.max(0, tab.offsetWidth - 16);
      setIndicator((previous) =>
        previous?.left === left && previous.top === top && previous.width === width
          ? previous
          : { left, top, width, slide: previous !== undefined },
      );
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [selected, tabs, bottom, hidden, tabRefs]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Workspace views"
      onKeyDown={onKeyDown}
      hidden={hidden}
      data-indicator={indicator === undefined ? undefined : "ready"}
      className={cx(
        "group/views relative",
        bottom
          ? "grid shrink-0 grid-flow-col rounded-lg border border-subtle bg-surface-raised pb-[env(safe-area-inset-bottom)]"
          : "flex gap-1",
      )}
    >
      {tabs.map((id) => {
        const isFresh = fresh(id);
        const count = id === "board" && pins > 0 ? pins : undefined;
        const news = [
          count !== undefined && `${count} pinned`,
          isFresh && "new since you last looked",
        ].filter(Boolean);
        const descriptionId = `${tabId(id)}-news`;
        return (
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
            aria-describedby={news.length > 0 ? descriptionId : undefined}
            tabIndex={id === selected ? 0 : -1}
            onClick={() => onSelect(id)}
            className={cx(
              "relative flex shrink-0 items-center justify-center gap-1.5 font-medium text-secondary",
              "hover:bg-surface-overlay hover:text-primary aria-selected:text-primary",
              bottom
                ? "min-h-12 rounded-md px-1 text-xs"
                : "-mb-px rounded-t-md px-3 pt-2 pb-2.5 text-sm",
              // The bar marks the selected tab without relying on colour alone.
              "after:absolute after:inset-x-2 after:h-0.5 after:rounded-full aria-selected:after:bg-accent",
              bottom ? "after:top-0" : "after:bottom-0",
              // Once measured, the one sliding bar below takes over.
              "group-data-[indicator=ready]/views:after:bg-transparent",
              FOCUS_RING,
            )}
          >
            {label(id)}
            {count !== undefined && <TabCount value={count} />}
            {isFresh && (
              <span
                aria-hidden="true"
                className="size-2 animate-badge-pop rounded-full bg-accent"
              />
            )}
            {news.length > 0 && (
              <span id={descriptionId} hidden>
                {news.join(", ")}
              </span>
            )}
          </button>
        );
      })}
      {indicator !== undefined && (
        <span
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute top-0 left-0 h-0.5 rounded-full bg-accent",
            indicator.slide && "fx-slide",
          )}
          style={{ translate: `${indicator.left}px ${indicator.top}px`, width: indicator.width }}
        />
      )}
    </div>
  );
}

/** The Board's pin count. It pops once each time it changes, not when the workspace opens. */
function TabCount({ value }: { value: number }) {
  const [previous, setPrevious] = useState(value);
  const [changed, setChanged] = useState(false);
  if (value !== previous) {
    setPrevious(value);
    setChanged(true);
  }
  return (
    <span
      // A new key restarts the pop for every change.
      key={value}
      aria-hidden="true"
      className={cx(
        "min-w-5 rounded-full border border-strong bg-surface-overlay px-1.5 text-center font-mono text-xs leading-5 text-primary tabular-nums",
        changed && "animate-badge-pop",
      )}
    >
      {value}
    </span>
  );
}
