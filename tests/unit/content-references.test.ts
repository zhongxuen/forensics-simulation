import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GLOSSARY } from "@/content/glossary";
import {
  CITATIONS,
  describeDeadReference,
  EXTERNAL_LESSONS,
  externalLessonUrl,
  findDeadReferences,
  getCitation,
  type ContentCatalog,
  type LessonReferences,
} from "@/content/references";
import {
  compileLessonBody,
  loadLessonCatalog,
  renderLessonBody,
  type LessonCatalog,
} from "@/features/learning/server";
import { listTools } from "@/sim";

/**
 * CI fails on a dead cross-reference anywhere in the learning content
 * (docs/plan/13-learning-center.md): lesson prerequisites, related commands, glossary terms in
 * frontmatter and in <Term>, glossary cross-links, and citations. Every lesson cites at least one
 * primary source from src/content/references.ts. It also builds and renders every lesson, so a
 * broken one never ships. Vendored from ../hacker-simulation, with missions taken out (this game
 * has cases, file 03) and citations added.
 */

/**
 * The real glossary without its links to lessons, for checking the fixture lessons: those links
 * point at the real lessons, and are checked against them in "the real content".
 */
const GLOSSARY_TERMS_ONLY = GLOSSARY.map((entry) => ({ ...entry, relatedLessons: [] }));

/** Every command a learner can type: the simulated tools and the Linux command set (ls, cd, …). */
const COMMANDS: readonly string[] = listTools().map((tool) => tool.name);

async function lessonReferences(catalog: LessonCatalog): Promise<LessonReferences[]> {
  return Promise.all(
    catalog.lessons.map(async (lesson) => {
      const compiled = await compileLessonBody(lesson.body, lesson.id);
      return { ...lesson, termsInBody: compiled.termIds, missionsInBody: compiled.missionIds };
    }),
  );
}

describe("the real content", () => {
  const lessons = loadLessonCatalog();

  it("has no dead cross-references", async () => {
    const dead = findDeadReferences({
      lessons: await lessonReferences(lessons),
      glossary: GLOSSARY,
      missions: [],
      commands: COMMANDS,
    });
    expect(dead.map(describeDeadReference)).toEqual([]);
  });

  it("cites at least one primary source in every lesson", () => {
    const uncited = lessons.lessons.filter((lesson) => lesson.cites.length === 0);
    expect(uncited.map((lesson) => lesson.id)).toEqual([]);
  });

  it("names the section and the source of every citation it uses", () => {
    for (const lesson of lessons.lessons) {
      const text = lesson.body.replace(/\s+/g, " ");
      for (const id of lesson.cites) {
        const citation = getCitation(id);
        expect(citation, `${lesson.id} cites ${id}`).toBeDefined();
        // The lesson text says which document it leans on, so a reader can follow it up.
        expect(text, `${lesson.id} names ${citation?.source}`).toContain(citation?.source);
      }
    }
  });

  it("has no loops in lesson prerequisites", () => {
    expect(lessons.graph.cycles).toEqual([]);
  });

  // Compiling and rendering every lesson takes a few seconds, so it gets a timeout that fits.
  it("builds and renders every lesson", { timeout: 30_000 }, async () => {
    for (const lesson of lessons.lessons) {
      const { content } = await renderLessonBody(lesson.body, lesson.id);
      expect(renderToStaticMarkup(content), lesson.id).not.toBe("");
    }
  });

  it("knows the engine's commands", () => {
    expect(COMMANDS).toEqual(
      expect.arrayContaining(["logview", "ls", "cat", "grep", "stat", "ps", "man"]),
    );
  });
});

