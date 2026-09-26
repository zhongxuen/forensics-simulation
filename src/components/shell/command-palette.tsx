"use client";

import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type KeyboardEvent,
  type Ref,
} from "react";
import { BookOpenIcon, InfoIcon, PlayIcon, SearchIcon, TerminalIcon } from "@/components/ui/icons";
import { useSearchIndex } from "@/hooks/use-search-index";
import { APP_SECTIONS } from "@/lib/app-sections";
import { searchCommands, type SearchableCommand } from "@/lib/command-search";
import { cx } from "@/lib/cx";
import { searchIndex, SEARCH_KIND_LABELS, type SearchKind } from "@/lib/search";
import { useGuardedNavigate } from "./leave-guard";
import { START_HERE_LABEL, type NextStep } from "@/lib/next-step";
import { SECTION_ICONS } from "./icons";
import { FOCUS_RING } from "./shell-styles";

type PaletteGroup = "Start" | "Go to" | (typeof SEARCH_KIND_LABELS)[SearchKind];

interface PaletteCommand extends SearchableCommand {
  readonly group: PaletteGroup;
  readonly href: string;
  readonly icon: ComponentType<{ className?: string }>;
}

const GROUP_ORDER: readonly PaletteGroup[] = [
  "Start",
  "Go to",
  SEARCH_KIND_LABELS.lesson,
  SEARCH_KIND_LABELS.term,
  SEARCH_KIND_LABELS.command,
];

const KIND_ICONS: Readonly<Record<SearchKind, ComponentType<{ className?: string }>>> = {
  lesson: BookOpenIcon,
  term: InfoIcon,
  command: TerminalIcon,
};

/** Lessons, glossary words and commands shown per group, so every group stays in view. */
const RESULTS_PER_KIND = 5;

function buildCommands(nextStep: NextStep): PaletteCommand[] {
  return [
    {
      id: "start-here",
      group: "Start",
      label: `${nextStep.label ?? START_HERE_LABEL}: ${nextStep.title}`,
      description: nextStep.detail,
      keywords: ["begin", "first mission", "continue"],
      href: nextStep.href,
      icon: PlayIcon,
    },
    ...APP_SECTIONS.map((section): PaletteCommand => ({
      id: section.id,
      group: "Go to",
      label: section.label,
      description: section.subtitle,
      keywords: section.keywords,
      href: section.href,
      icon: SECTION_ICONS[section.id],
    })),
  ];
}

/** ⌘K on Apple devices, Ctrl+K everywhere else. Decided after hydration, so the server says Ctrl. */
function useIsApple(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
}

export function isPaletteShortcut(event: globalThis.KeyboardEvent): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "k"
  );
}

export interface CommandPaletteHandle {
  open: () => void;
}

interface CommandPaletteProps {
  nextStep: NextStep;
  ref?: Ref<CommandPaletteHandle>;
}

/**
 * Jump anywhere in the app by typing: ⌘K / Ctrl+K, or the Search button in the top bar.
 *
 * A modal <dialog> (focus stays inside, Escape closes, focus returns to where it was) holding a
 * combobox: type to filter, ↑/↓ to move, Enter to go. With something typed, it also searches every
 * lesson, glossary word and command manual page (md-files/09-learning-center.md, prompt 09.5),
 * from a small index built with the app and loaded the first time the palette opens.
 *
 * The shortcut ignores key presses something else already handled (event.defaultPrevented), so
 * the terminal (phase 05) keeps Ctrl+K for "delete to end of line" by preventing it while focused.
 */
