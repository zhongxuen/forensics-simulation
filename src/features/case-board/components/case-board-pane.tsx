"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING } from "@/components/ui/focus-ring";
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

const SOURCE_BADGE: Readonly<Record<CardSource, { label: string; tone: BadgeTone }>> = {
  disk: { label: "Disk", tone: "info" },
  memory: { label: "Memory", tone: "accent" },
  log: { label: "Log", tone: "neutral" },
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
 * Removing a card can be undone: the pin comes back with its note.
 */
export function CaseBoardPane({ run, dispatch, evidence, workstation }: WorkspacePaneProps) {
  const baseId = useId();
  const [layout, setLayout] = useState<Layout>("source");
  const [removed, setRemoved] = useState<Removed>();
  const undoRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasTimeline = WORKSPACE_PANES.some((pane) => pane.id === "timeline");

  const cards = useMemo(
    () => boardCards(run.pins, run.events, evidence, run.pinNotes),
    [run.pins, run.events, evidence, run.pinNotes],
  );

  const remove = (card: BoardCard) => {
    dispatch({ type: "unpin", ref: card.ref });
    setRemoved({ ref: card.ref, title: card.title, note: card.note });
    // The card is gone, so focus goes to the one thing that brings it back.
    requestAnimationFrame(() => undoRef.current?.focus());
  };

  const undo = () => {
    if (!removed) return;
    dispatch({ type: "pin", ref: removed.ref, ...(removed.note && { note: removed.note }) });
    setRemoved(undefined);
    headingRef.current?.focus();
  };

  const status = removed && !run.pins.includes(removed.ref) && (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-subtle bg-surface-raised px-4 py-3"
    >
      <p className="min-w-0 leading-7">
        Took <span className="font-mono text-sm break-all">{removed.title}</span> off the board.
      </p>
      <button
        ref={undoRef}
        type="button"
        onClick={undo}
        className={buttonClassName({ variant: "secondary", size: "sm", iconOnly: false })}
      >
        Undo
      </button>
    </div>
  );

  if (cards.length === 0) {
    return (
      <div className="space-y-4">
        {status}
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
      </div>
    );
  }

  const renderCard = (card: BoardCard) => (
    <li key={card.ref}>
      <Card
        card={card}
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

      {status}

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
    </div>
  );
}

interface CardProps {
  card: BoardCard;
  onNote: (text: string) => void;
  onRemove: () => void;
  terminalCommand: string | undefined;
  onShowInTerminal: (line: string) => void;
  onShowInEvidence?: () => void;
  onShowInTimeline?: () => void;
  /** "Explain this" on the card (docs/plan/14-mentor.md). Absent when the mentor isn't wired in. */
  onExplain?: () => void;
}

/** One pin: where it came from, when, the line it was pinned from, its ref and the note. */
function Card({
  card,
  onNote,
  onRemove,
  terminalCommand,
  onShowInTerminal,
  onShowInEvidence,
  onShowInTimeline,
  onExplain,
}: CardProps) {
  const id = useId();
  const badge = SOURCE_BADGE[card.source];
  return (
    <article
      aria-labelledby={`${id}-title`}
      className="rounded-lg border border-subtle bg-surface-raised px-4 py-3"
    >
      <div className="flex flex-wrap items-start gap-2">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <h5 id={`${id}-title`} className="min-w-0 flex-1 font-mono text-sm leading-6 break-all">
          {card.title}
        </h5>
      </div>
      {card.utc && (
        <p className="mt-2 text-sm leading-6">
          <span className="text-secondary">{card.timeLabel} </span>
          <time dateTime={new Date(card.at ?? 0).toISOString()} className="font-mono">
            {card.utc}
          </time>
          {card.local && (
            <span className="text-secondary">
              {" "}
              (<span className="font-mono">{card.local}</span> on its own clock)
            </span>
          )}
        </p>
      )}
      <p className="mt-2 overflow-x-auto rounded-md bg-surface-overlay px-3 py-2 font-mono text-xs leading-5 whitespace-pre-wrap">
        {card.line}
      </p>
      <p className="mt-2 text-xs text-muted">
        <code className="font-mono break-all">{card.ref}</code>
        {!card.found && " · this isn't in the case's evidence, so no answer can rest on it"}
      </p>

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
