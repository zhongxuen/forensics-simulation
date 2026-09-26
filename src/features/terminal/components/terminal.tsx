"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Menu } from "@/components/ui/menu";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import { cx } from "@/lib/cx";
import { useSettings } from "@/lib/settings";
import { announceBlock } from "../a11y/announce";
import type { TerminalExplainRequest } from "../beginner/explain-request";
import { completesStep, successText, TERMINAL_TOUR } from "../beginner/tour";
import type { TerminalSession } from "../hooks/use-terminal-session";
import { plainTranscript, type TerminalBlock } from "../session/terminal-session";
import { CommandChips } from "./command-chips";
import { HelpMenu } from "./help-menu";
import { OutputBlock } from "./output-block";
import { PromptLabel } from "./prompt-label";
import { PromptInput } from "./prompt-input";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { TerminalTour, type TourProgress } from "./terminal-tour";

export interface TerminalProps {
  /** The session from useTerminalSession: the terminal only renders it and sends it lines. */
  session: TerminalSession;
  /** Shown in the header. Defaults to user@host. */
  title?: string;
  /** Suggested commands for the chips row. Defaults to ones that work where you are. */
  chips?: readonly string[];
  /**
   * Suggestions that follow what the learner is doing (a case's current objective): tool names,
   * never a hint's whole answer, with the ones already run successfully left out by the caller.
   * Given, they replace the chips, and an empty list hides the row. Left out, the chips work as
   * before.
   */
  suggestions?: readonly string[];
  /** Start the guided first-run tour when the terminal first shows (a mission's guidedTour). */
  startTour?: boolean;
  /** Change this number to start the tour again from a control outside the terminal. */
  tourRequest?: number;
  /** Extra controls in the header, before Help and the menu with Copy and Reset. */
  actions?: ReactNode;
  className?: string;
  /** Classes for the output area: its height, mostly. */
  outputClassName?: string;
  /**
   * "Explain this" (phase 10): when given, every command gets an Explain this button (and every
   * line a hover shortcut) that hands over what the learner pointed at, with the explanation the
   * terminal already has as a fallback. Whoever explains it is up to the caller.
   */
  onExplain?: (request: TerminalExplainRequest) => void;
  /**
   * Puts a line at the prompt without running it, and focuses the prompt: "Show in terminal" from
   * another view. Pass a new object (a new `id`) for each request.
   */
  fillRequest?: { readonly id: number; readonly line: string };
}

interface SearchState {
  readonly query: string;
  readonly match?: { readonly index: number; readonly line: string };
  /** What was at the prompt before the search started. */
  readonly saved: string;
}

/** The newest blocks are always laid out for real; older ones may skip it while off screen. */
const RECENT_BLOCKS = 4;

/** Keys that leave reverse search, keeping the match at the prompt. */
const ACCEPT_SEARCH_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Tab",
  "Home",
  "End",
]);

/**
 * The browser terminal: an output area and a prompt. It renders the session's screen and sends
 * lines to the session. It contains no simulation logic: commands, completion and suggestions
 * all come through the session (useTerminalSession), which is the only thing that talks to the
 * engine.
 *
 * Accessibility: the output area is a focusable, scrollable region of real text; a polite live
 * region reads each command's result (long output is summarised); every action has a keyboard
 * path; the cursor blink stops under reduced motion.
 */
