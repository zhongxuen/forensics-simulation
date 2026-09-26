"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { CharacterMessage } from "@/components/ui/character-message";
import { Dialog } from "@/components/ui/dialog";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { LightbulbIcon } from "@/components/ui/icons";
import { getCastMember } from "@/content/cast";
import { cx } from "@/lib/cx";
import type { RunnableCase } from "../run/case-definition";
import {
  currentObjective,
  HINT_TIERS,
  type CaseRunAction,
  type CaseRunState,
  type StoryEntry,
} from "../run/case-run";
import { isCaseComplete } from "../run/evaluate";
import { CaseText } from "./case-text";

interface NowStripProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
  /**
   * An on-screen keyboard is up: keep to the objective itself, so the terminal keeps its room.
   * Why, the hint and the message come back when it goes.
   */
  compact?: boolean;
}

/**
 * "Now" (UIUX.md §2.5 and §6): the one strip under the workspace's header that always answers
 * "what do I do now?". It holds the current objective, why it matters on demand, the free hints
 * for it, and the team's newest message, which slides in here instead of pushing the checklist
 * down. "n earlier messages" opens the whole chat. Once every main objective is done, it says so
 * and carries the way on to the report.
 *
 * Hints are free: showing one only reveals the next authored tier, and nothing else reads it.
 */
export function NowStrip({ caseDef, run, dispatch, compact = false }: NowStripProps) {
  const id = useId();
  const objective = currentObjective(caseDef, run);
  const complete = isCaseComplete(caseDef, run.completed);
  const [whyFor, setWhyFor] = useState<string>();
  const [chatOpen, setChatOpen] = useState(false);
  const whyOpen = objective !== undefined && whyFor === objective.id;

  const shown = objective ? (run.hintsShown[objective.id] ?? 0) : 0;
  const tiers = objective ? Math.min(HINT_TIERS, objective.hints.length) : 0;
  const latestHint = objective && shown > 0 ? objective.hints[shown - 1] : undefined;

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="shrink-0 rounded-lg border border-accent/40 bg-accent-subtle px-3 py-2.5 sm:px-4"
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <h2 id={`${id}-title`} className="pt-1.5 type-eyebrow text-accent">
          Now
        </h2>
        {objective ? (
          <>
            <p
              className={cx(
                "min-w-0 flex-1 basis-56 type-body font-medium text-primary",
                compact && "line-clamp-2",
              )}
            >
              {objective.name && <span className="font-semibold">{objective.name}: </span>}
              <CaseText text={objective.description} />
            </p>
            <div hidden={compact} className="flex flex-wrap items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={whyOpen}
                aria-controls={`${id}-why`}
                onClick={() => setWhyFor(whyOpen ? undefined : objective.id)}
              >
                Why it matters
              </Button>
              {shown < tiers && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<LightbulbIcon />}
                  onClick={() => dispatch({ type: "hint", objectiveId: objective.id })}
                >
                  {shown === 0 ? "Show a hint" : "Show another hint"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 basis-56 type-body font-medium text-primary">
              {complete
                ? "Every main objective is done. Keep looking if you like, or write up what you found."
                : "Nothing to do right now."}
            </p>
            {complete && run.phase === "workspace" && (
              <Button variant="primary" size="sm" onClick={() => dispatch({ type: "report" })}>
                Write your report
              </Button>
            )}
          </>
        )}
      </div>

      {objective && (
        <div id={`${id}-why`} hidden={!whyOpen || compact} className="mt-2 max-w-prose">
          <p className="type-small text-secondary">
            <span className="font-semibold text-primary">Why: </span>
            <CaseText text={objective.why} />
          </p>
        </div>
      )}

      {/* The newest hint for this objective; every tier stays on the Objectives tab. */}
      <div aria-live="polite" hidden={compact}>
        {objective && latestHint !== undefined && (
          <p
            key={shown}
            className="mt-2 max-w-prose animate-rise-in rounded-md bg-surface-overlay px-3 py-2 type-small text-primary"
          >
            <span className="font-semibold text-accent">
              Hint {shown} of {tiers}:{" "}
            </span>
            <CaseText text={latestHint} />
          </p>
        )}
      </div>

      {!compact && <LatestMessage story={run.story} onOpenChat={() => setChatOpen(true)} />}

      <Dialog open={chatOpen} onClose={() => setChatOpen(false)} title="Team chat">
        <ol
          // Scrolls on its own when the story is long; focusable so the keyboard can scroll it.
          tabIndex={0}
          aria-label="Every message so far, oldest first"
          className={cx("max-h-[60vh] space-y-4 overflow-y-auto rounded-md pr-1", FOCUS_RING)}
        >
          {run.story.map((entry) => (
            <li key={entry.id}>
              <Message entry={entry} />
            </li>
          ))}
        </ol>
      </Dialog>
    </section>
  );
}

function Message({ entry }: { entry: StoryEntry }) {
  const speaker = getCastMember(entry.speaker);
  return (
    <CharacterMessage
      speaker={{
        name: speaker?.name ?? entry.speaker,
        ...(speaker && { role: speaker.role, initials: speaker.initials }),
      }}
      tone={speaker?.tone ?? "teammate"}
    >
      {entry.text}
    </CharacterMessage>
  );
}

interface LatestMessageProps {
  story: readonly StoryEntry[];
  onOpenChat: () => void;
}

/**
 * The team's newest line: one line on a phone, two or three from `sm` up. A message that arrives while the workspace is
 * open slides in (motion-scaled); the one already there when it opened just shows.
 */
function LatestMessage({ story, onOpenChat }: LatestMessageProps) {
  const latest = story.at(-1);
  const [firstSeen] = useState(latest?.id);
  if (!latest) return null;
  const speaker = getCastMember(latest.speaker);
  const earlier = story.length - 1;
  return (
    <div className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-accent/20 pt-2">
      {/* On a phone the message is one line beside its button, so the view below keeps its room. */}
      <div aria-live="polite" className="min-w-0 flex-1 basis-0 sm:basis-56">
        <p
          key={latest.id}
          className={cx(
            "line-clamp-1 type-small text-secondary sm:line-clamp-3 lg:line-clamp-2",
            latest.id !== firstSeen && "animate-rise-in",
          )}
        >
          <span className="font-semibold text-primary">{speaker?.name ?? latest.speaker}: </span>
          {latest.text}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onOpenChat}>
        {earlier === 0
          ? "Open the team chat"
          : `${earlier} earlier ${earlier === 1 ? "message" : "messages"}`}
      </Button>
    </div>
  );
}
