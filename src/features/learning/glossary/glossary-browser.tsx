"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { SearchIcon } from "@/components/ui/icons";
import type { GlossaryEntry } from "@/content/schemas/glossary";
import { LESSON_TOPIC_IDS, LESSON_TOPICS, type LessonTopic } from "@/content/topics";
import { cx } from "@/lib/cx";
import { GlossaryText } from "./glossary-text";

interface GlossaryBrowserProps {
  /** Every entry, sorted A to Z. */
  entries: readonly GlossaryEntry[];
  /** Lesson titles by id, for "Read more" links. */
  lessonTitles: Readonly<Record<string, string>>;
}

type TopicFilter = LessonTopic | "all";

const ALPHABET = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/** The letter an entry is filed under: its first letter, or # for anything else. */
function letterOf(entry: GlossaryEntry): string {
  const first = entry.term.charAt(0).toUpperCase();
  return ALPHABET.includes(first) ? first : "#";
}

function matches(entry: GlossaryEntry, query: string): boolean {
  if (query === "") return true;
  return [entry.term, ...entry.aka, entry.short, entry.long].some((text) =>
    text.toLowerCase().includes(query),
  );
}

const TEXT_LINK = cx("rounded-sm font-medium text-accent hover:underline", FOCUS_RING);

/**
 * The glossary page's body: search, a topic filter, and every matching entry in A to Z order with
 * a letter index. Each entry is an anchor (`/learn/glossary#port`), which <Term> links to.
 */