export function Terminal({
  session,
  title,
  chips,
  suggestions,
  startTour = false,
  tourRequest,
  actions,
  className,
  outputClassName = "h-[26rem]",
  onExplain,
  fillRequest,
}: TerminalProps) {
  const { beginnerMode, promptStyle, cursorStyle } = useSettings();
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState<SearchState | null>(null);
  const [choices, setChoices] = useState<readonly string[]>([]);
  const [tabLeaves, setTabLeaves] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [tour, setTour] = useState<TourProgress | null>(startTour ? { index: 0 } : null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  // A new tour request from outside starts the tour from the top.
  const [seenTourRequest, setSeenTourRequest] = useState(tourRequest);
  if (tourRequest !== seenTourRequest) {
    setSeenTourRequest(tourRequest);
    setTour({ index: 0 });
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const pendingCursor = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastScrollTop = useRef(0);
  const hintId = useId();
  const outputId = useId();

  const { blocks, prompt } = session;

  // One stable callback for every block, so a new function from the caller never redraws them.
  const explainRef = useRef(onExplain);
  useEffect(() => {
    explainRef.current = onExplain;
  }, [onExplain]);
  const explain = useCallback(
    (request: TerminalExplainRequest) => explainRef.current?.(request),
    [],
  );
  const canExplain = onExplain !== undefined;
  const ghost = search ? "" : session.ghost(value, cursor);

  // Put the caret where a keyboard action asked for it, once the new value is on screen.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input && pendingCursor.current !== null) {
      input.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  });

  // Follow new output, unless the learner has scrolled up to read something.
  useLayoutEffect(() => {
    const output = outputRef.current;
    if (output && stickToBottom.current) output.scrollTop = output.scrollHeight;
  }, [blocks]);

  // Content also grows after it's added (an explanation opens, a font loads, an older block
  // settles its size): keep following it while the view is pinned to the bottom.
  useEffect(() => {
    const output = outputRef.current;
    const content = contentRef.current;
    if (!output || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) output.scrollTop = output.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const setLine = (line: string, at = line.length) => {
    setValue(line);
    setCursor(at);
    pendingCursor.current = at;
  };

  // Repeating the same announcement still gets read: the live region only reacts to changes.
  const announce = (text: string) =>
    setAnnouncement((previous) => (previous === text ? `${text} ` : text));

  const afterCommand = (block: TerminalBlock | undefined) => {
    setLine("", 0);
    setHistoryIndex(null);
    setDraft("");
    setChoices([]);
    setTabLeaves(false);
    stickToBottom.current = true;
    announce(block ? announceBlock(block, beginnerMode) : "Screen cleared.");
    if (block && tour) {
      const step = TERMINAL_TOUR[tour.index];
      if (step && completesStep(step, block.events)) {
        setTour({ index: tour.index + 1, success: successText(step, block.prompt.user) });
      }
    }
  };

  const run = (line: string) => afterCommand(session.submit(line));

  const hasSelection = (input: HTMLInputElement) =>
    (input.selectionStart ?? 0) !== (input.selectionEnd ?? 0) ||
    (typeof window !== "undefined" && (window.getSelection()?.toString() ?? "") !== "");

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>, current: SearchState) => {
    const ctrl = event.ctrlKey && !event.metaKey && !event.altKey;
    const key = event.key.toLowerCase();
    if (ctrl && key === "r") {
      event.preventDefault();
      const older = session.search(current.query, current.match?.index);
      setSearch({ ...current, match: older ?? current.match });
    } else if (event.key === "Enter") {
      event.preventDefault();
      setSearch(null);
      if (current.match) run(current.match.line);
      else setLine(current.saved);
    } else if (event.key === "Escape" || (ctrl && (key === "g" || key === "c"))) {
      event.preventDefault();
      setSearch(null);
      setLine(current.saved);
    } else if (ACCEPT_SEARCH_KEYS.has(event.key)) {
      event.preventDefault();
      setSearch(null);
      setLine(current.match?.line ?? current.saved);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (search) {
      onSearchKey(event, search);
      return;
    }
    const input = event.currentTarget;
    const at = input.selectionStart ?? value.length;
    const ctrl = event.ctrlKey && !event.metaKey && !event.altKey;
    const history = session.history;

    if (event.key === "Enter") {
      event.preventDefault();
      run(value);
    } else if (event.key === "ArrowUp" && !event.shiftKey) {
      if (history.length === 0) return;
      event.preventDefault();
      if (historyIndex === null) setDraft(value);
      const index = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(index);
      setLine(history[index] ?? "");
    } else if (event.key === "ArrowDown" && !event.shiftKey) {
      if (historyIndex === null) return;
      event.preventDefault();
      const index = historyIndex + 1;
      if (index >= history.length) {
        setHistoryIndex(null);
        setLine(draft);
      } else {
        setHistoryIndex(index);
        setLine(history[index] ?? "");
      }
    } else if (event.key === "Tab" && !event.shiftKey && !ctrl) {
      if (tabLeaves) {
        setTabLeaves(false); // Escape, then Tab: let focus move on
        return;
      }
      const suggestion = session.ghost(value, at);
      if (suggestion && at === value.length) {
        event.preventDefault();
        setLine(value + suggestion);
        setChoices([]);
        return;
      }
      if (value.trim() === "") return; // nothing to complete: Tab moves focus as usual
      event.preventDefault();
      const completion = session.complete(value, at);
      if (completion.input !== value) {
        setLine(completion.input, completion.cursor);
        setChoices([]);
      } else {
        setChoices(completion.choices);
      }
    } else if (event.key === "ArrowRight" && at === value.length && ghost) {
      event.preventDefault();
      setLine(value + ghost);
    } else if (event.key === "Escape") {
      setChoices([]);
      setTabLeaves(true);
    } else if (ctrl) {
      switch (event.key.toLowerCase()) {
        case "a":
          event.preventDefault();
          setLine(value, 0);
          break;
        case "e":
          event.preventDefault();
          setLine(value, value.length);
          break;
        case "k":
          event.preventDefault();
          setLine(value.slice(0, at), at);
          break;
        case "u":
          event.preventDefault();
          setLine(value.slice(at), 0);
          break;
        case "l":
          event.preventDefault();
          session.clear();
          announce("Screen cleared.");
          break;
        case "c":
          if (hasSelection(input)) return; // with text selected, Ctrl+C copies as usual
          event.preventDefault();
          session.interrupt(value);
          afterCommand(undefined);
          announce("Line cancelled.");
          break;
        case "r":
          event.preventDefault();
          setSearch({ query: "", saved: value });
          setLine("", 0);
          break;
      }
    }
  };

  const onChange = (next: string, at: number) => {
    setValue(next);
    setCursor(at);
    setChoices([]);
    setTabLeaves(false);
    if (search) setSearch({ ...search, query: next, match: session.search(next) });
  };

  const copyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(plainTranscript(blocks));
      setCopyStatus("Copied to your clipboard.");
    } catch {
      setCopyStatus(
        "Your browser blocked copying. Select the text in the terminal and copy it instead.",
      );
    }
    window.setTimeout(() => setCopyStatus(""), 4000);
  };

  const reset = () => {
    session.reset();
    stickToBottom.current = true;
    announce("The practice machine is back to how it started.");
    inputRef.current?.focus();
  };

  const fillPrompt = (command: string) => {
    setLine(command);
    setChoices([]);
    inputRef.current?.focus();
  };

  // A line from another view: at the prompt, ready for the learner to read, edit and run. The
  // line is set while rendering (like a tour request); focus and the caret follow once it's shown.
  const [seenFill, setSeenFill] = useState(fillRequest);
  if (fillRequest !== seenFill) {
    setSeenFill(fillRequest);
    if (fillRequest) {
      setValue(fillRequest.line);
      setCursor(fillRequest.line.length);
      setChoices([]);
      setHistoryIndex(null);
    }
  }
  useEffect(() => {
    const input = inputRef.current;
    if (!fillRequest || !input) return;
    input.focus();
    input.setSelectionRange(fillRequest.line.length, fillRequest.line.length);
  }, [fillRequest]);

  const chipCommands = suggestions ?? chips ?? session.suggestions;
  const lastId = blocks.at(-1)?.id;

  return (
    <section
      aria-label="Terminal"
      // The terminal is dark in both app themes: this keeps its header, menus and buttons on the
      // dark tokens too (src/styles/tokens.css).
      data-theme="dark"
      className={cx(
        "flex flex-col overflow-hidden rounded-xl border border-subtle bg-term-bg text-term-fg",
        className,
      )}
    >
      <header
        ref={headerRef}
        className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-subtle bg-surface-raised px-3 py-2 text-primary"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-status-success" />
          <h2 className="truncate font-mono text-sm font-semibold">
            {title ?? `${prompt.user}@${prompt.host}`}
          </h2>
          <SimulatedBadge size="sm" side="bottom" align="start" />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {actions}
          <HelpMenu
            items={[
              {
                id: "tour",
                label: "Take the terminal tour",
                onSelect: () => setTour({ index: 0 }),
              },
              {
                id: "shortcuts",
                label: "Keyboard shortcuts",
                onSelect: () => setShortcutsOpen(true),
              },
              { id: "commands", label: "List the commands", onSelect: () => fillPrompt("help") },
            ]}
          />
          <Menu
            label="More"
            items={[
              { id: "copy", label: "Copy transcript", onSelect: () => void copyTranscript() },
              { id: "reset", label: "Reset machine", onSelect: reset },
            ]}
          />
        </div>
        <p role="status" className="w-full text-sm text-secondary empty:hidden">
          {copyStatus}
        </p>
      </header>

      <div
        ref={outputRef}
        id={outputId}
        role="log"
        aria-live="off"
        aria-label="Terminal output"
        tabIndex={0}
        onScroll={(event) => {
          // Only the learner scrolling up stops the output following new lines. Blocks resizing
          // as they scroll out of view also fire scroll events, and those mustn't count.
          const el = event.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) stickToBottom.current = true;
          else if (el.scrollTop < lastScrollTop.current - 2) stickToBottom.current = false;
          lastScrollTop.current = el.scrollTop;
        }}
        onMouseUp={() => {
          // A click (not a text selection) in the output puts you back at the prompt.
          if ((window.getSelection()?.toString() ?? "") === "") inputRef.current?.focus();
        }}
        className={cx(
          "overflow-y-auto px-4 py-3 font-mono text-sm leading-6 break-words whitespace-pre-wrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
          outputClassName,
        )}
      >
        {blocks.length === 0 && (
          <p className="text-term-dim">
            Type a command and press Enter. New here? Type{" "}
            <span className="text-term-cyan">help</span>, or open Help and take the terminal tour.
          </p>
        )}
        <div ref={contentRef} className="space-y-2">
          {blocks.map((block, index) => (
            <OutputBlock
              key={block.id}
              block={block}
              beginnerMode={beginnerMode}
              promptStyle={promptStyle}
              latest={block.id === lastId}
              virtualize={index < blocks.length - RECENT_BLOCKS}
              {...(canExplain && { onExplain: explain })}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-subtle px-4 pt-2 pb-3 font-mono text-sm leading-6">
        {search && (
          <p role="status" className="text-term-dim">
            (reverse-i-search)&apos;<span className="text-term-fg">{search.query}</span>&apos;:{" "}
            <span className="text-term-fg">{search.match?.line ?? ""}</span>
          </p>
        )}
        {choices.length > 0 && (
          <p role="status" className="text-term-dim">
            <span className="sr-only">Choices: </span>
            {choices.join("  ")}
          </p>
        )}
        {beginnerMode && !search && <CommandChips commands={chipCommands} onPick={fillPrompt} />}
        <div ref={promptRef} className="flex items-baseline">
          <span aria-hidden="true" className="shrink-0 whitespace-pre">
            {search ? (
              "search: "
            ) : (
              <>
                <PromptLabel prompt={prompt} style={promptStyle} />{" "}
              </>
            )}
          </span>
          <PromptInput
            value={value}
            cursor={cursor}
            ghost={ghost}
            onChange={onChange}
            onCursor={setCursor}
            onKeyDown={onKeyDown}
            inputRef={inputRef}
            label={search ? "Search earlier commands" : `Command, in ${prompt.cwd}`}
            describedBy={hintId}
            cursorStyle={cursorStyle}
          />
        </div>
        <p
          id={hintId}
          className={cx("mt-1 font-sans text-xs text-term-dim", !beginnerMode && "sr-only")}
        >
          Enter runs a command · Tab finishes names · ↑ brings back earlier ones · Help lists
          shortcuts
        </p>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {tour && (
        <TerminalTour
          progress={tour}
          onNext={() => {
            const index = tour.index + 1;
            setTour({ index });
            // A step that asks you to type puts you at the prompt, ready to type.
            if (TERMINAL_TOUR[index]?.waitFor) {
              requestAnimationFrame(() => inputRef.current?.focus());
            }
          }}
          onEnd={() => {
            setTour(null);
            inputRef.current?.focus();
          }}
          headerRef={headerRef}
          promptRef={promptRef}
        />
      )}
    </section>
  );
}
