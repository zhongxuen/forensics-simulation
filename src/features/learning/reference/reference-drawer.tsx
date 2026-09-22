"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CloseIcon,
  InfoIcon,
  LightbulbIcon,
  TerminalIcon,
} from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { getGlossaryEntry } from "@/content/glossary";
import { useSearchIndex } from "@/hooks/use-search-index";
import { cx } from "@/lib/cx";
import {
  searchIndex,
  SEARCH_KIND_LABELS,
  SEARCH_KINDS,
  type SearchEntry,
  type SearchKind,
} from "@/lib/search";
import { GlossaryText } from "../glossary/glossary-text";
import { hasManPage, ManPage, manPageSummary } from "./man-page";
import { referenceSuggestions } from "./suggest";

export interface ReferenceDrawerProps {
  open: boolean;
  onClose: () => void;
  missionId: string;
  /** Lesson ids the mission names: its concepts, then its further reading. */
  missionLessonIds: readonly string[];
  /** The last command the learner ran, like `netscan`. */
  lastCommand?: string;
  /**
   * "Explain this" for a glossary word (phase 10): when given, a word's page offers to have it
   * explained with the mission in mind. Who explains it is up to the caller (the mentor).
   */
  onExplainTerm?: (termId: string) => void;
}

type Detail = { readonly kind: SearchKind; readonly id: string };

const KIND_ICONS: Readonly<Record<SearchKind, ReactNode>> = {
  lesson: <BookOpenIcon />,
  term: <InfoIcon />,
  command: <TerminalIcon />,
};

const NEW_TAB_LINK = cx(
  "inline-flex items-center gap-1 rounded-sm font-medium text-accent underline-offset-4 hover:underline [&_svg]:size-4",
  FOCUS_RING,
);

const ITEM = cx(
  "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-overlay [&_svg]:mt-0.5 [&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:text-accent",
  FOCUS_RING,
);

function Item({ entry, onOpen }: { entry: SearchEntry; onOpen: (detail: Detail) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen({ kind: entry.kind, id: entry.id.replace(/^[a-z]+:/, "") })}
        className={ITEM}
      >
        {KIND_ICONS[entry.kind]}
        <span className="min-w-0">
          <span
            className={cx(
              "block font-medium text-primary",
              entry.kind === "command" && "font-mono",
            )}
          >
            {entry.title}
          </span>
          {entry.summary && (
            <span className="block text-sm leading-6 text-secondary">
              <GlossaryText text={entry.summary} />
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-3 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** "Opens in a new tab": leaving the page would end the mission run, so links never do that. */
function NewTabLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={NEW_TAB_LINK}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
      <ArrowRightIcon aria-hidden="true" />
    </a>
  );
}

/**
 * The in-mission reference drawer (md-files/09-learning-center.md, prompt 09.5): look up a lesson,
 * a glossary word or a command's manual page without leaving the mission. It opens over the side
 * of the workspace, never replacing the terminal, and it doesn't trap focus, so the learner can
 * keep typing while it's open. It stays mounted while closed, so a search or an open page is still
 * there next time. Nothing in it changes the mission run.
 *
 * Before any search it suggests what fits the moment: the lessons behind this mission, and the
 * lessons and manual page for the last command run. Links to full pages open in a new tab, because
 * leaving this page would end the run.
 */
export function ReferenceDrawer({
  open,
  onClose,
  missionId,
  missionLessonIds,
  lastCommand,
  onExplainTerm,
}: ReferenceDrawerProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const index = useSearchIndex(open);
  const entries = index.state === "ready" ? index.entries : [];

  // Opening moves focus into the drawer; closing hands it back to whatever had it.
  useEffect(() => {
    if (open) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      inputRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (detail) setDetail(null);
    else onClose();
  };

  const results = searchIndex(entries, query, { perKind: 6 });
  const suggestions = referenceSuggestions(entries, {
    missionId,
    missionLessonIds,
    ...(lastCommand !== undefined && { lastCommand }),
  });
  const command = lastCommand !== undefined && hasManPage(lastCommand) ? lastCommand : undefined;
  const entryFor = (detail: Detail) =>
    entries.find((entry) => entry.id === `${detail.kind}:${detail.id}`);

  let body: ReactNode;
  if (detail) {
    body = (
      <DetailView
        detail={detail}
        entry={entryFor(detail)}
        onOpen={setDetail}
        {...(onExplainTerm && { onExplainTerm })}
      />
    );
  } else if (query.trim() !== "") {
    body =
      index.state !== "ready" ? (
        <Status index={index.state} />
      ) : results.length === 0 ? (
        <p className="px-3 leading-7 text-secondary">
          Nothing matches &ldquo;{query.trim()}&rdquo;. Try one word, like port or permission.
        </p>
      ) : (
        <div className="space-y-5">
          {SEARCH_KINDS.map((kind) => {
            const found = results.filter((entry) => entry.kind === kind);
            return found.length === 0 ? null : (
              <Section key={kind} title={SEARCH_KIND_LABELS[kind]}>
                <ul>
                  {found.map((entry) => (
                    <Item key={entry.id} entry={entry} onOpen={setDetail} />
                  ))}
                </ul>
              </Section>
            );
          })}
        </div>
      );
  } else {
    body = (
      <div className="space-y-6">
        {command && (
          <Section
            title={
              <>
                Your last command: <span className="font-mono normal-case">{command}</span>
              </>
            }
          >
            <ul>
              <li>
                <button
                  type="button"
                  onClick={() => setDetail({ kind: "command", id: command })}
                  className={ITEM}
                >
                  <TerminalIcon />
                  <span className="min-w-0">
                    <span className="block font-medium text-primary">
                      Read the manual for <span className="font-mono">{command}</span>
                    </span>
                    <span className="block text-sm leading-6 text-secondary">
                      {manPageSummary(command)}
                    </span>
                  </span>
                </button>
              </li>
              {suggestions.forCommand.map((entry) => (
                <Item key={entry.id} entry={entry} onOpen={setDetail} />
              ))}
            </ul>
          </Section>
        )}
        <Section title="Lessons for this mission">
          {index.state !== "ready" ? (
            <Status index={index.state} />
          ) : suggestions.forMission.length === 0 ? (
            <p className="px-3 text-sm leading-6 text-secondary">
              This mission teaches everything as you go. Search above for anything else.
            </p>
          ) : (
            <ul>
              {suggestions.forMission.map((entry) => (
                <Item key={entry.id} entry={entry} onOpen={setDetail} />
              ))}
            </ul>
          )}
        </Section>
      </div>
    );
  }

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
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            Reference
          </h2>
          <Button
            variant="ghost"
            size="sm"
            label="Close the reference"
            icon={<CloseIcon />}
            onClick={onClose}
          />
        </div>
        <p className="text-sm leading-6 text-secondary">
          Look things up without leaving. Your terminal stays exactly as it is, and you can keep
          typing in it.
        </p>
        <label htmlFor={`${id}-search`} className="mt-3 block text-sm font-semibold text-secondary">
          Look something up
        </label>
        <input
          ref={inputRef}
          id={`${id}-search`}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setDetail(null);
          }}
          placeholder="A word, a command, or an idea"
          autoComplete="off"
          spellCheck={false}
          className="mt-1 h-10 w-full rounded-md border border-strong bg-surface-base px-3 text-primary placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
        {detail && (
          <div className="px-3 pb-3">
            <Button variant="ghost" size="sm" onClick={() => setDetail(null)}>
              ← Back
            </Button>
          </div>
        )}
        {body}
      </div>
    </section>
  );
}

