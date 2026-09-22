/**
 * Matching for the command palette (⌘K / Ctrl+K). Pure, so it's tested without a browser.
 */

export interface SearchableCommand {
  readonly id: string;
  /** What the learner sees, and what matches best. */
  readonly label: string;
  /** A second line under the label. Also searched. */
  readonly description?: string;
  /** Other words that should find this command. */
  readonly keywords?: readonly string[];
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/** Higher is better; 0 is no match. */
function score(command: SearchableCommand, query: string, words: readonly string[]): number {
  const label = normalize(command.label);
  const rest = normalize([command.description ?? "", ...(command.keywords ?? [])].join(" "));
  const everything = `${label} ${rest}`;

  // Every word typed has to appear somewhere, so adding words narrows the list.
  if (!words.every((word) => everything.includes(word))) return 0;

  if (label.startsWith(query)) return 4;
  if (label.split(" ").some((part) => part.startsWith(query))) return 3;
  if (label.includes(query)) return 2;
  return 1;
}

/**
 * The commands that match `query`, best first. Ties keep their original order, and an empty query
 * returns every command as given. Case and extra spaces don't matter.
 */
export function searchCommands<T extends SearchableCommand>(
  commands: readonly T[],
  query: string,
): T[] {
  const normalized = normalize(query);
  if (normalized === "") return [...commands];

  const words = normalized.split(" ");
  return commands
    .map((command, index) => ({ command, index, score: score(command, normalized, words) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.command);
}
