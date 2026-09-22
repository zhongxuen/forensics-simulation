import type { ReactNode } from "react";
import { getGlossaryEntry } from "@/content/glossary";
import { TermPopover } from "./term-popover";

interface TermProps {
  /** The glossary id: `ip-address`. */
  id: string;
  /**
   * The words as they read in the sentence ("ports"). Leave out only where the glossary's own
   * heading fits, like a list of terms: it's capitalised ("Port").
   */
  children?: ReactNode;
}

/**
 * A word defined in the glossary, with its definition a hover, focus or tap away. Use it the first
 * time a term appears on a screen: `<Term id="port">ports</Term>`.
 *
 * An unknown id is a bug in the content. It throws outside production, so tests and development
 * catch it, and falls back to plain text in production.
 */
export function Term({ id, children }: TermProps) {
  const entry = getGlossaryEntry(id);
  if (!entry) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`<Term id="${id}"> has no glossary entry in src/content/glossary.ts.`);
    }
    return <>{children ?? id}</>;
  }
  return (
    <TermPopover id={entry.id} term={entry.term} short={entry.short}>
      {children ?? entry.term}
    </TermPopover>
  );
}
