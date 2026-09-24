import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRACTICE_STORIES, PRACTICE_STORY_IDS } from "@/content/practice/stories";
import { EvidenceSetSchema, generate, stableStringify } from "@/sim";
import { readIfThere } from "./support";

/**
 * The lessons' practice evidence (src/content/practice): the same staleness and determinism
 * guarantees as a case's (case-evidence.test.ts), so a lesson's practice terminal always examines
 * exactly what its story leaves behind.
 */

const PRACTICE_DIR = join(process.cwd(), "src", "content", "practice");

describe.each(PRACTICE_STORIES.map((story) => [story.id, story] as const))("%s", (id, story) => {
  const built = generate(story);

  it("has the evidence committed beside it that its story builds today", () => {
    const committed = readIfThere(join(PRACTICE_DIR, `${id}.evidence.json`));
    expect(
      committed,
      `practice/${id}.evidence.json is missing or out of date. Run \`pnpm evidence:build\`.`,
    ).toBe(`${stableStringify(built.evidence, 2)}\n`);
  });

  it("builds the same bytes every time", () => {
    expect(stableStringify(generate(story).evidence)).toBe(stableStringify(built.evidence));
  });

  it("matches the evidence model", () => {
    expect(EvidenceSetSchema.safeParse(built.evidence).success).toBe(true);
  });

  it("hands over one disk, with its hashes on the form", () => {
    expect(built.evidence.disks.map((disk) => disk.id)).toEqual([id]);
    expect(built.evidence.handover.map((item) => item.item)).toEqual([id]);
    expect(built.evidence.handover[0]?.hashes?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the practice folder", () => {
  it("holds evidence only for stories that exist", () => {
    const built = readdirSync(PRACTICE_DIR)
      .map((name) => /^(.+)\.evidence\.json$/.exec(name)?.[1])
      .filter((id) => id !== undefined);
    expect(built.sort()).toEqual([...PRACTICE_STORY_IDS].sort());
  });
});

describe("the practice laptop", () => {
  const laptop = PRACTICE_STORIES.find((story) => story.id === "train-lt-01");
  const disk = laptop && generate(laptop).evidence.disks[0];
  const record = (name: string) => disk?.records.find((entry) => entry.path.endsWith(name));

  it("has the deleted files the Disk lessons point at", () => {
    expect(record("letter-draft.txt")?.deleted).toBe(true);
    expect(record("old-note.txt")?.deleted).toBe(true);
    expect(record("handout.pdf")?.deleted).toBe(true);
    // The note's only cluster now belongs to the update log: deleted and overwritten.
    expect(record("update.log")?.clusters).toEqual(record("old-note.txt")?.clusters);
  });

  it("gives plan.txt four different moments: born, then modified and changed, then accessed", () => {
    const times = record("plan.txt")?.times;
    expect(times && times.b < times.m && times.m === times.c && times.c < times.a).toBe(true);
  });
});
