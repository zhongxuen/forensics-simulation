/**
 * The banned words from md-files/voice-and-tone.md, for tests that check written content (glossary
 * definitions, lesson copy). They imply the learner should find something effortless, assume
 * knowledge, gatekeep, or frame the learner as an attacker.
 *
 * "wrong", "failed" and "illegal" are banned when they're about the learner, but content needs them
 * in their technical sense ("a failed login"), so they're left to review rather than a pattern.
 */
export const BANNED_WORDS: readonly string[] = [
  "simply",
  "just",
  "merely",
  "obviously",
  "clearly",
  "of course",
  "as you know",
  "easy",
  "trivial",
  "basic",
  "invalid",
  "n00b",
  "script kiddie",
  "1337",
  "h4x0r",
  "ninja",
  "rockstar",
  "victim",
  "hack anyone",
  "take down",
];

const BANNED_PATTERN = new RegExp(
  `\\b(?:${BANNED_WORDS.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi",
);

/** Every banned word in `text`, as written. */
export function findBannedWords(text: string): string[] {
  return [...text.matchAll(BANNED_PATTERN)].map((match) => match[0]);
}
