import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRightIcon, BookOpenIcon, TerminalIcon } from "@/components/ui/icons";
import { GLOSSARY } from "@/content/glossary";
import { LESSON_LEVEL_LABELS } from "@/content/topics";
import { TRACKS } from "@/content/tracks";
import { getLesson, type Lesson } from "@/features/learning/server";
import { getAppSection } from "@/lib/app-sections";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = { title: getAppSection("learn").label };

/** The Learning Center: each track in reading order, then the glossary and the command manual. */
export default function LearnPage() {
  const tracks = TRACKS.map((track) => ({
    ...track,
    lessons: track.lessons.flatMap((id): Lesson[] => {
      const lesson = getLesson(id);
      return lesson ? [lesson] : [];
    }),
  })).filter((track) => track.lessons.length > 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Every idea, explained in plain words
      </h1>
      <p className="mt-4 text-lg leading-8 text-secondary">
        Short lessons on how investigators work: why you copy a disk before you look at it, what a
        hash proves, and how to show who had the evidence. Each one has something to try on your own
        practice workstation.
      </p>

      {tracks.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<BookOpenIcon />}
          title="The first lessons are on their way"
          description="They'll start from zero: what forensics is and how to handle evidence. Meanwhile, Case 1 teaches as you go."
          action={
            <ButtonLink href={FIRST_STEP.href} variant="primary">
              {FIRST_STEP.title}
            </ButtonLink>
          }
        />
      ) : (
        <div className="mt-10 space-y-12">
          {tracks.map((track) => (
            <section key={track.id} aria-labelledby={`track-${track.id}`}>
              <h2 id={`track-${track.id}`} className="text-2xl font-semibold tracking-tight">
                {track.title}
              </h2>
              <p className="mt-1 leading-7 text-secondary">{track.description}</p>
              <ol className="mt-4 space-y-3">
                {track.lessons.map((lesson, index) => (
                  <li key={lesson.id}>
                    <Card href={`/learn/${lesson.id}`} className="flex items-start gap-4">
                      <span
                        aria-hidden="true"
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-subtle font-mono text-sm font-semibold text-accent"
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-semibold">{lesson.title}</span>
                        {(lesson.summary ?? lesson.analogy) !== undefined && (
                          <span className="mt-1 block leading-7 text-secondary">
                            {lesson.summary ?? lesson.analogy}
                          </span>
                        )}
                        <span className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge>{LESSON_LEVEL_LABELS[lesson.level]}</Badge>
                          <span className="text-sm text-secondary">
                            About {lesson.readingMinutes} min
                          </span>
                        </span>
                      </span>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <Card href="/learn/glossary" className="mt-12 flex items-start gap-4">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-overlay text-accent [&_svg]:size-5"
        >
          <BookOpenIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">Glossary</span>
          <span className="mt-1 block leading-7 text-secondary">
            {GLOSSARY.length} words from forensics and security, each explained in one plain
            sentence.
          </span>
        </span>
        <ArrowRightIcon aria-hidden="true" className="mt-1 size-5 shrink-0 text-accent" />
      </Card>

      <Card href="/learn/commands" className="mt-3 flex items-start gap-4">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-overlay text-accent [&_svg]:size-5"
        >
          <TerminalIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">Command manual</span>
          <span className="mt-1 block leading-7 text-secondary">
            Every command the terminal knows, with the same manual page{" "}
            <code className="font-mono text-primary">man</code> shows.
          </span>
        </span>
        <ArrowRightIcon aria-hidden="true" className="mt-1 size-5 shrink-0 text-accent" />
      </Card>
    </div>
  );
}
