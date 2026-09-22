"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon, InfoIcon } from "@/components/ui/icons";
import type { Quiz } from "@/content/schemas/lesson-components";
import { cx } from "@/lib/cx";
import { GlossaryText } from "../glossary/glossary-text";

/** Keyboard focus on a radio that's visually hidden inside its label shows on the label. */
const LABEL_FOCUS_RING =
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring";

/**
 * A lesson's quick check: one question, a few answers, and an explanation for every one of them.
 *
 * A wrong answer is never a fail screen: it gets "Not quite", the reason, and the learner picks
 * again (answers they've tried are labelled, so it never depends on colour). Once it's right, the
 * reasons for the other answers are one click away. Nothing is recorded.
 *
 * Keyboard: the answers are a native radio group (arrow keys move, Space picks), then "Check my
 * answer". Feedback is read out by a polite live region. Motion follows the reduced-motion setting.
 */
export function QuizView({ quiz }: { quiz: Quiz }) {
  const id = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState<number | null>(null);
  const [tried, setTried] = useState<readonly number[]>([]);
  const [nudge, setNudge] = useState(false);

  const checkedOption = checked === null ? undefined : quiz.options[checked];
  const solved = checkedOption?.correct === true;

  const check = () => {
    if (selected === null) {
      setNudge(true);
      return;
    }
    setNudge(false);
    setChecked(selected);
    if (!quiz.options[selected]?.correct && !tried.includes(selected)) {
      setTried([...tried, selected]);
    }
  };

  return (
    <section
      aria-labelledby={`${id}-question`}
      className="mt-8 rounded-xl border border-subtle bg-surface-raised p-5"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-accent">
        <InfoIcon className="size-4.5 shrink-0" />
        Quick check
      </p>
      <fieldset className="mt-2">
        <legend id={`${id}-question`} className="text-lg leading-7 font-semibold text-primary">
          <GlossaryText text={quiz.question} />
        </legend>
        <div className="mt-4 space-y-2">
          {quiz.options.map((option, index) => (
            <label
              key={option.text}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-lg border border-subtle bg-surface-base px-4 py-3 leading-7 text-primary",
                "hover:border-strong has-checked:border-accent has-checked:bg-accent-subtle",
                "has-disabled:cursor-default",
                LABEL_FOCUS_RING,
              )}
            >
              <input
                type="radio"
                name={id}
                value={index}
                checked={selected === index}
                disabled={solved}
                onChange={() => {
                  setSelected(index);
                  setNudge(false);
                }}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="mt-1.5 grid size-4.5 shrink-0 place-items-center rounded-full border-2 border-strong peer-checked:border-accent peer-checked:after:size-2 peer-checked:after:rounded-full peer-checked:after:bg-accent"
              />
              <span className="min-w-0 flex-1">
                <GlossaryText text={option.text} />
              </span>
              {tried.includes(index) && !solved && (
                <Badge tone="warning" className="mt-0.5 shrink-0">
                  Not this one
                </Badge>
              )}
              {solved && option.correct && (
                <Badge tone="success" className="mt-0.5 shrink-0">
                  Right answer
                </Badge>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      {!solved && (
        <div className="mt-4">
          <Button variant="secondary" onClick={check}>
            Check my answer
          </Button>
        </div>
      )}

      <div aria-live="polite" className="mt-4 empty:hidden">
        {nudge && <p className="leading-7 text-secondary">Pick an answer first, then check it.</p>}
        {checkedOption &&
          (solved ? (
            <div className="flex animate-rise-in gap-3 rounded-lg border border-status-success bg-surface-base px-4 py-3">
              <CheckCircleIcon className="mt-1 size-5 shrink-0 text-status-success" />
              <div className="leading-7">
                <p className="font-semibold text-status-success">That&apos;s right!</p>
                <p className="text-primary">
                  <GlossaryText text={checkedOption.explanation} />
                </p>
              </div>
            </div>
          ) : (
            <div
              key={checked}
              className="flex animate-rise-in gap-3 rounded-lg border border-status-warning bg-surface-base px-4 py-3"
            >
              <InfoIcon className="mt-1 size-5 shrink-0 text-status-warning" />
              <div className="leading-7">
                <p className="font-semibold text-status-warning">Not quite. Here&apos;s why:</p>
                <p className="text-primary">
                  <GlossaryText text={checkedOption.explanation} />
                </p>
                <p className="mt-1 text-secondary">Pick another answer and check again.</p>
              </div>
            </div>
          ))}
      </div>

      {solved && (
        <details className="mt-4 rounded-lg border border-subtle px-4 py-3">
          <summary className="cursor-pointer rounded-sm text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
            Why the other answers aren&apos;t right
          </summary>
          <ul className="mt-3 space-y-3">
            {quiz.options
              .filter((option) => !option.correct)
              .map((option) => (
                <li key={option.text} className="leading-7">
                  <p className="font-medium text-primary">
                    <GlossaryText text={option.text} />
                  </p>
                  <p className="text-secondary">
                    <GlossaryText text={option.explanation} />
                  </p>
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}