export function GlossaryBrowser({ entries, lessonTitles }: GlossaryBrowserProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<TopicFilter>("all");

  const normalizedQuery = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      entries.filter(
        (entry) => (topic === "all" || entry.topic === topic) && matches(entry, normalizedQuery),
      ),
    [entries, topic, normalizedQuery],
  );
  const visibleIds = useMemo(() => new Set(visible.map((entry) => entry.id)), [visible]);
  const groups = useMemo(() => {
    const byLetter = new Map<string, GlossaryEntry[]>();
    for (const entry of visible) {
      const letter = letterOf(entry);
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), entry]);
    }
    return [...byLetter.entries()];
  }, [visible]);
  const termCounts = useMemo(() => {
    const counts = new Map<LessonTopic, number>();
    for (const entry of entries) counts.set(entry.topic, (counts.get(entry.topic) ?? 0) + 1);
    return counts;
  }, [entries]);
  const termById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  const filtered = normalizedQuery !== "" || topic !== "all";
  const clearFilters = () => {
    setQuery("");
    setTopic("all");
  };

  /** Follows a related-term link whose entry is filtered out: shows every term, then goes there. */
  const revealTerm = (id: string) => {
    flushSync(clearFilters);
    const target = document.getElementById(id);
    history.replaceState(null, "", `#${id}`);
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  };

  return (
    <div>
      <div className="flex flex-col gap-4 rounded-xl border border-subtle bg-surface-raised p-4 sm:p-5">
        <div>
          <label htmlFor={searchId} className="text-sm font-semibold text-primary">
            Search the glossary
          </label>
          <div className="relative mt-2">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “port” or “password”"
              autoComplete="off"
              spellCheck={false}
              className={cx(
                "h-11 w-full rounded-lg border border-strong bg-surface-base pr-3 pl-10 text-base text-primary placeholder:text-muted",
                FOCUS_RING,
              )}
            />
          </div>
        </div>

        <div role="group" aria-label="Show terms from one topic" className="flex flex-wrap gap-2">
          {(["all", ...LESSON_TOPIC_IDS] as const).map((id) => {
            const selected = topic === id;
            const label = id === "all" ? "All topics" : LESSON_TOPICS[id].label;
            const count = id === "all" ? entries.length : (termCounts.get(id) ?? 0);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => setTopic(id)}
                className={cx(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors fx-duration-fast",
                  selected
                    ? "border-accent bg-accent-subtle text-primary"
                    : "border-subtle text-secondary hover:border-strong hover:text-primary",
                  FOCUS_RING,
                )}
              >
                {label} <span className="text-muted">{count}</span>
              </button>
            );
          })}
        </div>

        <p aria-live="polite" className="text-sm text-secondary">
          {!filtered
            ? `All ${entries.length} terms, A to Z.`
            : visible.length === 0
              ? "No terms match."
              : `${visible.length} of ${entries.length} terms match.`}
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<SearchIcon />}
          title={
            normalizedQuery === ""
              ? "No terms in this topic yet"
              : `No terms match “${query.trim()}”`
          }
          description="Check the spelling, try a shorter word, or look in all topics. Every term in the missions and lessons is here."
          action={<Button onClick={clearFilters}>Show every term</Button>}
        />
      ) : (
        <>
          <nav aria-label="Jump to a letter" className="mt-8">
            <ul className="flex flex-wrap gap-1">
              {ALPHABET.map((letter) => {
                const present = groups.some(([groupLetter]) => groupLetter === letter);
                return (
                  <li key={letter}>
                    {present ? (
                      <a
                        href={`#letter-${letter}`}
                        className={cx(
                          "grid size-8 place-items-center rounded-md font-mono text-sm text-accent hover:bg-surface-raised",
                          FOCUS_RING,
                        )}
                      >
                        {letter}
                      </a>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="grid size-8 place-items-center font-mono text-sm text-muted"
                      >
                        {letter}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-6 space-y-10">
            {groups.map(([letter, group]) => (
              <section key={letter} aria-labelledby={`letter-${letter}`}>
                <h2
                  id={`letter-${letter}`}
                  className="scroll-mt-24 border-b border-subtle pb-2 font-mono text-xl font-semibold text-accent"
                >
                  {letter}
                </h2>
                <div className="mt-4 space-y-4">
                  {group.map((entry) => (
                    <article
                      key={entry.id}
                      id={entry.id}
                      tabIndex={-1}
                      aria-labelledby={`${entry.id}-term`}
                      className="scroll-mt-24 rounded-xl border border-subtle bg-surface-raised p-5 outline-none target:border-accent"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                        <h3 id={`${entry.id}-term`} className="text-lg font-semibold text-primary">
                          {entry.term}
                        </h3>
                        <Badge className="self-center">{LESSON_TOPICS[entry.topic].label}</Badge>
                      </div>
                      {entry.aka.length > 0 && (
                        <p className="mt-1 text-sm text-muted">
                          Also called {entry.aka.join(", ")}
                        </p>
                      )}
                      <p className="mt-3 text-base leading-7 font-medium text-primary">
                        <GlossaryText text={entry.short} />
                      </p>
                      <p className="mt-2 leading-7 text-secondary">
                        <GlossaryText text={entry.long} />
                      </p>

                      {(entry.relatedTerms.length > 0 || entry.relatedLessons.length > 0) && (
                        <div className="mt-4 flex flex-col gap-2 text-sm">
                          {entry.relatedTerms.length > 0 && (
                            <p className="text-secondary">
                              <span className="font-semibold text-primary">Related: </span>
                              {entry.relatedTerms.map((id, index) => (
                                <span key={id}>
                                  {index > 0 && ", "}
                                  <a
                                    href={`#${id}`}
                                    className={TEXT_LINK}
                                    onClick={(event) => {
                                      if (visibleIds.has(id)) return;
                                      event.preventDefault();
                                      revealTerm(id);
                                    }}
                                  >
                                    {termById.get(id)?.term ?? id}
                                  </a>
                                </span>
                              ))}
                            </p>
                          )}
                          {entry.relatedLessons.length > 0 && (
                            <p className="text-secondary">
                              <span className="font-semibold text-primary">Read more: </span>
                              {entry.relatedLessons.map((id, index) => (
                                <span key={id}>
                                  {index > 0 && ", "}
                                  <Link href={`/learn/${id}`} className={TEXT_LINK}>
                                    {lessonTitles[id] ?? id}
                                  </Link>
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
