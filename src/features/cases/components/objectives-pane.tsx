"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { LightbulbIcon, MedalIcon } from "@/components/ui/icons";
import { ObjectiveTick } from "@/components/ui/objective-tick";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Tabs } from "@/components/ui/tabs";
import { MAX_NOTES_LENGTH } from "@/lib/case-storage";
import { cx } from "@/lib/cx";
import { custodyLog } from "../custody";
import type { CaseObjective } from "../run/case-definition";
import { currentObjective, HINT_TIERS, visibleObjectives } from "../run/case-run";
import { caseProgress, isCaseComplete } from "../run/evaluate";
import type { WorkspacePaneProps } from "../workspace-panes";
import { CaseText } from "./case-text";
import { CustodyList } from "./debrief/custody-list";

/**
 * The Objectives pane: two sub-tabs — the checklist, and the chain of custody so far (file 10) —
 * then, once every main objective is done, a word that the report is next, and the player's notes.
 *
 * The checklist puts "now" first (UIUX.md §2.5): the current objective expanded, with why it
 * matters and the hints shown so far; later ones as titles only; done ones collapsed to their
 * tick, with their success line a click away. The newest tick stays open, so its success line
 * lands as the reward while the next objective expands under it. Asking for a hint happens in the
 * Now strip above, and the team's messages live there too, so a new one never pushes this list
 * down. A bonus keeps its why and hints behind a disclosure, so it doesn't compete with "now".
 */
export default function ObjectivesPane({ caseDef, run, dispatch }: WorkspacePaneProps) {
  const notesId = useId();
  const { done, total } = caseProgress(caseDef, run.completed);
  const complete = isCaseComplete(caseDef, run.completed);
  const custody = useMemo(() => custodyLog(run.events, run.marks), [run.events, run.marks]);
  const current = currentObjective(caseDef, run);
  const newest = run.completed.at(-1);

  const checklist = (
    <section aria-labelledby={`${notesId}-objectives`}>
      <h3 id={`${notesId}-objectives`} className="type-eyebrow">
        Objectives
      </h3>
      <ProgressBar
        value={done}
        max={total}
        label="Main objectives done"
        showValue
        className="mt-2"
      />

      <ul className="mt-5 space-y-5">
        {visibleObjectives(caseDef, run).map((objective) => {
          const bonus = objective.optional === true || objective.hidden === true;
          const title = (
            <>
              {objective.name && <span className="font-semibold">{objective.name}: </span>}
              <CaseText text={objective.description} />
            </>
          );
          if (run.completed.includes(objective.id)) {
            return (
              <ObjectiveTick
                key={objective.id}
                bonus={bonus}
                status="done"
                success={
                  <DoneSuccess
                    id={`${notesId}-${objective.id}`}
                    startOpen={objective.id === newest}
                    text={objective.success}
                  />
                }
              >
                {title}
              </ObjectiveTick>
            );
          }
          if (objective.id === current?.id) {
            const shown = run.hintsShown[objective.id] ?? 0;
            return (
              <ObjectiveTick
                key={objective.id}
                bonus={bonus}
                status="current"
                details={
                  <div className="mt-2 space-y-2 type-small text-secondary">
                    <p>
                      <span className="font-semibold text-primary">Why: </span>
                      <CaseText text={objective.why} />
                    </p>
                    <HintList hints={objective.hints.slice(0, shown)} />
                    <p className="text-muted">
                      {shown === 0
                        ? "Stuck? Show a hint from the Now bar above."
                        : "Any hints left are in the Now bar above."}
                    </p>
                  </div>
                }
              >
                {title}
              </ObjectiveTick>
            );
          }
          return (
            <ObjectiveTick
              key={objective.id}
              bonus={bonus}
              status="open"
              {...(bonus && {
                details: <BonusDetails objective={objective} run={run} dispatch={dispatch} />,
              })}
            >
              {title}
            </ObjectiveTick>
          );
        })}
      </ul>
      <p className="mt-4 type-small text-muted">Hints are free and never change anything else.</p>
    </section>
  );

  return (
    <div className="space-y-8">
      <Tabs
        label="Objectives views"
        tabs={[
          { id: "checklist", label: "Checklist", content: checklist },
          {
            id: "custody",
            label: "Chain of custody",
            content: (
              <section aria-label="Chain of custody" className="space-y-3">
                <p className="type-small text-secondary">
                  Everything you&apos;ve done to the evidence so far, in order. It&apos;s built from
                  what the tools did, so it can&apos;t be edited, and it goes on your debrief.
                </p>
                <CustodyList log={custody} />
              </section>
            ),
          },
        ]}
      />

      {complete && run.phase === "workspace" && (
        <section
          aria-labelledby={`${notesId}-done`}
          className="flex items-center gap-4 rounded-xl border border-reward bg-surface-raised px-5 py-4"
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
            <p className="type-small text-secondary">
              Keep looking if you like. When you&apos;re ready, Write your report is in the Now bar
              above.
            </p>
          </div>
        </section>
      )}

      <section>
        <label htmlFor={notesId} className="type-eyebrow">
          Your notes
        </label>
        <p id={`${notesId}-help`} className="mt-1 type-small text-muted">
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

interface DoneSuccessProps {
  id: string;
  /** The newest tick starts open, so its success line lands as the reward. */
  startOpen: boolean;
  text: string;
}

/** A done objective's success line, behind a disclosure so the list stays short. */
function DoneSuccess({ id, startOpen, text }: DoneSuccessProps) {
  const [open, setOpen] = useState(startOpen);
  return (
    <span className="flex flex-col items-start gap-1">
      <span id={id} hidden={!open}>
        <CaseText text={text} />
      </span>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={cx(
          "rounded-sm type-small font-medium text-accent underline-offset-4 hover:underline",
          FOCUS_RING,
        )}
      >
        {open ? "Hide what you found" : "What you found"}
      </button>
    </span>
  );
}

function HintList({ hints }: { hints: readonly string[] }) {
  if (hints.length === 0) return null;
  return (
    <ol className="space-y-1.5" aria-label="Hints for this objective">
      {hints.map((hint, tier) => (
        <li key={tier} className="rounded-md bg-surface-overlay px-3 py-2 text-primary">
          <span className="font-semibold text-accent">Hint {tier + 1}: </span>
          <CaseText text={hint} />
        </li>
      ))}
    </ol>
  );
}

interface BonusDetailsProps {
  objective: CaseObjective;
  run: WorkspacePaneProps["run"];
  dispatch: WorkspacePaneProps["dispatch"];
}

/** A bonus that isn't done yet: its why and hints, on demand. */
function BonusDetails({ objective, run, dispatch }: BonusDetailsProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const shown = run.hintsShown[objective.id] ?? 0;
  return (
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={cx(
          "rounded-sm type-small font-medium text-accent underline-offset-4 hover:underline",
          FOCUS_RING,
        )}
      >
        {open ? "Hide why and hints" : "Why and hints"}
      </button>
      <div id={id} hidden={!open} className="mt-2 space-y-2 type-small text-secondary">
        <p>
          <span className="font-semibold text-primary">Why: </span>
          <CaseText text={objective.why} />
        </p>
        <HintList hints={objective.hints.slice(0, shown)} />
        {shown < Math.min(HINT_TIERS, objective.hints.length) && (
          <Button
            variant="ghost"
            size="sm"
            icon={<LightbulbIcon />}
            onClick={() => dispatch({ type: "hint", objectiveId: objective.id })}
          >
            {shown === 0 ? "Show a hint for this bonus" : "Show another hint for this bonus"}
          </Button>
        )}
      </div>
    </div>
  );
}