describe("the citations", () => {
  it("have unique ids in the content id format", () => {
    const ids = CITATIONS.map((citation) => citation.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("each name a section, a free link and the date it was checked against the source", () => {
    for (const citation of CITATIONS) {
      expect(citation.section, citation.id).toMatch(/§\d/);
      expect(citation.url, citation.id).toMatch(/^https:\/\//);
      expect(citation.checked, citation.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(citation.supports, citation.id).toMatch(/\.$/);
    }
  });

  it("are all cited by some lesson", () => {
    const cited = new Set(loadLessonCatalog().lessons.flatMap((lesson) => lesson.cites));
    expect(CITATIONS.filter((citation) => !cited.has(citation.id)).map((c) => c.id)).toEqual([]);
  });
});

describe("the external prerequisites", () => {
  it("are the six Hacker Simulation lessons the plan names, on its Learning Center", () => {
    expect(EXTERNAL_LESSONS.map((lesson) => lesson.id)).toEqual([
      "forensics-what-logs-are",
      "forensics-timelines",
      "forensics-evidence-care",
      "blue-incident-response",
      "blue-reading-alerts",
      "crypto-hashing",
    ]);
    expect(externalLessonUrl("crypto-hashing")).toBe(
      "https://hacker-simulation.vercel.app/learn/crypto-hashing",
    );
  });
});

describe("the fixture lessons", () => {
  it("resolve against the real glossary and commands", async () => {
    const catalog = loadLessonCatalog(join(import.meta.dirname, "fixtures", "lessons"));
    const lessons = await lessonReferences(catalog);
    expect(lessons.find((lesson) => lesson.id === "fx-ports")?.termsInBody).toEqual([
      "port",
      "service",
    ]);
    const dead = findDeadReferences({
      lessons,
      glossary: GLOSSARY_TERMS_ONLY,
      missions: [],
      commands: COMMANDS,
    });
    expect(dead.map(describeDeadReference)).toEqual([]);
  });
});

describe("findDeadReferences", () => {
  const lesson = (overrides: Partial<LessonReferences> & { id: string }): LessonReferences => ({
    prerequisites: [],
    relatedMissions: [],
    relatedCommands: [],
    glossaryTerms: [],
    ...overrides,
  });

  const catalog: ContentCatalog = {
    lessons: [
      lesson({ id: "net-ip" }),
      lesson({
        id: "net-ports",
        prerequisites: ["net-ip", "net-basics"],
        relatedMissions: ["net-01", "net-99"],
        relatedCommands: ["netscan", "nmap"],
        glossaryTerms: ["port", "portal"],
        cites: ["rfc-793", "rfc-9999"],
        termsInBody: ["port", "banner", "banner"],
      }),
    ],
    glossary: [
      { id: "port", relatedTerms: ["banner", "service"], relatedLessons: ["net-ports", "web-01"] },
    ],
    missions: [
      { id: "net-01", concepts: ["net-ports"] },
      { id: "web-01", concepts: ["web-http"] },
    ],
    commands: ["netscan"],
    citations: ["rfc-793"],
  };

  it("finds every kind of dead reference, once each", () => {
    expect(findDeadReferences(catalog).map(describeDeadReference)).toEqual([
      'lesson net-ports → prerequisites: no lesson with id "net-basics"',
      'lesson net-ports → relatedMissions: no mission with id "net-99"',
      'lesson net-ports → relatedCommands: no command with id "nmap"',
      'lesson net-ports → glossaryTerms: no glossary term with id "portal"',
      'lesson net-ports → cites: no citation with id "rfc-9999"',
      'lesson net-ports → <Term> in body: no glossary term with id "banner"',
      'glossary port → relatedTerms: no glossary term with id "banner"',
      'glossary port → relatedTerms: no glossary term with id "service"',
      'glossary port → relatedLessons: no lesson with id "web-01"',
      'mission web-01 → concepts: no lesson with id "web-http"',
    ]);
  });

  it("checks citations against CITATIONS when the catalog doesn't list them", () => {
    const dead = findDeadReferences({
      lessons: [lesson({ id: "a", cites: ["rfc-3227-s2-1", "not-a-citation"] })],
      glossary: [],
      missions: [],
      commands: [],
    });
    expect(dead.map(describeDeadReference)).toEqual([
      'lesson a → cites: no citation with id "not-a-citation"',
    ]);
  });

  it("finds nothing in a sound catalog", () => {
    expect(
      findDeadReferences({
        lessons: [lesson({ id: "a", glossaryTerms: ["port"], termsInBody: ["port"] })],
        glossary: [{ id: "port", relatedTerms: [], relatedLessons: ["a"] }],
        missions: [{ id: "m", concepts: ["a"] }],
        commands: [],
      }),
    ).toEqual([]);
  });
});
