import { describe, expect, it } from "vitest";
import {
  getMiniTerminal,
  MINI_TERMINALS,
  PRACTICE_NOTE,
  PRACTICE_NOTE_CHANGED,
  PRACTICE_NOTE_CHANGED_SHA256,
  PRACTICE_NOTE_SHA256,
  TRAIN_07_SHA256,
  type MiniTerminalScenario,
} from "@/content/mini-terminals";
import { PRACTICE_STORY_IDS } from "@/content/practice/stories";
import { TRACKS } from "@/content/tracks";
import { findBannedWords } from "@/content/voice";
import { practiceEvidence, practiceSetup } from "@/features/learning";
import { compileLessonBody, loadLessonCatalog, type Lesson } from "@/features/learning/server";
import { createTerminalSession, submitLine } from "@/features/terminal";
import { utf8Bytes } from "@/sim/evidence";
import { hashHex } from "@/sim/evidence/hash";

/**
 * The lessons themselves (docs/plan/13-learning-center.md and docs/plan/99-reference.md, "Lesson
 * structure" and "Voice"): the catalog is all there, every lesson follows the six-section shape,
 * has something to do on its first screen, a <Quiz> and a <MiniTerminal>, defines its glossary words
 * with <Term>, names the case where the player meets it, keeps to the voice rules, and stays
 * fictional. Cross-references and citations are checked in content-references.test.ts. Vendored
 * from ../hacker-simulation and adapted to this game's tracks.
 */

const catalog = loadLessonCatalog();
const lessons = catalog.lessons;

/** Every lesson, by track (docs/plan/13-learning-center.md, "Tracks and lessons"). */
const EXPECTED_LESSONS = [
  "foundations-what-forensics-is",
  "foundations-order-of-volatility",
  "foundations-chain-of-custody",
  "foundations-hashing-for-evidence",
  "disk-partitions-and-filesystems",
  "disk-macb-timestamps",
  "disk-deleted-vs-overwritten",
  "disk-carving",
  "memory-why-ram-matters",
  "memory-processes-and-parents",
  "memory-network-artefacts",
  "memory-code-injection",
  "logs-windows-logon-events",
  "logs-time-zones-and-clocks",
  "logs-super-timelines",
  "report-writing-the-report",
];

/** The six sections, in order. Level 0 lessons may leave out "how it works" and misconceptions. */
const SECTIONS = [
  {
    name: "The one-sentence version",
    pattern: /^The one-sentence version$/,
    optionalAtLevel0: false,
  },
  { name: "Why it matters…", pattern: /^Why it matters/, optionalAtLevel0: false },
  { name: "How it actually works", pattern: /^How it actually works$/, optionalAtLevel0: true },
  { name: "See it / Try it", pattern: /^(See it|Try it)\b/, optionalAtLevel0: false },
  { name: "In practice", pattern: /^In practice$/, optionalAtLevel0: false },
  { name: "Common misconceptions", pattern: /^Common misconceptions$/, optionalAtLevel0: true },
] as const;

const INTERACTIVE = /<(Quiz|MiniTerminal|Annotated|PacketDiagram)\b/;

/** The body with code, component props, markup and comments removed: what a reader reads as prose. */
function prose(body: string): string {
  return body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "")
    .replace(/<\/?[A-Z][A-Za-z]*\b[^>]*?>/g, (tag) => tag.replace(/[a-z]+=\{?`[\s\S]*?`\}?/g, ""))
    .replace(/https?:\/\/\S+/g, "");
}

/** The body of one `## heading` section, up to the next one. */
function section(body: string, heading: RegExp): string {
  const parts = body.split(/^## /m);
  return parts.find((part) => heading.test(part.split("\n")[0] ?? "")) ?? "";
}

/** Each <MiniTerminal>'s practice machine and suggested commands, read from the lesson source. */
function miniTerminals(body: string): { scenario: string; commands: string[] }[] {
  return [...body.matchAll(/<MiniTerminal\b([\s\S]*?)\/>/g)].map((match) => {
    const props = match[1] ?? "";
    const list = /commands=\{\[([\s\S]*?)\]\}/.exec(props)?.[1] ?? "";
    return {
      scenario: /scenario="([^"]+)"/.exec(props)?.[1] ?? "",
      // Each command is a JavaScript string in the lesson, so `\\` in the source is one backslash.
      commands: [...list.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(
        (command) => JSON.parse(`"${command[1] ?? ""}"`) as string,
      ),
    };
  });
}

