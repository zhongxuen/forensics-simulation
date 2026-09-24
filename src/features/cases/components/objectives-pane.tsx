"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { CharacterMessage } from "@/components/ui/character-message";
import { LightbulbIcon, MedalIcon } from "@/components/ui/icons";
import { ObjectiveTick } from "@/components/ui/objective-tick";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getCastMember } from "@/content/cast";
import { MAX_NOTES_LENGTH } from "@/lib/case-storage";
import { cx } from "@/lib/cx";
import { HINT_TIERS, visibleObjectives } from "../run/case-run";
import { caseProgress, isCaseComplete } from "../run/evaluate";
import type { WorkspacePaneProps } from "../workspace-panes";
import { CaseText } from "./case-text";

/**
 * The Objectives pane: the team's messages, the checklist with its free hints, the player's
 * notes, and, once every main objective is done, the way on to the report.
 */
export default function ObjectivesPane({ caseDef, run, dispatch }: WorkspacePaneProps) {
  const notesId = useId();
  const { done, total } = caseProgress(caseDef, run.completed);
  const complete = isCaseComplete(caseDef, run.completed);

  return (
    <div className="space-y-8">
      {run.story.length > 0 && (
        <section aria-labelledby={`${notesId}-chat`}>
          <h3 id={`${notesId}-chat`} className="text-sm font-semibold tracking-wide text-secondary">
            Team chat
          </h3>
          <ol className="mt-3 space-y-4" aria-live="polite">
            {run.story.map((entry) => {
              const speaker = getCastMember(entry.speaker);
              return (
                <li key={entry.id}>
                  <CharacterMessage
                    speaker={{
                      name: speaker?.name ?? entry.speaker,
                      ...(speaker && { role: speaker.role, initials: speaker.initials }),
                    }}
                    tone={speaker?.tone ?? "teammate"}
                  >
                    {entry.text}
                  </CharacterMessage>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section aria-labelledby={`${notesId}-objectives`}>
        <h3
          id={`${notesId}-objectives`}
          className="text-sm font-semibold tracking-wide text-secondary"
        >
          Objectives
        </h3>
        <ProgressBar
          value={done}
          max={total}
          label="Main objectives done"
          showValue
          className="mt-2"
        />

        <ul className="mt-4 space-y-5">
          {visibleObjectives(caseDef, run).map((objective) => {
            const ticked = run.completed.includes(objective.id);
            const shown = run.hintsShown[objective.id] ?? 0;
            return (
              <ObjectiveTick
                key={objective.id}
                bonus={objective.optional === true || objective.hidden === true}
                {...(ticked
                  ? { status: "done", success: <CaseText text={objective.success} /> }
                  : { status: "open" })}
                details={
                  !ticked && (
                    <div className="space-y-2 text-sm leading-6 text-secondary">
                      <p>
                        <span className="font-semibold text-primary">Why: </span>
                        <CaseText text={objective.why} />
                      </p>
                      {shown > 0 && (
                        <ol className="space-y-1.5" aria-label="Hints for this objective">
                          {objective.hints.slice(0, shown).map((hint, tier) => (
                            <li key={tier} className="rounded-md bg-surface-overlay px-3 py-2">
                              <span className="font-semibold text-accent">Hint {tier + 1}: </span>
                              <CaseText text={hint} />
                            </li>
                          ))}
                        </ol>
                      )}
                      {shown < Math.min(HINT_TIERS, objective.hints.length) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<LightbulbIcon />}
                          onClick={() => dispatch({ type: "hint", objectiveId: objective.id })}
                        >
                          {shown === 0 ? "Show a hint" : "Show another hint"}
                        </Button>
                      )}
                    </div>
                  )
                }
              >
                {objective.name && <span className="font-semibold">{objective.name}: </span>}
                <CaseText text={objective.description} />
              </ObjectiveTick>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-muted">Hints are free and never change anything else.</p>
      </section>

      {complete && run.phase === "workspace" && (
        <section
          aria-labelledby={`${notesId}-done`}
          className="flex flex-wrap items-center gap-4 rounded-xl border border-reward bg-surface-raised px-5 py-4"
        >
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-reward text-surface-base"
          >
            <MedalIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id={`${notesId}-done`} className="font-semibold text-reward">
              Every main objective is done!
            </h3>
            <p className="text-sm leading-6 text-secondary">
              Keep looking if you like, or write up what you found.
            </p>
          </div>
          <Button variant="primary" onClick={() => dispatch({ type: "report" })}>
            Write your report
          </Button>
        </section>
      )}

      <section>
        <label htmlFor={notesId} className="text-sm font-semibold tracking-wide text-secondary">
          Your notes
        </label>
        <p id={`${notesId}-help`} className="mt-1 text-sm text-muted">
          Anything you want to remember about this case.
        </p>
        <textarea
          id={notesId}
          aria-describedby={`${notesId}-help`}
          value={run.notes}
          maxLength={MAX_NOTES_LENGTH}
          onChange={(event) => dispatch({ type: "notes", text: event.target.value })}
          rows={5}
          className={cx(
            "mt-2 w-full rounded-md border border-strong bg-surface-base px-3 py-2 font-mono text-sm text-primary",
            FOCUS_RING,
          )}
        />
      </section>
    </div>
  );
}
