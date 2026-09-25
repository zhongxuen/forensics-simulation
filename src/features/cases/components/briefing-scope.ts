/**
 * A case's written permission, split for the briefing's letter card (UIUX.md §2.4): what the
 * letter lets you examine (✓) and what it leaves out (✕), plus the sentence about who signed and
 * when. Case files write the scope as a few plain sentences, so this reads their shape rather than
 * asking for a second, structured copy that could drift from the prose:
 *
 * - a sentence that says who signed goes above the list;
 * - ", and nothing that …" inside a sentence starts an out-of-scope item of its own;
 * - a sentence (or part) that says "not", "nothing" or "out of scope" is out of scope;
 * - everything else is in scope.
 *
 * Every word of the original is kept, in order, so nothing the client signed is lost.
 */
export interface ScopeItems {
  /** Who signed and when, when the scope says so. */
  readonly signed: readonly string[];
  readonly allowed: readonly string[];
  readonly excluded: readonly string[];
}

const SIGNED = /\bsigned\b/i;
const NEGATIVE = /\b(?:not|nothing|out of scope)\b/i;
/** Where a sentence turns from what's covered to what isn't: "…qf-lt-03, and nothing that…". */
const TURN = /,?\s+and\s+(?=nothing\b)/i;

function sentence(text: string): string {
  const trimmed = text.trim();
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

export function scopeItems(scope: string): ScopeItems {
  const signed: string[] = [];
  const allowed: string[] = [];
  const excluded: string[] = [];
  const sentences = scope
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const whole of sentences) {
    if (SIGNED.test(whole)) {
      signed.push(whole);
      continue;
    }
    for (const part of whole.split(TURN)) {
      (NEGATIVE.test(part) ? excluded : allowed).push(sentence(part));
    }
  }
  return { signed, allowed, excluded };
}