/** A fresh practice terminal on this machine, with its practice evidence attached and prepared. */
async function practiceSession(mini: MiniTerminalScenario) {
  const setup =
    mini.evidence === undefined
      ? undefined
      : practiceSetup(mini, await practiceEvidence(mini.evidence));
  return createTerminalSession({
    scenario: mini.scenario,
    seed: mini.seed,
    ...(setup && { setup }),
  });
}

const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
const eachLesson = lessons.map((lesson) => [lesson.id, lesson] as const);

describe("the lesson catalog", () => {
  it("has every lesson written so far", () => {
    expect(EXPECTED_LESSONS.filter((id) => !byId.has(id))).toEqual([]);
  });

  it("points every track at real lessons, each listed once", () => {
    for (const track of TRACKS) {
      expect(
        track.lessons.filter((id) => !byId.has(id)),
        track.id,
      ).toEqual([]);
      expect(new Set(track.lessons).size, track.id).toBe(track.lessons.length);
    }
  });

  it("puts every lesson in a track", () => {
    const tracked = new Set(TRACKS.flatMap((track) => track.lessons));
    expect(lessons.filter((lesson) => !tracked.has(lesson.id)).map((l) => l.id)).toEqual([]);
  });

  it("orders each track so no lesson comes before its prerequisites", () => {
    for (const track of TRACKS) {
      track.lessons.forEach((id, index) => {
        const earlier = new Set(track.lessons.slice(0, index));
        const inTrack = (byId.get(id)?.prerequisites ?? []).filter((p) =>
          track.lessons.includes(p),
        );
        expect(
          inTrack.filter((p) => !earlier.has(p)),
          id,
        ).toEqual([]);
      });
    }
  });
});

describe.each(eachLesson)("lesson %s", (_id, lesson: Lesson) => {
  it("follows the six-section structure, in order", async () => {
    const { toc } = await compileLessonBody(lesson.body, lesson.id);
    const headings = toc.filter((entry) => entry.depth === 2).map((entry) => entry.text);
    const found = SECTIONS.map((s) => headings.findIndex((text) => s.pattern.test(text)));
    const missing = SECTIONS.filter(
      (s, index) => found[index] === -1 && !(s.optionalAtLevel0 && lesson.level === 0),
    ).map((s) => s.name);
    expect(missing).toEqual([]);
    const present = found.filter((index) => index !== -1);
    expect(present).toEqual([...present].sort((a, b) => a - b));
  });

  it("has something to click, type or answer on its first screen", () => {
    const sections = lesson.body.split(/^## /m);
    // sections[0] is anything before the first heading; the first screen is the first two sections.
    expect(INTERACTIVE.test(sections.slice(0, 3).join("## "))).toBe(true);
  });

  it("has a quiz, and a practice terminal in its See it section", () => {
    expect(lesson.body).toMatch(/<Quiz\b/);
    expect(section(lesson.body, /^(See it|Try it)\b/)).toMatch(/<MiniTerminal\b/);
  });

  it("suggests only commands that work on its practice machine", async () => {
    const minis = miniTerminals(lesson.body);
    expect(minis.length).toBeGreaterThan(0);
    for (const { scenario, commands } of minis) {
      const mini = getMiniTerminal(scenario);
      expect(mini, scenario).toBeDefined();
      if (!mini) continue;
      expect(commands.length, scenario).toBeGreaterThan(0);
      let session = await practiceSession(mini);
      for (const command of commands) {
        session = submitLine(session, command);
        expect(session.blocks.at(-1)?.exitCode, `${lesson.id}: ${command}`).toBe(0);
      }
    }
  });

  it("names the case where the player meets it", () => {
    expect(section(lesson.body, /^In practice$/)).toMatch(/\]\(\/cases\/case-0\d\)/);
  });

  it("defines its glossary words with <Term> in the body", async () => {
    const { termIds } = await compileLessonBody(lesson.body, lesson.id);
    expect(lesson.glossaryTerms.filter((id) => !termIds.includes(id))).toEqual([]);
    expect(termIds.length).toBeGreaterThan(0);
  });

  it("uses none of the banned words", () => {
    const text = [
      lesson.title,
      lesson.summary ?? "",
      lesson.analogy ?? "",
      prose(lesson.body),
    ].join("\n");
    expect(findBannedWords(text)).toEqual([]);
  });

  it("keeps every domain and address fictional", () => {
    // Section numbers like §5.2.1.3 look like addresses, so they come out first.
    const text = lesson.body.replace(/§\d+(?:\.\d+)*/g, "");
    const domains = [...text.matchAll(/\b[a-z0-9-]+\.(?:com|net|org|io|co|uk|gov|edu)\b/gi)]
      .map((match) => match[0])
      .filter((domain) => domain.toLowerCase() !== "example.com");
    const addresses = [...text.matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g)]
      .map((match) => match[0])
      .filter(
        (ip) =>
          !/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|127\.|0\.0\.0\.0|255\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/.test(
            ip,
          ),
      );
    expect([...domains, ...addresses]).toEqual([]);
  });
});

