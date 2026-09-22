/**
 * Search across lessons, glossary words and command manual pages (md-files/09-learning-center.md,
 * prompt 09.5). The index is built once at build time (`buildSearchIndex` in the Learning Center,
 * served as a static file at SEARCH_INDEX_PATH), and searched here, in the browser, with no outside
 * service. Pure, so it's tested without a browser: searching the whole index takes well under
 * 100 ms (tests/unit/search.test.ts).
 */

export const SEARCH_INDEX_PATH = "/search-index.json";

export const SEARCH_KINDS = ["lesson", "term", "command"] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

/** How each kind is headed in results. */
export const SEARCH_KIND_LABELS: Readonly<Record<SearchKind, string>> = {
  lesson: "Lessons",
  term: "Glossary",
  command: "Commands",
};

export interface SearchEntry {
  /** Unique across the index: `lesson:net-ports`, `term:port`, `command:ls`. */
  readonly id: string;
  readonly kind: SearchKind;
  /** "Ports and services", "Port", "ls". */
  readonly title: string;
  /** One line under the title: a lesson's summary, a word's short definition, a command's one-liner. */
  readonly summary: string;
  /** Where it lives: /learn/net-ports, /learn/glossary#port, /learn/commands#ls. */
  readonly href: string;
  /** Other words that should find it: another name, the topic, a lesson's headings. */
  readonly keywords: readonly string[];
  /** Lessons only: the commands, missions and glossary words they cover (for the reference drawer). */
  readonly commands?: readonly string[];
  readonly missions?: readonly string[];
  readonly terms?: readonly string[];
}

export interface SearchIndex {
  readonly version: 1;
  readonly entries: readonly SearchEntry[];
}

const normalize = (text: string) =>
  text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Higher is better; 0 is no match. Every word typed must appear somewhere. */
function score(entry: SearchEntry, query: string, words: readonly string[]): number {
  const title = normalize(entry.title);
  const summary = normalize(entry.summary);
  const everything = `${title} ${summary} ${normalize(entry.keywords.join(" "))}`;
  if (!words.every((word) => everything.includes(word))) return 0;
  if (title === query) return 10;
  if (title.startsWith(query)) return 8;
  if (title.split(/[\s-]/).some((part) => part.startsWith(query))) return 6;
  if (title.includes(query)) return 5;
  if (words.every((word) => title.includes(word))) return 4;
  if (summary.includes(query)) return 3;
  return 1;
}

export interface SearchOptions {
  /** At most this many results of each kind. Default: no limit. */
  readonly perKind?: number;
  readonly kinds?: readonly SearchKind[];
}

/**
 * The entries matching `query`, best first, ties in index order. Case, accents and extra spaces
 * don't matter. An empty query finds nothing: a search box shows its own suggestions instead.
 */
export function searchIndex(
  entries: readonly SearchEntry[],
  query: string,
  { perKind, kinds }: SearchOptions = {},
): SearchEntry[] {
  const normalized = normalize(query);
  if (normalized === "") return [];
  const words = normalized.split(" ");
  const ranked = entries
    .map((entry, index) => ({ entry, index, score: score(entry, normalized, words) }))
    .filter(({ entry, score }) => score > 0 && (kinds === undefined || kinds.includes(entry.kind)))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ entry }) => entry);
  if (perKind === undefined) return ranked;
  const counts = new Map<SearchKind, number>();
  return ranked.filter((entry) => {
    const count = counts.get(entry.kind) ?? 0;
    counts.set(entry.kind, count + 1);
    return count < perKind;
  });
}

/** Whether `value` looks like a search index, before trusting a fetched file. */
export function isSearchIndex(value: unknown): value is SearchIndex {
  if (typeof value !== "object" || value === null) return false;
  const { version, entries } = value as { version?: unknown; entries?: unknown };
  return (
    version === 1 &&
    Array.isArray(entries) &&
    entries.every(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as SearchEntry).id === "string" &&
        typeof (entry as SearchEntry).title === "string" &&
        typeof (entry as SearchEntry).href === "string" &&
        SEARCH_KINDS.includes((entry as SearchEntry).kind) &&
        Array.isArray((entry as SearchEntry).keywords),
    )
  );
}
