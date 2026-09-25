"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CharacterMessage } from "@/components/ui/character-message";
import { CheckIcon, CloseIcon, LightbulbIcon, PlayIcon } from "@/components/ui/icons";
import { getCastMember } from "@/content/cast";
import { cx } from "@/lib/cx";
import type { RunnableCase } from "../run/case-definition";
import { mainObjectives } from "../run/evaluate";
import { scopeItems } from "./briefing-scope";
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
 * client with who signed. The written permission reads as the letter it is, with what it covers
 * and what it leaves out as ticks and crosses. Start case sits in a bar that stays on screen
 * (UIUX.md §2.4), with the time the case takes and that hints are free.
 */
export function CaseBriefing({
  caseDef,
  onStart,
  headingRef,
  starting = false,
}: CaseBriefingProps) {
  const first = mainObjectives(caseDef)[0];
  const { client, briefing } = caseDef;
  const scope = scopeItems(client.scope);

  return (
    <article aria-labelledby="case-briefing-title" className="mx-auto max-w-3xl">
      <p className="flex flex-wrap items-center gap-2 type-eyebrow">
        <span className="text-accent">Case briefing</span>
        <span aria-hidden="true">·</span>
        <span>About {caseDef.estimatedMinutes} minutes</span>
      </p>
      <h1
        id="case-briefing-title"
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 type-page-title outline-none sm:text-4xl sm:leading-11"
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
          <h2 id="briefing-first" className="type-eyebrow text-accent">
            Your first objective
          </h2>
          <p className="mt-1 type-body text-primary">
            <CaseText text={first.description} />
          </p>
        </section>
      )}

      <section aria-labelledby="briefing-situation" className="mt-10">
        <h2 id="briefing-situation" className="type-section-title">
          The situation
        </h2>
        <p className="mt-2 max-w-prose type-body text-secondary">
          <CaseText text={briefing.situation} />
        </p>
      </section>

      <section aria-labelledby="briefing-authorization" className="mt-8">
        <Card variant="letter" signed={client.signedBy}>
          <h2 id="briefing-authorization" className="type-section-title">
            Your written permission
          </h2>
          <p className="mt-2 type-body text-primary">
            {client.org} asked for this examination, and {client.signedBy} signed the letter.
          </p>
          {scope.signed.map((line) => (
            <p key={line} className="mt-1 type-small text-muted">
              <CaseText text={line} />
            </p>
          ))}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {scope.allowed.length > 0 && (
              <ScopeList id="briefing-allowed" title="You may examine" items={scope.allowed} />
            )}
            {scope.excluded.length > 0 && (
              <ScopeList id="briefing-excluded" title="Out of scope" items={scope.excluded} out />
            )}
          </div>
        </Card>
      </section>

      {/* Start case stays in reach however far down the briefing the player has read. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-subtle bg-surface-base/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:mx-0 sm:rounded-t-lg sm:px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Button
            variant="primary"
            size="lg"
            icon={<PlayIcon />}
            loading={starting}
            onClick={onStart}
          >
            Start case
          </Button>
          <p className="flex flex-wrap items-center gap-x-2 type-small text-secondary">
            <span>About {caseDef.estimatedMinutes} minutes</span>
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LightbulbIcon aria-hidden="true" className="size-4 text-accent" />
              Hints are free
            </span>
          </p>
        </div>
        <p className="mt-1.5 type-small text-muted">
          Your work on this case is saved in this browser only.
        </p>
      </div>
    </article>
  );
}

interface ScopeListProps {
  id: string;
  title: string;
  items: readonly string[];
  /** The letter leaves these out: a cross instead of a tick. */
  out?: boolean;
}

/** One side of the letter's scope, each item with a tick or a cross and the words to match. */
function ScopeList({ id, title, items, out = false }: ScopeListProps) {
  const Mark = out ? CloseIcon : CheckIcon;
  return (
    <div>
      <h3 id={id} className="type-eyebrow">
        {title}
      </h3>
      <ul aria-labelledby={id} className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 type-small text-primary">
            <Mark
              aria-hidden="true"
              strokeWidth={2.5}
              className={cx(
                "mt-0.5 size-4 shrink-0",
                out ? "text-status-danger" : "text-status-success",
              )}
            />
            <span>
              <span className="sr-only">{out ? "Out of scope: " : "In scope: "}</span>
              <CaseText text={item} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