function Status({ index }: { index: "idle" | "loading" | "failed" }) {
  return index === "failed" ? (
    <p className="px-3 text-sm leading-6 text-secondary">
      The reference couldn&apos;t load right now. That&apos;s on our side, not yours. The{" "}
      <code className="font-mono">man</code> command in the terminal still works.
    </p>
  ) : (
    <p className="flex items-center gap-2 px-3 text-sm text-muted">
      <Spinner /> Loading the reference…
    </p>
  );
}

function DetailView({
  detail,
  entry,
  onOpen,
  onExplainTerm,
}: {
  detail: Detail;
  entry: SearchEntry | undefined;
  onOpen: (detail: Detail) => void;
  onExplainTerm?: (termId: string) => void;
}) {
  if (detail.kind === "command") {
    return (
      <article className="space-y-3 px-3">
        <h3 className="font-mono text-xl font-semibold">{detail.id}</h3>
        <ManPage name={detail.id} className="text-xs" />
        <NewTabLink href={`/learn/commands#${detail.id}`}>Every command&apos;s manual</NewTabLink>
      </article>
    );
  }

  if (detail.kind === "term") {
    const term = getGlossaryEntry(detail.id);
    if (!term) return null;
    return (
      <article className="space-y-3 px-3">
        <h3 className="text-xl font-semibold">{term.term}</h3>
        <p className="leading-7 text-primary">
          <GlossaryText text={term.short} />
        </p>
        <p className="leading-7 text-secondary">
          <GlossaryText text={term.long} />
        </p>
        {onExplainTerm && (
          <Button
            variant="secondary"
            size="sm"
            icon={<LightbulbIcon />}
            onClick={() => onExplainTerm(term.id)}
          >
            Explain this, with my mission in mind
          </Button>
        )}
        {term.relatedTerms.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-secondary">Related words</h4>
            <ul className="mt-1 flex flex-wrap gap-2">
              {term.relatedTerms.map((related) => (
                <li key={related}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpen({ kind: "term", id: related })}
                  >
                    {getGlossaryEntry(related)?.term ?? related}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <NewTabLink href={`/learn/glossary#${term.id}`}>See it in the glossary</NewTabLink>
      </article>
    );
  }

  if (!entry) return null;
  return (
    <article className="space-y-3 px-3">
      <h3 className="text-xl font-semibold">{entry.title}</h3>
      <p className="leading-7 text-secondary">
        <GlossaryText text={entry.summary} />
      </p>
      {(entry.terms ?? []).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-secondary">Words it explains</h4>
          <ul className="mt-1 flex flex-wrap gap-2">
            {(entry.terms ?? []).map((term) => (
              <li key={term}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpen({ kind: "term", id: term })}
                >
                  {getGlossaryEntry(term)?.term ?? term}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(entry.commands ?? []).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-secondary">Commands it covers</h4>
          <ul className="mt-1 flex flex-wrap gap-2">
            {(entry.commands ?? []).map((name) => (
              <li key={name}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpen({ kind: "command", id: name })}
                >
                  <span className="font-mono">{name}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <NewTabLink href={entry.href}>Read the whole lesson</NewTabLink>
    </article>
  );
}
