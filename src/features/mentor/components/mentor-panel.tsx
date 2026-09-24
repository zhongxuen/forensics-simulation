"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import { CharacterMessage } from "@/components/ui/character-message";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { BookOpenIcon, CloseIcon, InfoIcon, LightbulbIcon } from "@/components/ui/icons";
import { MENTOR } from "@/content/cast";
import { cx } from "@/lib/cx";
import { EXPLAIN_VIEW_LABELS, HINT_TIER_LABELS, HINT_TIERS } from "../protocol";
import {
  hintsFor,
  nextHintTier,
  nextHintUnlockAt,
  questionView,
  type ExplainQuestion,
  type MentorState,
} from "../session/mentor-store";
import { MENTOR_FIRST_NAME, MENTOR_SPEAKER, MentorBubble } from "./mentor-bubble";
import { CodeSpans, plainMentorText } from "./mentor-text";

/** One step, as the panel needs it. `RunnableCase`'s objectives satisfy this as they are. */
export interface MentorPanelObjective {
  readonly id: string;
  readonly description: string;
  readonly name?: string;
  readonly hidden?: boolean;
  /** Three authored tiers, or none for a secret (which is off the list until it's found). */
  readonly hints: readonly string[];
}

export interface MentorPanelCase {
  readonly id: string;
  readonly objectives: readonly MentorPanelObjective[];
}

export interface MentorPanelProps {
  open: boolean;
  onClose: () => void;
  caseDef: MentorPanelCase;
  /** Objectives ticked so far, so done steps say so. */
  completed: readonly string[];
  /** The step whose hints show. */
  objectiveId: string | undefined;
  onSelectObjective: (objectiveId: string) => void;
  state: MentorState;
  /** Show the next hint for this objective. The caller sends the transcript and counts it. */
  onAskHint: (objectiveId: string) => void;
  /** Opens the Reference, where any word can be looked up (and explained). */
  onOpenReference?: () => void;
}

/** Noor's welcome line, from docs/plan/99-reference.md §Story world. */
export const MENTOR_WELCOME =
  "Stuck is part of this job. Tell me what you've tried, and we'll find the next door together.";

export const HINTS_ARE_FREE = "Hints are free. Use as many as you like.";

/** The quoted question above an explanation: what the player pointed at. */
export function questionSummary(question: ExplainQuestion): ReactNode {
  if (question.kind === "term") {
    return (
      <>
        What does <strong className="font-semibold text-primary">{question.term}</strong> mean?
      </>
    );
  }
  if (question.kind === "row") {
    return (
      <>
        What does this row in {EXPLAIN_VIEW_LABELS[questionView(question)]} mean?
        {question.title && (
          <strong className="mt-1 block font-semibold text-primary">{question.title}</strong>
        )}
        <code className="mt-1 block font-mono text-xs break-words whitespace-pre-wrap text-primary">
          {question.text}
        </code>
      </>
    );
  }
  if (question.scope === "output") {
    return (
      <>
        What did <code className="font-mono text-primary">{question.command}</code> show?
      </>
    );
  }
  return (
    <>
      {question.error ? "What does this error mean?" : "What does this line mean?"}
      <code className="mt-1 block font-mono text-xs break-words whitespace-pre-wrap text-primary">
        {question.text}
      </code>
    </>
  );
}

/**
 * The mentor panel (docs/plan/14-mentor.md): Noor, in her own drawer over the side of the case
 * workspace. It never opens by itself — the player opens it (Ask Noor, Show me a hint, Explain
 * this, or the nudge chip), and the terminal stays exactly as it is, so they can keep typing while
 * it is open.
 *
 * Vendored from `../hacker-simulation/src/features/mentor/components/mentor-panel.tsx`
 * (VENDORED.md), taking the case's own objectives where the sibling took a `Mission`, and showing
 * back which of the four surfaces each explanation was asked from.
 *
 * - Hints for one step at a time, as progressive disclosure: tier 1 at once, each later tier after
 *   a short, calm cooldown. It says which hint they are on and that hints are free.
 * - Explanations the player asked for, each under the question they asked.
 * - When Noor's live help is off or busy, a quiet line says she is answering from her notes. The
 *   words are the same authored hints, still in her voice, never an error.
 *
 * It stays mounted while closed, so nothing in it is lost and nothing is fetched again.
 */
