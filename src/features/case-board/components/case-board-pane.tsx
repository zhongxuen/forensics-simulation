"use client";

import { useEffect, useId, useMemo, useRef, useState, type ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { Icon, type IconProps } from "@/components/ui/icons";
import { Toast } from "@/components/ui/toast";
import { MAX_PIN_NOTE_LENGTH } from "@/lib/case-storage";
import { cx } from "@/lib/cx";
import { WORKSPACE_PANES, type WorkspacePaneProps } from "@/features/cases";
import {
  boardCards,
  groupBySource,
  showsInEvidenceBrowser,
  sortByTime,
  terminalCommandFor,
  type BoardCard,
  type CardSource,
} from "../model/cards";

type Layout = "source" | "time";

/** Where a pin came from, as an icon and a word: never the icon alone. */
const SOURCE: Readonly<Record<CardSource, { label: string; Icon: ComponentType<IconProps> }>> = {
  disk: { label: "Disk", Icon: DiskIcon },
  memory: { label: "Memory", Icon: MemoryIcon },
  log: { label: "Log", Icon: LogIcon },
};

/** A pin taken off the board a moment ago, until it's put back or something else happens. */
interface Removed {
  readonly ref: string;
  readonly title: string;
  readonly note: string;
}

/**
 * The Case Board pane (docs/plan/10-case-board-report-custody.md §Case Board): every pin as a
 * card, grouped by where it came from or sorted by time. Each card carries its note, and the
 * links that open the same artefact in the terminal, the Evidence Browser or the timeline. Pins
 * are kept by ref in the case run, so pinning the same thing twice is one card.
 *
 * Each card is drawn like the tag on an evidence bag: the ref on an evidence-tag badge, where it
 * came from, and its time in monospace. A card pinned while the board is open rises in; one
 * that's removed fades out, and the Undo toast that brings it back (note and all) slides up.
 */
export function CaseBoardPane({ run, dispatch, evidence, workstation }: WorkspacePaneProps) {
  const baseId = useId();
  const [layout, setLayout] = useState<Layout>("source");
  const [removed, setRemoved] = useState<Removed>();
  // The card on its way off the board: it fades, then its pin comes off.
  const [leaving, setLeaving] = useState<string>();
  // The pins already here when the board opened stay still; anything pinned after rises in,
  // including a card put back with Undo.
  const [still, setStill] = useState<ReadonlySet<string>>(() => new Set(run.pins));
  const undoRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasTimeline = WORKSPACE_PANES.some((pane) => pane.id === "timeline");

  const cards = useMemo(
    () => boardCards(run.pins, run.events, evidence, run.pinNotes),
    [run.pins, run.events, evidence, run.pinNotes],
  );

  const remove = (card: BoardCard) => {
    setLeaving(card.ref);
    setRemoved({ ref: card.ref, title: card.title, note: card.note });
    // The card is going, so focus goes to the one thing that brings it back.
    requestAnimationFrame(() => undoRef.current?.focus());
  };

  /** The card has faded: its pin comes off the board. */
  const left = (ref: string) => {
    setLeaving((current) => (current === ref ? undefined : current));
    setStill((previous) => new Set([...previous].filter((pin) => pin !== ref)));
    dispatch({ type: "unpin", ref });
  };

  const undo = () => {
    if (!removed) return;
    // Still fading: the pin never came off, so there's nothing to put back.
    if (leaving === removed.ref) setLeaving(undefined);
    else dispatch({ type: "pin", ref: removed.ref, ...(removed.note && { note: removed.note }) });
    setRemoved(undefined);
    headingRef.current?.focus();
  };

  const status = removed && (!run.pins.includes(removed.ref) || leaving === removed.ref) && (
    // Sticks to the bottom of the pane, so Undo is in sight wherever the list is scrolled.
    <div role="status" className="pointer-events-none sticky bottom-2 z-10 flex justify-end">
      <Toast
        tone="info"
        title="Taken off the board"
        description={
          <>
            <span className="font-mono break-all">{removed.title}</span>. Undo puts it back, note
            and all.
          </>
        }
        onDismiss={() => setRemoved(undefined)}
        action={
          <button
            ref={undoRef}
            type="button"
            onClick={undo}
            className={buttonClassName({ variant: "secondary", size: "sm", iconOnly: false })}
          >
            Undo
          </button>
        }
      />
    </div>
  );

  if (cards.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          titleAs="h3"
          title="Pinned evidence shows up here"
          description={
            <>
              You haven&apos;t pinned anything yet. Type <code className="font-mono">pin</code>{" "}
              after a command, or press <kbd className="font-mono">p</kbd> on a row.
            </>
          }
          action={
            <Button variant="secondary" onClick={() => workstation.show("evidence")}>
              Open the Evidence tab
            </Button>
          }
        />
        {status}
      </div>
    );
  }

  const renderCard = (card: BoardCard) => (
    <li key={card.ref}>
      <Card
        card={card}
        arriving={!still.has(card.ref)}
        leaving={leaving === card.ref}
        onLeft={() => left(card.ref)}
        onNote={(text) => dispatch({ type: "pinNote", ref: card.ref, text })}
        onRemove={() => remove(card)}
        terminalCommand={terminalCommandFor(card.ref, workstation.sim)}
        onShowInTerminal={(line) => workstation.showInTerminal(line)}
        {...(showsInEvidenceBrowser(card.ref) && {
          onShowInEvidence: () => workstation.show("evidence", card.ref),
        })}
        {...(hasTimeline && { onShowInTimeline: () => workstation.show("timeline", card.ref) })}
        {...(workstation.explain && {
          // The card as it is drawn, and nothing else: the mentor never receives the evidence set
          // (docs/plan/14-mentor.md §Spec). The fallback is the card's own words.
          onExplain: () =>
            workstation.explain?.({
              text: card.line,
              title: card.title,
              fallback: `This card is ${card.title}, pinned from ${card.groupLabel}${
                card.utc ? `, ${card.timeLabel?.toLowerCase() ?? "recorded"} ${card.utc}` : ""
              }. The line under it is what the evidence showed when you pinned it: ${card.line}`,
            }),
        })}
      />
    </li>
  );

  return (
    <div className="space-y-5">
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          id={`${baseId}-title`}
          className="text-lg font-semibold outline-none"
        >
          Case board
        </h3>
        <p className="mt-1 leading-7 text-secondary">
          Everything you&apos;ve pinned, and where it came from. Your report can only point at what
          is here, so pin anything an answer rests on.
        </p>
      </div>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Arrange the cards</legend>
        {(
          [
            ["source", "Group by source"],
            ["time", "Sort by time"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={cx(
              "cursor-pointer rounded-md border border-subtle px-3 py-1.5 text-sm has-checked:border-accent has-checked:bg-accent-subtle",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring",
            )}
          >
            <input
              type="radio"
              name={`${baseId}-layout`}
              value={value}
              checked={layout === value}
              onChange={() => setLayout(value)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
        <span className="text-sm text-muted">
          {cards.length === 1 ? "1 pin" : `${cards.length} pins`}
        </span>
      </fieldset>

      {layout === "time" ? (
        <ol className="space-y-3" aria-label="Pins, oldest first">
          {sortByTime(cards).map(renderCard)}
        </ol>
      ) : (
        groupBySource(cards).map((group) => (
          <section key={group.key} aria-labelledby={`${baseId}-${group.key}`}>
            <h4
              id={`${baseId}-${group.key}`}
              className="text-sm font-semibold tracking-wide text-secondary"
            >
              {group.label}
            </h4>
            <ol className="mt-2 space-y-3">{group.cards.map(renderCard)}</ol>
          </section>
        ))
      )}

      {status}
    </div>
  );
}

interface CardProps {
  card: BoardCard;
  /** Pinned since the board opened: the card rises in. */
  arriving: boolean;
  /** Removed: the card fades out, then `onLeft` takes its pin off. */
  leaving: boolean;
  onLeft: () => void;
  onNote: (text: string) => void;
  onRemove: () => void;
  terminalCommand: string | undefined;
  onShowInTerminal: (line: string) => void;
  onShowInEvidence?: () => void;
  onShowInTimeline?: () => void;
  /** "Explain this" on the card (docs/plan/14-mentor.md). Absent when the mentor isn't wired in. */
  onExplain?: () => void;
}

/**
 * One pin, drawn like the tag on an evidence bag: where it came from (an icon and a word), its
 * ref on an evidence-tag badge, its time in monospace, the line it was pinned from, and the note.
 */
function Card({
  card,
  arriving,
  leaving,
  onLeft,
  onNote,
  onRemove,
  terminalCommand,
  onShowInTerminal,
  onShowInEvidence,
  onShowInTimeline,
  onExplain,
}: CardProps) {
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  const source = SOURCE[card.source];

  // Once the fade has run (at once under reduced motion, or with no animation at all), the pin
  // comes off. The latest callback is kept, so a re-render mid-fade doesn't restart the wait.
  const onLeftRef = useRef(onLeft);
  useEffect(() => {
    onLeftRef.current = onLeft;
  }, [onLeft]);
  useEffect(() => {
    if (!leaving) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onLeftRef.current();
    };
    const running = ref.current?.getAnimations() ?? [];
    if (running.length === 0) finish();
    else void Promise.all(running.map((animation) => animation.finished)).then(finish, finish);
    return () => {
      done = true;
    };
  }, [leaving]);

  return (
    <article
      ref={ref}
      aria-labelledby={`${id}-title`}
      // A card on its way out can't be used any more.
      inert={leaving}
      className={cx(
        "relative rounded-lg border border-l-4 border-subtle border-l-accent bg-surface-raised py-3 pr-4 pl-5",
        leaving ? "animate-fade-out" : arriving && "animate-rise-in",
      )}
    >
      {/* The tag's eyelet. */}
      <span
        aria-hidden="true"
        className="absolute top-4 left-1.5 size-1.5 rounded-full border border-strong bg-surface-base"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-sm font-medium text-secondary">
          <source.Icon className="size-4 shrink-0 text-accent" />
          {source.label}
        </span>
        <Badge tone="evidence-tag" className="min-w-0">
          {card.ref}
        </Badge>
        {card.utc && (
          <span className="ml-auto text-sm text-secondary">
            {card.timeLabel}{" "}
            <time
              dateTime={new Date(card.at ?? 0).toISOString()}
              className="type-data text-primary"
            >
              {card.utc}
            </time>
          </span>
        )}
      </div>
      <h5 id={`${id}-title`} className="mt-2 type-data font-semibold break-all">
        {card.title}
      </h5>
      {card.local && (
        <p className="mt-1 text-sm text-secondary">
          <span className="type-data">{card.local}</span> on its own clock
        </p>
      )}
      <p className="mt-2 overflow-x-auto rounded-md bg-surface-overlay px-3 py-2 font-mono text-xs leading-5 whitespace-pre-wrap">
        {card.line}
      </p>
      {!card.found && (
        <p className="mt-2 text-xs text-muted">
          This isn&apos;t in the case&apos;s evidence, so no answer can rest on it.
        </p>
      )}

      <label htmlFor={`${id}-note`} className="mt-3 block text-sm font-semibold">
        Your note
      </label>
      <textarea
        id={`${id}-note`}
        value={card.note}
        maxLength={MAX_PIN_NOTE_LENGTH}
        rows={2}
        placeholder="What this shows, in your own words"
        onChange={(event) => onNote(event.target.value)}
        className={cx(
          "mt-1 w-full rounded-md border border-strong bg-surface-base px-3 py-2 text-sm text-primary",
          FOCUS_RING,
        )}
      />

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Show this pin elsewhere" role="group">
        {terminalCommand && (
          <Button variant="ghost" size="sm" onClick={() => onShowInTerminal(terminalCommand)}>
            Show in terminal
          </Button>
        )}
        {onShowInEvidence && (
          <Button variant="ghost" size="sm" onClick={onShowInEvidence}>
            Show in Evidence Browser
          </Button>
        )}
        {onShowInTimeline && (
          <Button variant="ghost" size="sm" onClick={onShowInTimeline}>
            Show in timeline
          </Button>
        )}
        {onExplain && (
          <Button variant="ghost" size="sm" onClick={onExplain}>
            Explain this
          </Button>
        )}
        <Button variant="danger" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </article>
  );
}

/** A drive: a disc in its case. */
function DiskIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </Icon>
  );
}

/** A memory capture: a chip and its pins. */
function MemoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
      <path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" />
    </Icon>
  );
}

/** A log: lines on a page. */
function LogIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5.5" y="3.5" width="13" height="17" rx="2" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </Icon>
  );
}
