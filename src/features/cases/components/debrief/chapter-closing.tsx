import { CharacterMessage } from "@/components/ui/character-message";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { getCastMember } from "@/content/cast";
import type { Chapter } from "@/content/cases/chapter";
import { cx } from "@/lib/cx";
import { CaseText } from "../case-text";

interface ChapterClosingProps {
  readonly chapter: Chapter;
}

/**
 * The chapter's closing line, on the debrief of its last case: Idris tying the cases together, and
 * where the story goes next (docs/plan/12-case-3-something-is-still-running.md, §Chapter closing).
 * The link leaves this site for Hacker Simulation, so it opens in a new tab and says so.
 */
export function ChapterClosing({ chapter }: ChapterClosingProps) {
  const speaker = getCastMember(chapter.closing.speaker);
  return (
    <section
      aria-labelledby="debrief-chapter"
      className="mt-8 rounded-lg border border-subtle bg-surface-raised px-4 py-4"
    >
      <p className="text-sm font-semibold text-accent">Chapter closed</p>
      <h2 id="debrief-chapter" className="mt-1 text-xl font-semibold">
        {chapter.title}
      </h2>
      <div className="mt-4">
        <CharacterMessage
          speaker={{
            name: speaker?.name ?? chapter.closing.speaker,
            ...(speaker && { role: speaker.role, initials: speaker.initials }),
          }}
          tone={speaker?.tone ?? "teammate"}
        >
          <CaseText text={chapter.closing.text} />
        </CharacterMessage>
      </div>
      <p className="mt-4 leading-7 text-secondary">{chapter.upNext.text}</p>
      <p className="mt-2 leading-7">
        <a
          href={chapter.upNext.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cx("rounded-sm text-accent underline underline-offset-4", FOCUS_RING)}
        >
          {chapter.upNext.label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </section>
  );
}
