import { describe, expect, it } from "vitest";
import {
  createCaseRun,
  currentObjective,
  objectiveSuggestions,
  type CaseRunState,
} from "@/features/cases";
import { toRunnableCase } from "@/features/cases/server";
import { defaultRegistry } from "@/sim";
import type { SimEvent } from "@/sim/types";
import { builtCases } from "./support";

/**
 * The terminal's suggestion chips in a case (UIUX.md §2.6): they follow the current objective,
 * name tools rather than hand over a hint's answer, and drop what has already worked.
 */

const ran = (line: string, exitCode = 0): SimEvent => ({
  type: "command.run",
  command: line.split(" ")[0] ?? "",
  line,
  exitCode,
});

const caseOne = builtCases.find((built) => built.case.id === "case-01");
if (!caseOne) throw new Error("case-01 is missing");
const CASE_ONE = toRunnableCase(caseOne);

const at = (completed: readonly string[], events: readonly SimEvent[] = []): CaseRunState => ({
  ...createCaseRun(),
  phase: "workspace",
  completed,
  events,
});

describe("objectiveSuggestions", () => {
  it("follows Case 1's objectives in order", () => {
    const main = CASE_ONE.objectives.filter((o) => !o.optional && !o.hidden).map((o) => o.id);
    const steps = main.map((_, i) => objectiveSuggestions(CASE_ONE, at(main.slice(0, i))));
    expect(steps).toEqual([["cat"], ["blocker"], ["acquire"], ["hashsum"], ["lsfs", "pin"]]);
  });

  it("drops a part of the objective that already worked, but not one that failed", () => {
    const main = CASE_ONE.objectives.filter((o) => !o.optional && !o.hidden).map((o) => o.id);
    const beforeNote = main.slice(0, -1);
    expect(objectiveSuggestions(CASE_ONE, at(beforeNote, [ran("lsfs /x", 1)]))).toEqual([
      "lsfs",
      "pin",
    ]);
    expect(objectiveSuggestions(CASE_ONE, at(beforeNote, [ran("lsfs /x")]))).toEqual(["pin"]);
  });

  it("has nothing to suggest once the main objectives are done", () => {
    const main = CASE_ONE.objectives.filter((o) => !o.optional && !o.hidden).map((o) => o.id);
    expect(objectiveSuggestions(CASE_ONE, at(main))).toEqual([]);
  });

  describe.each(builtCases.map((built) => [built.case.id, built] as const))("%s", (_id, built) => {
    const caseDef = toRunnableCase(built);
    const main = caseDef.objectives.filter((o) => !o.optional && !o.hidden);

    it("suggests only real commands, never a hint's whole answer", () => {
      main.forEach((objective, i) => {
        const run = at(main.slice(0, i).map((o) => o.id));
        expect(currentObjective(caseDef, run)?.id).toBe(objective.id);
        for (const suggestion of objectiveSuggestions(caseDef, run)) {
          expect(defaultRegistry.has(suggestion.split(" ")[0] ?? ""), suggestion).toBe(true);
          for (const hint of objective.hints) {
            for (const [, command] of hint.matchAll(/`([^`]+)`/g)) {
              if (command && command.trim().split(/\s+/).length > 2) {
                expect(command, objective.id).not.toBe(suggestion);
              }
            }
          }
        }
      });
    });
  });
});