export function MentorPanel({
  open,
  onClose,
  caseDef,
  completed,
  objectiveId,
  onSelectObjective,
  state,
  onAskHint,
  onOpenReference,
}: MentorPanelProps) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const hintsListRef = useRef<HTMLOListElement>(null);
  const explanationsRef = useRef<HTMLOListElement>(null);

  // Opening moves focus into the panel; closing hands it back to whatever had it.
  useEffect(() => {
    if (open) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      headingRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onClose();
  };

  // Steps with hints: every objective except secrets, in case order.
  const steps = caseDef.objectives.filter(
    (objective) => objective.hidden !== true && objective.hints.length > 0,
  );
  const selected = steps.find((step) => step.id === objectiveId) ?? steps[0];
  const entries = selected ? hintsFor(state, selected.id) : [];
  const explanationCount = state.explanations.length;

  // Bring the newest hint or explanation into view when one arrives.
  useEffect(() => {
    if (open) hintsListRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [open, entries.length]);
  useEffect(() => {
    if (open) explanationsRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [open, explanationCount]);

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      hidden={!open}
      onKeyDown={onKeyDown}
      className="fixed top-16 right-0 bottom-0 z-30 flex w-full max-w-md animate-fade-in flex-col border-l border-strong bg-surface-raised text-primary shadow-2xl"
    >
      <header className="border-b border-subtle px-4 pt-3 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h2
            ref={headingRef}
            id={`${id}-title`}
            tabIndex={-1}
            className="text-lg font-semibold outline-none"
          >
            Ask {MENTOR_FIRST_NAME}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            label={`Close ${MENTOR_FIRST_NAME}'s panel`}
            icon={<CloseIcon />}
            onClick={onClose}
          />
        </div>
        <p className="text-sm leading-6 text-secondary">
          Your terminal stays exactly as it is, and you can keep typing in it.
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <CharacterMessage speaker={MENTOR_SPEAKER} tone={MENTOR.tone}>
          {MENTOR_WELCOME}
        </CharacterMessage>

        <p className="flex items-center gap-2 rounded-lg border border-accent bg-accent-subtle px-3 py-2 font-semibold text-primary">
          <LightbulbIcon className="size-4.5 shrink-0 text-accent" />
          {HINTS_ARE_FREE}
        </p>

        {state.lastReply?.mode === "fallback" && (
          <p className="flex gap-2 text-sm leading-6 text-secondary">
            <InfoIcon className="mt-1 size-4 shrink-0 text-status-info" />
            <span>
              {MENTOR_FIRST_NAME}&apos;s live help is resting right now, so the answers come from
              notes written ahead of time. The hints are the same; they&apos;re not tailored to what
              you typed.
            </span>
          </p>
        )}

        <section aria-labelledby={`${id}-hints`} className="space-y-3">
          <h3 id={`${id}-hints`} className="text-base font-semibold">
            Hints
          </h3>
          {steps.length === 0 || !selected ? (
            <p className="text-sm leading-6 text-secondary">This case has no hints.</p>
          ) : (
            <>
              {steps.length > 1 && (
                <div>
                  <label
                    htmlFor={`${id}-step`}
                    className="block text-sm font-semibold text-secondary"
                  >
                    Hints for
                  </label>
                  <select
                    id={`${id}-step`}
                    value={selected.id}
                    onChange={(event) => onSelectObjective(event.target.value)}
                    className={cx(
                      "mt-1 h-10 w-full rounded-md border border-strong bg-surface-base px-2 text-primary",
                      FOCUS_RING,
                    )}
                  >
                    {steps.map((step) => (
                      <option key={step.id} value={step.id}>
                        {plainMentorText(
                          step.name ? `${step.name}: ${step.description}` : step.description,
                        )}
                        {completed.includes(step.id) ? " (done)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {steps.length === 1 && (
                <p className="text-sm leading-6 text-secondary">
                  <CodeSpans text={selected.description} />
                </p>
              )}
              <HintLadder
                caseDef={caseDef}
                objectiveId={selected.id}
                done={completed.includes(selected.id)}
                state={state}
                entries={entries}
                onAskHint={onAskHint}
                listRef={hintsListRef}
              />
            </>
          )}
        </section>

        <section aria-labelledby={`${id}-explain`} className="space-y-3">
          <h3 id={`${id}-explain`} className="text-base font-semibold">
            Explanations
          </h3>
          {explanationCount === 0 ? (
            <p className="text-sm leading-6 text-secondary">
              Want something explained? Point at a line in the terminal, a row in the Evidence
              Browser, an entry on the timeline or a card on the case board, and choose{" "}
              <strong className="font-semibold text-primary">Explain</strong>. You can ask about any
              word in the Reference, too.
            </p>
          ) : (
            <ol ref={explanationsRef} className="space-y-4">
              {state.explanations.map((explanation) => (
                <li key={explanation.id} className="space-y-2">
                  <p className="ml-12 rounded-lg rounded-tr-sm border border-subtle bg-surface-overlay px-3 py-2 text-sm leading-6 text-secondary">
                    <span className="sr-only">You asked: </span>
                    {questionSummary(explanation.question)}
                  </p>
                  <MentorBubble reply={explanation} />
                </li>
              ))}
            </ol>
          )}
          {onOpenReference && (
            <Button variant="ghost" size="sm" icon={<BookOpenIcon />} onClick={onOpenReference}>
              Look up a word in the Reference
            </Button>
          )}
        </section>
      </div>

      {/* Read once when a reply's final words land, never while they stream in. The same words
          twice still change the region (a trailing space), so they're read again. */}
      <p aria-live="polite" className="sr-only">
        {state.lastReply
          ? `${MENTOR_FIRST_NAME} says: ${plainMentorText(state.lastReply.text)}${state.lastReply.id % 2 === 0 ? " " : ""}`
          : ""}
      </p>
    </section>
  );
}

/**
 * One step's hint ladder. Tier 1 is there at once; each later tier unlocks after a short cooldown,
 * shown as a calm countdown (never a penalty: hints are free). The button stays in place, and
 * focusable, while it waits, so focus never drops to the page.
 */
function HintLadder({
  caseDef,
  objectiveId,
  done,
  state,
  entries,
  onAskHint,
  listRef,
}: {
  caseDef: MentorPanelCase;
  objectiveId: string;
  done: boolean;
  state: MentorState;
  entries: MentorState["hints"][string];
  onAskHint: (objectiveId: string) => void;
  listRef: RefObject<HTMLOListElement | null>;
}) {
  const cooldownId = useId();
  const unlockAt = nextHintUnlockAt(state, objectiveId);
  const next = nextHintTier(state, caseDef, objectiveId);
  const [now, setNow] = useState(() => Date.now());

  // Tick a light clock only while a cooldown is counting down, so the countdown updates.
  useEffect(() => {
    if (unlockAt === undefined || next === undefined || Date.now() >= unlockAt) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= unlockAt) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [unlockAt, next]);

  const shown = entries.length;
  const current = entries.at(-1);
  // The clock only ticks during a cooldown, so right after a reveal it may be behind: the reveal
  // itself is the earliest "now" can be.
  const clock = Math.max(now, current?.shownAt ?? 0);
  const cooldownLeft = unlockAt === undefined ? 0 : Math.max(0, unlockAt - clock);
  const seconds = Math.ceil(cooldownLeft / 1000);

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-secondary">
        {shown === 0
          ? done
            ? "You've done this step. Its hints are still here if you're curious."
            : `No hints open for this step yet. Hint 1 is ${HINT_TIER_LABELS[1]}.`
          : current &&
            `You're on hint ${current.tier} of ${HINT_TIERS.length}: ${HINT_TIER_LABELS[current.tier]}.`}
      </p>

      {shown > 0 && (
        <ol ref={listRef} className="space-y-3" aria-label={`Hints from ${MENTOR_FIRST_NAME}`}>
          {entries.map((entry) => (
            <li key={entry.tier}>
              <MentorBubble
                reply={entry}
                label={`Hint ${entry.tier} of ${HINT_TIERS.length} · ${HINT_TIER_LABELS[entry.tier]}`}
              />
            </li>
          ))}
        </ol>
      )}

      {next === undefined ? (
        <p className="text-sm leading-6 text-secondary">
          That&apos;s every hint for this step. Still stuck? Ask {MENTOR_FIRST_NAME} to explain a
          line in the terminal or a row in one of the views, or look something up in the Reference.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            variant="secondary"
            size="sm"
            icon={<LightbulbIcon />}
            onClick={() => {
              if (cooldownLeft === 0) onAskHint(objectiveId);
            }}
            aria-disabled={cooldownLeft > 0 || undefined}
            aria-describedby={cooldownLeft > 0 ? cooldownId : undefined}
            className="aria-disabled:cursor-not-allowed aria-disabled:text-muted"
          >
            {shown === 0 ? "Show me a hint" : "Show me another hint"}
          </Button>
          {cooldownLeft > 0 && (
            <p id={cooldownId} className="text-sm leading-6 text-muted">
              Give this one a try.{" "}
              {/* The seconds tick for sighted players; a screen reader hears a steady sentence. */}
              <span aria-hidden="true">
                Hint {next} in {seconds} {seconds === 1 ? "second" : "seconds"}.
              </span>
              <span className="sr-only">The next hint is ready in a few seconds.</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
