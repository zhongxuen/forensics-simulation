"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { CharacterMessage } from "@/components/ui/character-message";
import { PlayIcon } from "@/components/ui/icons";
import { getCastMember } from "@/content/cast";
import type { RunnableCase } from "../run/case-definition";
import { mainObjectives } from "../run/evaluate";
import { CaseText } from "./case-text";

interface CaseBriefingProps {
  caseDef: RunnableCase;
  onStart: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** Start case was pressed and the workstation is on its way: the button shows it's busy. */
  starting?: boolean;
}

/**
 * The briefing, readable in 30 seconds, following the cold-open rule (99 §Story world): each
 * character's name and role on their line, at most two lines before the first objective, and the
 * client with who signed. Then one big Start case button.
 */
export function CaseBriefing({
  caseDef,
  onStart,
  headingRef,
  starting = false,
}: CaseBriefingProps) {
  const first = mainObjectives(caseDef)[0];
  const { client, briefing } = caseDef;

  return (
    <article aria-labelledby="case-briefing-title" className="mx-auto max-w-3xl">
      <p className="flex flex-wrap items-center gap-2 text-sm text-secondary">
        <span className="font-semibold text-accent">Case briefing</span>
        <span aria-hidden="true">·</span>
        <span>About {caseDef.estimatedMinutes} minutes</span>
      </p>
      <h1
        id="case-briefing-title"
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-3xl font-semibold tracking-tight text-balance outline-none sm:text-4xl"
      >
        {caseDef.title}
      </h1>
      <p className="mt-3 text-xl leading-8 text-pretty text-primary">
        <CaseText text={caseDef.hook} />
      </p>

      <ol className="mt-8 space-y-4" aria-label="From the team">
        {briefing.opening.slice(0, 2).map((line, index) => {
          const speaker = getCastMember(line.speaker);
          return (
            <li key={index}>
              <CharacterMessage
                speaker={{
                  name: speaker?.name ?? line.speaker,
                  ...(speaker && { role: speaker.role, initials: speaker.initials }),
                }}
                tone={speaker?.tone ?? "teammate"}
              >
                <CaseText text={line.text} />
              </CharacterMessage>
            </li>
          );
        })}
      </ol>

      {first && (
        <section
          aria-labelledby="briefing-first"
          className="mt-6 rounded-lg border border-accent bg-accent-subtle px-4 py-3"
        >
          <h2 id="briefing-first" className="text-sm font-semibold text-accent">
            Your first objective
          </h2>
          <p className="mt-1 leading-7 text-primary">
            <CaseText text={first.description} />
          </p>
        </section>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="briefing-situation" className="sm:col-span-2">
          <h2
            id="briefing-situation"
            className="text-sm font-semibold tracking-wide text-secondary"
          >
            The situation
          </h2>
          <p className="mt-2 leading-7">
            <CaseText text={briefing.situation} />
          </p>
        </section>

        <section
          aria-labelledby="briefing-authorization"
          className="rounded-lg border border-l-4 border-subtle border-l-status-info bg-surface-raised px-4 py-3 sm:col-span-2"
        >
          <h2 id="briefing-authorization" className="text-sm font-semibold text-status-info">
            Your written permission
          </h2>
          <p className="mt-1.5 leading-7 text-primary">
            {client.org} asked for this examination, and {client.signedBy} signed the letter.
          </p>
          <p className="mt-1.5 leading-7 text-secondary">
            <span className="font-semibold text-primary">You may examine: </span>
            <CaseText text={client.scope} />
          </p>
        </section>
      </div>

      <div className="mt-8 flex flex-col items-start gap-3">
        <Button
          variant="primary"
          size="lg"
          icon={<PlayIcon />}
          loading={starting}
          onClick={onStart}
        >
          Start case
        </Button>
        <p className="text-sm text-muted">
          Hints are free. Your work on this case is saved in this browser only.
        </p>
      </div>
    </article>
  );
}
