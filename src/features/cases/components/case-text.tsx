import { Fragment } from "react";

/**
 * Case copy with commands, paths and addresses in `backticks` shown in code font (99 §Voice).
 * Nothing else is interpreted: case text is plain text.
 */
export function CaseText({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className="rounded bg-surface-overlay px-1 font-mono text-[0.9em]">
            {part}
          </code>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** The same text without the backticks, for places that only take a string. */
export const plainCaseText = (text: string): string => text.replaceAll("`", "");