describe("the practice workstation", () => {
  const practice = getMiniTerminal("ir-ws-practice");
  const files = new Map(
    (practice?.scenario.network.hosts[0]?.fs?.entries ?? []).map((entry) => [
      entry.path,
      "content" in entry ? entry.content : undefined,
    ]),
  );

  it("is the analyst workstation, signed in as examiner", () => {
    expect(practice?.scenario.session).toEqual({ host: "ir-ws-01", user: "examiner" });
    expect(practice?.scenario.network.hosts[0]?.hostname).toBe("ir-ws-01.candlewright.example");
  });

  it("records real hashes: each SHA-256 is the hash of the file it names", () => {
    const sha256 = (text: string) => hashHex("sha256", utf8Bytes(text));
    expect(sha256(PRACTICE_NOTE)).toBe(PRACTICE_NOTE_SHA256);
    expect(sha256(PRACTICE_NOTE_CHANGED)).toBe(PRACTICE_NOTE_CHANGED_SHA256);
    expect(files.get("/home/examiner/copies/copy-a/note.txt")).toBe(PRACTICE_NOTE);
    expect(files.get("/home/examiner/copies/copy-b/note.txt")).toBe(PRACTICE_NOTE_CHANGED);

    const hashes = files.get("/home/examiner/hashes.txt") ?? "";
    for (const [hash, path] of [...hashes.matchAll(/^([0-9a-f]{64}) {2}(\S+)$/gm)].map(
      (match) => [match[1] ?? "", match[2] ?? ""] as const,
    )) {
      expect(sha256(files.get(`/home/examiner/${path}`) ?? ""), path).toBe(hash);
    }
    expect(files.get("/home/examiner/handover.txt")).toContain(PRACTICE_NOTE_SHA256);
  });

  it("puts the stick's real SHA-256 on the handover form: the one its hand-over took", async () => {
    const evidence = await practiceEvidence("train-07");
    expect(evidence.handover[0]?.hashes?.sha256).toBe(TRAIN_07_SHA256);
    expect(files.get("/home/examiner/handover.txt")).toContain(TRAIN_07_SHA256);
  });

  it("keeps the two copies the same size, so only the hash tells them apart", () => {
    expect(utf8Bytes(PRACTICE_NOTE).length).toBe(utf8Bytes(PRACTICE_NOTE_CHANGED).length);
    expect(PRACTICE_NOTE).not.toBe(PRACTICE_NOTE_CHANGED);
  });

  it("has a custody log with the gap the chain-of-custody lesson points at", () => {
    const log = files.get("/home/examiner/custody-log.txt") ?? "";
    expect(log.split("\n").filter((line) => line.includes("0413"))).toHaveLength(1);
    expect(log).toMatch(/copy-b/);
  });
});

describe("the practice evidence", () => {
  const withEvidence = MINI_TERMINALS.filter((mini) => mini.evidence !== undefined);

  it("names only practice stories that exist", () => {
    const named = withEvidence.map((mini) => mini.evidence ?? "");
    expect(named.filter((id) => !PRACTICE_STORY_IDS.includes(id))).toEqual([]);
  });

  it.each(withEvidence.map((mini) => [mini.id, mini] as const))(
    "%s starts with its evidence attached, write-blockers on",
    async (_id, mini) => {
      const session = await practiceSession(mini);
      const attached = Object.values(session.sim.evidence?.attached ?? {});
      expect(attached.map((item) => item.id)).toEqual([mini.evidence]);
      expect(attached.every((item) => item.blocker)).toBe(true);
    },
  );
});
