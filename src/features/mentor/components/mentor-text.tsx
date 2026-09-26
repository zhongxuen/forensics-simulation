import { cx } from "@/lib/cx";

/**
 * Noor's words: plain text with `code` spans in code font, and blank lines as paragraph breaks.
 * Mentor text is never HTML: model output and authored hints are both rendered as text.
 */
export function MentorText({ text, className }: { text: string; className?: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return (
    <span className={cx("block space-y-2", className)}>
      {paragraphs.map((paragraph, index) => (
        <span key={index} className="block whitespace-pre-line">
          <CodeSpans text={paragraph} />
        </span>
      ))}
    </span>
  );
}

/** One run of text with backtick spans in code font. */
export function CodeSpans({ text }: { text: string }) {
  return text.split(/(`[^`\n]+`)/).map((part, index) =>
    part.length > 2 && part.startsWith("`") && part.endsWith("`") ? (
      <code
        key={index}
        className="rounded-sm bg-surface-base px-1 py-0.5 font-mono text-[0.9em] text-primary"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

/** Mentor text without backticks, for announcements and labels. */
export const plainMentorText = (text: string): string => text.replace(/`/g, "");
