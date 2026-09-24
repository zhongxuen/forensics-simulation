/**
 * The memory tools end to end (docs/plan/08-memory-tools.md): a committed transcript of one pass
 * through a memory image, info → ps → psscan → pstree → netscan → cmdline → malfind, which has to
 * be the same bytes every run. Never edit the transcript by hand: delete it and rerun this test
 * after an intentional change to the output, then read the diff.
 */
import { describe, expect, it } from "vitest";
import type { ReplayStep } from "../../../core/replay";
import { renderTranscript } from "../../../core/transcript";
import { runAll } from "../__fixtures__/evidence";
import { MEM_IMAGE, memoryState } from "./__fixtures__/memory";

/** One pass through a memory image, in the order an examiner runs it. */
const WORKFLOW: readonly (readonly string[])[] = [
  ["mem", "info", MEM_IMAGE],
  ["mem", "ps", MEM_IMAGE],
  ["mem", "psscan", MEM_IMAGE],
  ["mem", "pstree", MEM_IMAGE],
  ["mem", "netscan", MEM_IMAGE],
  ["mem", "cmdline", MEM_IMAGE],
  ["mem", "malfind", MEM_IMAGE],
];

function transcript(): string {
  const { results } = runAll(memoryState(), WORKFLOW);
  const steps: ReplayStep[] = results.map((result, index) => ({
    command: { type: "exec", argv: WORKFLOW[index] as readonly string[] },
    output: result.output,
    events: result.events,
    exitCode: result.exitCode,
  }));
  return renderTranscript(steps);
}

describe("the memory tools, end to end", () => {
  it("matches the committed transcript", async () => {
    await expect(transcript()).toMatchFileSnapshot("./__fixtures__/golden/mem-tools.txt");
  });

  it("is byte-identical when run twice", () => {
    expect(transcript()).toBe(transcript());
  });

  it("succeeds at every step and emits one memory event per step", () => {
    const { results } = runAll(memoryState(), WORKFLOW);
    expect(results.map((result) => result.exitCode)).toEqual(WORKFLOW.map(() => 0));
    expect(results.map((result) => result.events[0]?.type)).toEqual([
      "memory.inspected",
      "memory.listed",
      "memory.scanned",
      "memory.listed",
      "memory.scanned",
      "memory.inspected",
      "memory.scanned",
    ]);
  });
});
