import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { LESSON_LEVEL_LABELS, LESSON_TOPICS } from "@/content/topics";
import { cx } from "@/lib/cx";
import { Term } from "../glossary/term";
import type { Lesson } from "./loader";
import type { TocEntry } from "./remark-lesson";
import { TableOfContents } from "./table-of-contents";

interface LessonArticleProps {
  lesson: Lesson;
  /** The rendered body, from renderLesson. */
  content: ReactNode;
  toc: readonly TocEntry[];
  /** Lessons worth reading first, resolved from the frontmatter. */
  prerequisites: readonly Lesson[];
  /** Lessons that build on this one. */
  readNext: readonly Lesson[];
  /** Where this lesson sits in a track, like Start here, when it's in one. */
  track?: LessonTrackPosition;
  /** The related missions' names and addresses, by id. Without one, the id is shown. */
  missionTitles?: Readonly<Record<string, { readonly slug: string; readonly title: string }>>;
}

/** A lesson's place in a track (src/content/tracks.ts): "Start here, 3 of 6". */
export interface LessonTrackPosition {
  readonly title: string;
  readonly position: number;
  readonly total: number;
  readonly previous?: Lesson;
  readonly next?: Lesson;
}

const LINK = cx("rounded-sm font-medium text-accent hover:underline", FOCUS_RING);

function LessonLinks({ lessons }: { lessons: readonly Lesson[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {lessons.map((lesson) => (
        <li key={lesson.id}>
          <Link href={`/learn/${lesson.id}`} className={LINK}>
            {lesson.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Related({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-primary">{title}</h2>
      <div className="mt-2 leading-7 text-secondary">{children}</div>
    </div>
  );
}

/**
 * A lesson page: what it is and how long it takes, what to read first, the body with a table of
 * contents beside it, and where to go next.
 */
export function LessonArticle({
  lesson,
  content,
  toc,
  prerequisites,
  readNext,
  track,
  missionTitles = {},
}: LessonArticleProps) {
  const topic = LESSON_TOPICS[lesson.topic];
  const hasRelated =
    lesson.glossaryTerms.length > 0 ||
    lesson.relatedCommands.length > 0 ||
    lesson.relatedMissions.length > 0 ||
    readNext.length > 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <article className="max-w-3xl min-w-0">
        <header>
          <p className="text-sm text-secondary">
            <Link href="/learn" className={LINK}>
              Learn
            </Link>
            <span aria-hidden="true"> / </span>
            {topic.label}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {lesson.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone="accent">{topic.label}</Badge>
            <Badge>{LESSON_LEVEL_LABELS[lesson.level]}</Badge>
            <span className="text-sm text-secondary">About {lesson.readingMinutes} min</span>
            {track && (
              <span className="text-sm text-secondary">
                · {track.title}, {track.position} of {track.total}
              </span>
            )}
          </div>
          {prerequisites.length > 0 && (
            <div className="mt-6 rounded-lg border border-subtle bg-surface-raised px-4 py-3">
              <p className="text-sm font-semibold text-primary">Best read first</p>
              <div className="mt-1 text-sm">
                <LessonLinks lessons={prerequisites} />
              </div>
            </div>
          )}
        </header>

        {toc.length >= 2 && (
          <details className="mt-6 rounded-lg border border-subtle px-4 py-3 lg:hidden">
            <summary className={cx("cursor-pointer rounded-sm text-sm font-semibold", FOCUS_RING)}>
              What&apos;s in this lesson
            </summary>
            <TableOfContents entries={toc} className="mt-3" />
          </details>
        )}

        <div className="mt-10">{content}</div>

        {track && (track.previous || track.next) && (
          <nav
            aria-label={`${track.title} track`}
            className="mt-12 flex flex-wrap justify-between gap-4 rounded-xl border border-subtle bg-surface-raised px-5 py-4"
          >
            {track.previous ? (
              <Link href={`/learn/${track.previous.id}`} className={LINK}>
                <span className="block text-sm font-normal text-secondary">Previous</span>
                {track.previous.title}
              </Link>
            ) : (
              <span />
            )}
            {track.next && (
              <Link href={`/learn/${track.next.id}`} className={cx(LINK, "text-right")}>
                <span className="block text-sm font-normal text-secondary">
                  Next in {track.title.toLowerCase()}
                </span>
                {track.next.title}
              </Link>
            )}
          </nav>
        )}

        {hasRelated && (
          <footer className="mt-14 space-y-6 border-t border-subtle pt-8">
            {lesson.glossaryTerms.length > 0 && (
              <Related title="Words in this lesson">
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {lesson.glossaryTerms.map((id) => (
                    <li key={id}>
                      <Term id={id} />
                    </li>
                  ))}
                </ul>
              </Related>
            )}
            {lesson.relatedCommands.length > 0 && (
              <Related title="Commands in this lesson">
                <ul className="flex flex-wrap gap-2">
                  {lesson.relatedCommands.map((command) => (
                    <li key={command}>
                      <code className="rounded-md border border-subtle bg-surface-raised px-2 py-0.5 font-mono text-sm text-primary">
                        {command}
                      </code>
                    </li>
                  ))}
                </ul>
              </Related>
            )}
            {lesson.relatedMissions.length > 0 && (
              <Related title="Try it in a mission">
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {lesson.relatedMissions.map((id) => (
                    <li key={id}>
                      <Link href={`/missions/${missionTitles[id]?.slug ?? id}`} className={LINK}>
                        {missionTitles[id]?.title ?? id}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Related>
            )}
            {readNext.length > 0 && (
              <Related title="Read next">
                <LessonLinks lessons={readNext} />
              </Related>
            )}
          </footer>
        )}
      </article>

      <aside className="hidden lg:block">
        <TableOfContents entries={toc} headingId="lesson-toc-heading" className="sticky top-24" />
      </aside>
    </div>
  );
}
