import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPrerequisiteGraph } from "@/content/lesson-graph";
import {
  compileLessonBody,
  LessonSourceError,
  loadLessonCatalog,
  parseLessonSource,
  renderLessonBody,
} from "@/features/learning/server";

/** The lesson pipeline (md-files/09-learning-center.md, prompt 09.1), run over fixture lessons. */

const FIXTURES = join(import.meta.dirname, "fixtures", "lessons");

const frontmatter = (fields: string) => `---\n${fields.trim()}\n---\n\n## Body\n\nText.\n`;

const VALID = `
id: net-ports
title: Ports and services
topic: networking
level: 1
readingMinutes: 4
analogy: "A port is like a numbered door."
`;

/** The problems a LessonSourceError reports for `source`, or [] if it parses. */
function problemsWith(source: string, fileName = "net-ports.mdx"): readonly string[] {
  try {
    parseLessonSource(source, fileName);
    return [];
  } catch (error) {
    if (error instanceof LessonSourceError) return error.problems;
    throw error;
  }
}

describe("parseLessonSource", () => {
  it("splits valid frontmatter from the body and fills in empty lists", () => {
    const { frontmatter: meta, body } = parseLessonSource(frontmatter(VALID), "net-ports.mdx");
    expect(meta).toMatchObject({
      id: "net-ports",
      topic: "networking",
      level: 1,
      prerequisites: [],
      relatedMissions: [],
      relatedCommands: [],
      glossaryTerms: [],
    });
    expect(body.trim()).toBe("## Body\n\nText.");
  });

  it("explains a missing frontmatter block or broken YAML", () => {
    expect(problemsWith("## No frontmatter")[0]).toMatch(/Start the file with frontmatter/);
    expect(problemsWith("---\ntitle: [unclosed\n---\n")[0]).toMatch(/isn't valid YAML/);
  });

  it("rejects unknown keys, so a typo can't hide", () => {
    expect(problemsWith(frontmatter(`${VALID}\nprerequisite: [net-ip]`)).join()).toMatch(
      /prerequisite/,
    );
  });

  it("requires an analogy and a short reading time at levels 0 and 1", () => {
    const noAnalogy = VALID.replace(/analogy:.*\n/, "");
    expect(problemsWith(frontmatter(noAnalogy))).toEqual([
      "analogy: Level 1 lessons need an analogy: start from something familiar.",
    ]);
    expect(
      problemsWith(frontmatter(VALID.replace("readingMinutes: 4", "readingMinutes: 6"))),
    ).toEqual([
      "readingMinutes: Level 1 lessons take 5 minutes or less. Split it into two lessons.",
    ]);
    const deep = VALID.replace("level: 1", "level: 2").replace(/analogy:.*\n/, "");
    expect(
      problemsWith(frontmatter(deep.replace("readingMinutes: 4", "readingMinutes: 12"))),
    ).toEqual([]);
  });

  it("rejects unknown topics, levels out of range, and badly formed ids", () => {
    expect(problemsWith(frontmatter(VALID.replace("networking", "hacking")))).toHaveLength(1);
    expect(problemsWith(frontmatter(VALID.replace("level: 1", "level: 4")))).toHaveLength(1);
    expect(problemsWith(frontmatter(`${VALID}\nglossaryTerms: [IP_Address]`)).join()).toMatch(
      /lowercase/,
    );
  });

  it("rejects a lesson that lists itself or repeats a prerequisite", () => {
    expect(problemsWith(frontmatter(`${VALID}\nprerequisites: [net-ports]`))).toEqual([
      "prerequisites: A lesson can't be its own prerequisite.",
    ]);
    expect(problemsWith(frontmatter(`${VALID}\nprerequisites: [net-ip, net-ip]`)).join()).toMatch(
      /only once/,
    );
  });

  it("requires the id to match the file name, and keeps page names free", () => {
    expect(problemsWith(frontmatter(VALID), "net-port.mdx")[0]).toMatch(/Rename one/);
    expect(
      problemsWith(frontmatter(VALID.replace("net-ports", "glossary")), "glossary.mdx")[0],
    ).toMatch(/taken by a page/);
  });
});

describe("loadLessonCatalog", () => {
  const catalog = loadLessonCatalog(FIXTURES);

  it("reads every lesson, grouped by topic, each after its prerequisites", () => {
    // fx-alpha's title sorts before fx-ports', but it builds on fx-ports.
    expect(catalog.lessons.map((lesson) => lesson.id)).toEqual([
      "fx-intro",
      "fx-ports",
      "fx-alpha",
    ]);
  });

  it("looks lessons up by id and exposes the prerequisite graph", () => {
    expect(catalog.getLesson("fx-ports")?.title).toBe("Ports and services");
    expect(catalog.getLesson("nope")).toBeUndefined();
    expect(catalog.graph.prerequisitesOf("fx-alpha")).toEqual(["fx-ports"]);
    expect(catalog.graph.allPrerequisitesOf("fx-alpha")).toEqual(["fx-ports", "fx-intro"]);
    expect(catalog.graph.dependentsOf("fx-intro")).toEqual(["fx-ports"]);
    expect(catalog.graph.cycles).toEqual([]);
  });
});

describe("buildPrerequisiteGraph", () => {
  it("orders lessons after their prerequisites and ignores missing ones", () => {
    const graph = buildPrerequisiteGraph([
      { id: "c", prerequisites: ["b", "gone"] },
      { id: "b", prerequisites: ["a"] },
      { id: "a", prerequisites: [] },
    ]);
    expect(graph.order).toEqual(["a", "b", "c"]);
    expect(graph.prerequisitesOf("c")).toEqual(["b"]);
    expect(graph.cycles).toEqual([]);
  });

  it("reports every loop, so a reader is never sent round in circles", () => {
    const graph = buildPrerequisiteGraph([
      { id: "a", prerequisites: ["c"] },
      { id: "b", prerequisites: ["a"] },
      { id: "c", prerequisites: ["b"] },
    ]);
    expect(graph.cycles).toEqual([["a", "c", "b", "a"]]);
    expect(new Set(graph.order)).toEqual(new Set(["a", "b", "c"]));
  });
});

describe("compileLessonBody", () => {
  it("builds a table of contents with stable anchor ids, and collects <Term> ids", async () => {
    const { toc, termIds } = await compileLessonBody(
      '## Why it matters\n\nA <Term id="port">port</Term>.\n\n### The detail\n\n## Why it matters\n\n<Term id="service" />',
      "test",
    );
    expect(toc).toEqual([
      { id: "why-it-matters", text: "Why it matters", depth: 2 },
      { id: "the-detail", text: "The detail", depth: 3 },
      { id: "why-it-matters-1", text: "Why it matters", depth: 2 },
    ]);
    expect(termIds).toEqual(["port", "service"]);
  });

  it("refuses a # heading, import or export, and a <Term> without a plain id", async () => {
    await expect(compileLessonBody("# Title\n", "test")).rejects.toThrow(
      /Line 1: Use ## for sections/,
    );
    await expect(compileLessonBody('import x from "y"\n\nText.', "test")).rejects.toThrow(
      /can't use import or export/,
    );
    await expect(compileLessonBody("<Term id={name}>x</Term>", "test")).rejects.toThrow(/plain id/);
  });

  it("refuses a code fence in a language the highlighter doesn't load", async () => {
    await expect(compileLessonBody("```cobol\nDISPLAY 'HI'.\n```", "test")).rejects.toThrow(
      /Line 1: Code fences can't use "cobol"/,
    );
    await expect(
      compileLessonBody("```bash\nls\n```\n\n```\nplain\n```\n\n```text\nplain\n```", "test"),
    ).resolves.toBeDefined();
  });
});

describe("rendering a lesson", () => {
  const catalog = loadLessonCatalog(FIXTURES);

  it("renders every fixture lesson", async () => {
    for (const lesson of catalog.lessons) {
      const { content } = await renderLessonBody(lesson.body, lesson.id);
      expect(renderToStaticMarkup(content)).not.toBe("");
    }
  });

  it("highlights code with the token variables, labels it, and renders tables", async () => {
    const lesson = catalog.getLesson("fx-ports");
    if (!lesson) throw new Error("fixture missing");
    const html = renderToStaticMarkup((await renderLessonBody(lesson.body, lesson.id)).content);

    expect(html).toMatch(/<h2[^>]* id="the-one-sentence-version"/);
    expect(html).toContain("var(--code-token-");
    expect(html).not.toMatch(/#[0-9a-f]{6}/i);
    expect(html).toContain("Try this");
    expect(html).toContain(">terminal<");
    expect(html).toMatch(/<table[^>]*>/);
  });

  it("renders <Term> as a button described by its definition", async () => {
    const { content } = await renderLessonBody(
      'Every computer has <Term id="port">ports</Term>.',
      "t",
    );
    const html = renderToStaticMarkup(content);
    expect(html).toMatch(/<button[^>]*aria-describedby="[^"]+"[^>]*>ports<\/button>/);
    expect(html).toContain("A numbered door on a computer");
    expect(html).toContain('href="/learn/glossary#port"');
  });

  it("fails loudly on a <Term> with no glossary entry", async () => {
    const { content } = await renderLessonBody('<Term id="flux-capacitor" />', "t");
    expect(() => renderToStaticMarkup(content)).toThrow(/no glossary entry/);
  });
});
