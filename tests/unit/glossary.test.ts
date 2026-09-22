import { describe, expect, it } from "vitest";
import { getGlossaryEntry, GLOSSARY, GLOSSARY_SOURCE } from "@/content/glossary";
import { GlossarySchema, type GlossaryEntry } from "@/content/schemas/glossary";
import { LESSON_TOPIC_IDS } from "@/content/topics";
import { findBannedWords } from "@/content/voice";

/**
 * The glossary's writing rules (md-files/09-learning-center.md, prompt 09.3, and
 * md-files/voice-and-tone.md). Cross-links to lessons are checked with the rest of the content in
 * content-references.test.ts.
 */

/** Code spans (`example.com`, `ls -a`) are literal text the learner types, not prose. */
function prose(text: string): string {
  return text.replace(/`[^`]*`/g, "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches `word` as a whole word, including a plain plural (`ports`, `hashes`). */
function wordPattern(word: string): RegExp {
  return new RegExp(`(?<![\\w-])${escapeRegExp(word)}(?:s|es)?(?![\\w-])`, "i");
}

/** The names an entry goes by: its term and every aka. */
function namesOf(entry: GlossaryEntry): string[] {
  return [entry.term, ...entry.aka];
}

/** Other entries' names that appear in `entry.short`, ignoring everyday words. */
function jargonIn(entry: GlossaryEntry, glossary: readonly GlossaryEntry[]): string[] {
  const text = prose(entry.short);
  return glossary
    .filter((other) => other.id !== entry.id && !other.everyday)
    .flatMap(namesOf)
    .filter((name) => wordPattern(name).test(text));
}

/** Words with two or more capital letters (IP, SQLi, 2FA), which read as acronyms. */
function acronymsIn(text: string): string[] {
  return [...prose(text).matchAll(/\b[\dA-Za-z]*[A-Z][\dA-Za-z]*[A-Z][\dA-Za-z]*\b/g)].map(
    (match) => match[0],
  );
}

/** Whether `text` reads as exactly one sentence. */
function isOneSentence(text: string): boolean {
  const body = prose(text).replace(/"[^"]*"/g, '""');
  return /[.?!]$/.test(body) && !/[.?!]\s+\S/.test(body.slice(0, -1));
}

describe("the glossary data", () => {
  it("matches the schema", () => {
    expect(() => GlossarySchema.parse(GLOSSARY_SOURCE)).not.toThrow();
  });

  it("has at least 60 terms, covering every lesson topic", () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(60);
    const topics = new Set(GLOSSARY.map((entry) => entry.topic));
    expect([...LESSON_TOPIC_IDS].filter((topic) => !topics.has(topic))).toEqual([]);
  });

  it("is sorted A to Z, and every entry can be looked up by id", () => {
    const terms = GLOSSARY.map((entry) => entry.term);
    expect(terms).toEqual(
      [...terms].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
    );
    for (const entry of GLOSSARY) expect(getGlossaryEntry(entry.id)).toBe(entry);
    expect(getGlossaryEntry("not-a-term")).toBeUndefined();
  });

  it("never uses the same name for two entries", () => {
    const owners = new Map<string, string>();
    const clashes: string[] = [];
    for (const entry of GLOSSARY) {
      for (const name of namesOf(entry)) {
        const key = name.toLowerCase();
        const owner = owners.get(key);
        if (owner !== undefined && owner !== entry.id)
          clashes.push(`"${name}": ${owner}, ${entry.id}`);
        owners.set(key, entry.id);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("links related terms to other entries, never to itself", () => {
    const selfLinks = GLOSSARY.filter((entry) => entry.relatedTerms.includes(entry.id));
    expect(selfLinks.map((entry) => entry.id)).toEqual([]);
  });
});

describe("short definitions", () => {
  it.each(GLOSSARY.map((entry) => [entry.id, entry] as const))("%s is one sentence", (_, entry) => {
    expect(isOneSentence(entry.short), entry.short).toBe(true);
  });

  it("use no other jargon: another entry's name only if it's an everyday word", () => {
    const offenders = GLOSSARY.flatMap((entry) =>
      jargonIn(entry, GLOSSARY).map((name) => `${entry.id}: "${name}"`),
    );
    expect(offenders).toEqual([]);
  });

  it("contain no acronyms except the entry's own", () => {
    const offenders = GLOSSARY.flatMap((entry) => {
      const own = namesOf(entry).join(" ");
      return acronymsIn(entry.short)
        .filter((acronym) => !own.includes(acronym))
        .map((acronym) => `${entry.id}: ${acronym}`);
    });
    expect(offenders).toEqual([]);
  });
});

describe("all glossary text", () => {
  const texts = GLOSSARY.flatMap((entry) => [
    [`${entry.id} short`, entry.short],
    [`${entry.id} long`, entry.long],
  ]);

  it("uses none of the banned words from md-files/voice-and-tone.md", () => {
    const offenders = texts.flatMap(([where, text]) =>
      findBannedWords(prose(text ?? "")).map((word) => `${where}: "${word}"`),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps every domain and address fictional", () => {
    const offenders = texts.flatMap(([where, text = ""]) => [
      ...[...text.matchAll(/\b[a-z0-9-]+\.(?:com|net|org|io|co|uk|gov|edu)\b/gi)]
        .map((match) => match[0])
        .filter((domain) => domain.toLowerCase() !== "example.com")
        .map((domain) => `${where}: ${domain}`),
      ...[...text.matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g)]
        .map((match) => match[0])
        .filter((ip) => !/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(ip))
        .map((ip) => `${where}: ${ip}`),
    ]);
    expect(offenders).toEqual([]);
  });
});

describe("the checks themselves", () => {
  const entry = (overrides: Partial<GlossaryEntry>): GlossaryEntry => ({
    id: "x",
    term: "X",
    aka: [],
    topic: "networking",
    short: "A thing.",
    long: "More.",
    everyday: false,
    relatedTerms: [],
    relatedLessons: [],
    ...overrides,
  });

  it("flags jargon, plurals included, but not everyday words or code", () => {
    const port = entry({ id: "port", term: "Port" });
    const file = entry({ id: "file", term: "File", everyday: true });
    const scan = entry({
      id: "scan",
      term: "Scan",
      short: "Checking which ports are open and which files `port` names.",
    });
    expect(jargonIn(scan, [port, file, scan])).toEqual(["Port"]);
  });

  it("flags acronyms and extra sentences", () => {
    expect(acronymsIn("Uses TCP and SQLi, not `HTTP`.")).toEqual(["TCP", "SQLi"]);
    expect(isOneSentence("One idea. Then another.")).toBe(false);
    expect(isOneSentence('A tiny "are you there?" message.')).toBe(true);
    expect(isOneSentence("No full stop")).toBe(false);
  });
});
