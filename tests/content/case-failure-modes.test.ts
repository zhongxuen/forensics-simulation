import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { beforeAll, describe, expect, it } from "vitest";
import { parseCase, type Case } from "@/content/cases/schema";
import {
  buildCase,
  CASES_DIR,
  loadPlaythrough,
  verifyPlaythrough,
  type BuiltCase,
} from "@/features/cases/server";
import {
  answerIntegrityProblems,
  committedEvidence,
  consistencyProblems,
  EVIDENCE_DIR,
  readIfThere,
  stalenessProblems,
} from "./support";

/**
 * The failure modes, proved (docs/plan/03-case-format-and-generator.md §Done when).
 *
 * Every other test in this folder asserts that nothing is wrong. That is worth very little on its
 * own: a check that can never fail passes just as quietly as one that works. So this file takes
 * the fixture, **moves one story action an hour later in memory**, and shows each guard catching
 * it — with the message an author would read, naming the action that moved.
 *
 * One edit, three different ways of noticing:
 *
 * - **consistency**: the artefacts the story now claims are not in the evidence that ships;
 * - **answer integrity**: the report's answer key still says the old time;
 * - **staleness**: the committed JSON is no longer what the story builds.
 *
 * Nothing here writes to disk: the fixture and its evidence are read, changed in memory, and
 * thrown away.
 */

const HOUR = 3_600_000;
const MOVED = "docket-deleted";

/** The fixture as written, and the fixture with one action moved an hour later. */
let asWritten: BuiltCase;
let moved: BuiltCase;
let movedCase: Case;

beforeAll(() => {
  const source = parseYaml(readFileSync(join(CASES_DIR, "_fixture.yaml"), "utf8")) as Record<
    string,
    unknown
  >;
  asWritten = buildCase(parsed(source));

  const draft = structuredClone(source);
  const story = draft.story as Record<string, unknown>[];
  const index = story.findIndex((action) => action.id === MOVED);
  expect(index, `the fixture has no story action with the id "${MOVED}"`).toBeGreaterThanOrEqual(0);
  const action = story[index] as { at: string };
  story[index] = { ...action, at: new Date(Date.parse(action.at) + HOUR).toISOString() };

  movedCase = parsed(draft);
  moved = buildCase(movedCase);
});

function parsed(data: unknown): Case {
  const result = parseCase(data);
  if (!result.success) throw new Error(result.problems.join("\n"));
  return result.case;
}

describe("the fixture as it is written", () => {
  it("passes all three checks, so a failure below is the edit and nothing else", () => {
    const evidence = committedEvidence("_fixture");
    expect(evidence).toBeDefined();
    expect(consistencyProblems(asWritten.result, evidence ?? asWritten.evidence)).toEqual([]);
    expect(answerIntegrityProblems(asWritten.case)).toEqual([]);
    expect(
      stalenessProblems(asWritten, readIfThere(join(EVIDENCE_DIR, "_fixture", "evidence.json"))),
    ).toEqual([]);
  });
});

describe("one story action, moved an hour later", () => {
  it("fails consistency, naming the action and what no longer matches", () => {
    const shipping = committedEvidence("_fixture");
    expect(shipping).toBeDefined();
    const problems = consistencyProblems(moved.result, shipping ?? moved.evidence);

    expect(problems.length, "moving an action changed nothing in the evidence").toBeGreaterThan(0);
    const message = problems.join("\n");
    expect(message).toContain(MOVED);
    expect(message).toContain("delete-file on qf-lt-03");
    // The time the story now claims, and the time the evidence still records.
    expect(message).toContain("2026-04-11T22:51:07Z");
    expect(message).toContain("2026-04-11T21:51:07Z");
    expect(message).toContain("pnpm evidence:build");
  });

  it("fails answer integrity, naming the question and how far apart the two are", () => {
    const problems = answerIntegrityProblems(movedCase);

    expect(problems.length, "the answer key still agreed with the moved action").toBe(1);
    const message = problems.join("\n");
    expect(message).toContain("report.questions[when-deleted]");
    expect(message).toContain(MOVED);
    expect(message).toContain("2026-04-11T21:51:07Z");
    expect(message).toContain("2026-04-11T22:51:07Z");
    expect(message).toMatch(/3600s apart, and the question allows 60s/);
  });

  it("fails staleness, saying what to run", () => {
    const problems = stalenessProblems(
      moved,
      readIfThere(join(EVIDENCE_DIR, "_fixture", "evidence.json")),
    );

    expect(problems.length, "the committed evidence didn't change").toBe(1);
    const message = problems.join("\n");
    expect(message).toContain("src/content/evidence/_fixture/evidence.json");
    expect(message).toContain("pnpm evidence:build");
  });

  it("still plays to the end, which is why the three checks above have to exist", () => {
    // Generating evidence means the way through a case survives an edit to its story: the
    // playthrough alone would never notice. What does not move with the story is the answer key an
    // author wrote by hand, and that is exactly the drift the checks above are for.
    const playthrough = loadPlaythrough("_fixture");
    expect(playthrough).toBeDefined();
    if (!playthrough) return;
    const { result, problems } = verifyPlaythrough(moved, playthrough);
    expect(problems).toEqual([]);
    expect(result.complete).toBe(true);
  });
});

describe("a report question whose evidence has moved out from under it", () => {
  it("stops the build, naming the pattern that matches nothing", () => {
    const source = parseYaml(readFileSync(join(CASES_DIR, "_fixture.yaml"), "utf8")) as Record<
      string,
      unknown
    >;
    const draft = structuredClone(source);
    const report = draft.report as { questions: Record<string, unknown>[] };
    report.questions[0] = {
      ...report.questions[0],
      acceptedEvidence: ["disk:qf-lt-03:mft/*a-file-that-was-never-there*"],
    };

    expect(() => buildCase(parsed(draft))).toThrowError(/matches nothing in this case's evidence/);
  });
});

describe("a story the generator can't play", () => {
  it("stops the build, saying what is missing", () => {
    const source = parseYaml(readFileSync(join(CASES_DIR, "_fixture.yaml"), "utf8")) as Record<
      string,
      unknown
    >;
    const draft = structuredClone(source);
    const story = draft.story as Record<string, unknown>[];
    const index = story.findIndex((action) => action.id === "docket-written");
    story.splice(index, 1);

    expect(() => buildCase(parsed(draft))).toThrowError(/the story can't be played/);
  });
});