export function CommandPalette({ nextStep, ref }: CommandPaletteProps) {
  const navigate = useGuardedNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [everOpened, setEverOpened] = useState(false);
  const index = useSearchIndex(everOpened);
  const id = useId();
  const listId = `${id}-list`;

  const commands = buildCommands(nextStep);
  const found: PaletteCommand[] =
    index.state === "ready"
      ? searchIndex(index.entries, query, { perKind: RESULTS_PER_KIND }).map((entry) => ({
          id: entry.id,
          group: SEARCH_KIND_LABELS[entry.kind],
          label: entry.title,
          description: entry.summary,
          href: entry.href,
          icon: KIND_ICONS[entry.kind],
        }))
      : [];
  const groups = GROUP_ORDER.map((group, order) => ({
    group,
    // An id-safe name for the group's heading ("Go to" has a space).
    key: `g${order}`,
    items: [...searchCommands(commands, query), ...found].filter(
      (command) => command.group === group,
    ),
  })).filter(({ items }) => items.length > 0);
  // Results show grouped, so the arrow keys follow the order on screen.
  const results = groups.flatMap(({ items }) => items);
  const active = results[Math.min(activeIndex, results.length - 1)];
  const searching = query.trim() !== "" && index.state === "loading";

  const open = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setActiveIndex(0);
    setEverOpened(true);
    dialog.showModal();
    inputRef.current?.focus();
  };
  const close = () => dialogRef.current?.close();

  useImperativeHandle(ref, () => ({ open }));

  // The shortcut listener is set up once; this keeps it calling the latest `open`.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || !isPaletteShortcut(event)) return;
      event.preventDefault();
      if (dialogRef.current?.open) dialogRef.current.close();
      else openRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (command: PaletteCommand | undefined) => {
    if (!command) return;
    // Focus goes to the new page, not back to the button that opened the palette.
    returnFocusRef.current = null;
    close();
    // Inside a mission run this asks "Leave this mission?" first (leave-guard.tsx).
    navigate(command.href);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = results.length - 1;
    const current = Math.min(activeIndex, last);
    const moves: Record<string, number | undefined> = {
      ArrowDown: current >= last ? 0 : current + 1,
      ArrowUp: current <= 0 ? last : current - 1,
      Home: event.ctrlKey ? 0 : undefined,
      End: event.ctrlKey ? last : undefined,
    };
    const next = moves[event.key];
    if (next !== undefined && results.length > 0) {
      event.preventDefault();
      setActiveIndex(next);
      document
        .getElementById(`${id}-option-${results[next]?.id}`)
        ?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(active);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search the app"
      onClose={() => {
        returnFocusRef.current?.focus();
        returnFocusRef.current = null;
      }}
      // A click on the dialog element itself, not its contents, is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border border-strong bg-surface-overlay p-0 text-primary shadow-2xl backdrop:bg-surface-base/80 open:animate-fade-in"
    >
      {/* The field's focus indicator is this row's accent underline, not an outline. */}
      <div className="flex items-center gap-3 border-b border-subtle px-4 focus-within:shadow-[inset_0_-2px_0_var(--focus-ring)]">
        <SearchIcon className="size-5 shrink-0 text-muted" />
        <label htmlFor={`${id}-input`} className="sr-only">
          Search lessons, words and commands, or pick a place to go
        </label>
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active ? `${id}-option-${active.id}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search, or pick a place to go"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onInputKeyDown}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-primary outline-none placeholder:text-muted"
        />
        <kbd className="hidden rounded border border-strong px-1.5 py-0.5 font-mono text-xs text-secondary sm:block">
          Esc
        </kbd>
      </div>

      <div
        id={listId}
        role="listbox"
        aria-label="Results"
        className="max-h-[50vh] overflow-y-auto p-2"
      >
        {groups.map(({ group, key, items }) => (
          <div key={group} role="group" aria-labelledby={`${id}-group-${key}`} className="py-1">
            <p
              id={`${id}-group-${key}`}
              className="px-3 pt-1 pb-1.5 text-xs font-semibold tracking-wide text-muted uppercase"
            >
              {group}
            </p>
            {items.map((command) => {
              const selected = command === active;
              const Icon = command.icon;
              return (
                <div
                  key={command.id}
                  id={`${id}-option-${command.id}`}
                  role="option"
                  aria-selected={selected}
                  onPointerMove={() => setActiveIndex(results.indexOf(command))}
                  onClick={() => go(command)}
                  className={cx(
                    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2",
                    selected ? "bg-accent-subtle text-primary" : "text-secondary",
                  )}
                >
                  <Icon
                    className={cx("size-5 shrink-0", selected ? "text-accent" : "text-muted")}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{command.label}</span>
                    {command.description && (
                      <span className="block truncate text-sm text-muted">
                        {command.description}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {searching && <p className="px-3 py-2 text-sm text-muted">Looking through the lessons…</p>}
        {index.state === "failed" && query.trim() !== "" && (
          <p className="px-3 py-2 text-sm text-muted">
            Lessons, words and commands couldn&apos;t load right now. The places above still work.
          </p>
        )}
        {results.length === 0 && !searching && (
          <p className="px-3 py-6 text-center leading-6 text-secondary">
            Nothing matches &ldquo;{query.trim()}&rdquo;. Try a word like port, a command like ls,
            or a section like Missions.
          </p>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {results.length === 1 ? "1 result" : `${results.length} results`}
      </p>

      <p className="hidden gap-4 border-t border-subtle px-4 py-2.5 text-xs text-muted sm:flex">
        <span>
          <Key>↑</Key> <Key>↓</Key> to move
        </span>
        <span>
          <Key>Enter</Key> to open
        </span>
        <span>
          <Key>Esc</Key> to close
        </span>
      </p>
    </dialog>
  );
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-strong px-1 font-mono text-secondary">{children}</kbd>
  );
}

interface SearchButtonProps {
  onClick: () => void;
}

/** The top bar's way into the palette, showing the shortcut so learners can find it. */
export function SearchButton({ onClick }: SearchButtonProps) {
  const apple = useIsApple();
  const shortcut = apple ? "⌘K" : "Ctrl K";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      className={cx(
        "flex h-10 shrink-0 items-center gap-2 rounded-md border border-subtle px-2.5 text-secondary hover:border-strong hover:bg-surface-raised hover:text-primary sm:pr-2",
        FOCUS_RING,
      )}
    >
      <SearchIcon className="size-5" />
      <span className="sr-only sm:not-sr-only sm:text-sm">Search</span>
      <kbd
        aria-hidden="true"
        className="hidden rounded border border-strong px-1.5 py-0.5 font-mono text-xs text-muted sm:block"
      >
        {shortcut}
      </kbd>
    </button>
  );
}
