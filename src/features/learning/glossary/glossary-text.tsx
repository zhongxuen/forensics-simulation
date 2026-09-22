/**
 * Glossary text with its `code` spans in code font. Definitions are plain strings, so commands,
 * file names and addresses are marked with backticks, as in the rest of the content.
 */
export function GlossaryText({ text }: { text: string }) {
  return text.split(/(`[^`]+`)/).map((part, index) =>
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
