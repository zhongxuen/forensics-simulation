import type { ObjectiveCheck, RunnableCase } from "./case-definition";
import { currentObjective, type CaseRunState } from "./case-run";
import { evaluateObjectives } from "./evaluate";

/**
 * The terminal's suggestion chips for a case (UIUX.md §2.6): the tools the current objective asks
 * for, read off its check, so they follow the case. Only the tool's name (and a `mem` subcommand)
 * is suggested, never a hint's whole command, and a part of the check that already holds drops out:
 * once `lsfs` has run, only `pin` is left. A pin of a log record suggests `logq` too, the tool that
 * finds it. With no objective left, there are none.
 */
export function objectiveSuggestions(caseDef: RunnableCase, run: CaseRunState): string[] {
  const objective = currentObjective(caseDef, run);
  if (!objective) return [];
  const board = { pins: run.pins, reportDraft: run.reportDraft, citations: run.citations };
  const holds = (check: ObjectiveCheck) =>
    evaluateObjectives({ objectives: [{ ...objective, check }] }, run.events, board).length > 0;

  const tools: string[] = [];
  const visit = (check: ObjectiveCheck) => {
    if (check.kind === "all" || check.kind === "any") {
      if (!holds(check)) check.of.forEach(visit);
    } else if (check.kind === "commandRun") {
      const tool = toolOf(check.pattern);
      if (tool && !holds(check)) tools.push(tool);
    } else if (check.kind === "pinned") {
      if (holds(check)) return;
      // A record from the logs is found with logq before it can be pinned.
      if (check.refs.some((ref) => ref.startsWith("log:"))) tools.push("logq");
      tools.push("pin");
    }
  };
  visit(objective.check);
  return [...new Set(tools)];
}

/**
 * The command a `commandRun` pattern starts with: `^\s*mem\s+(ps|pstree)\b` is `mem ps`,
 * `^\s*hashsum\b(?=.*--verify)` is `hashsum`. The first of a group of choices is taken.
 */
function toolOf(pattern: string): string | undefined {
  const match = /^\^\\s\*([a-z][\w-]*)(?:\\s\+\(?([a-z][\w-]*))?/.exec(pattern);
  if (!match?.[1]) return undefined;
  return match[2] ? `${match[1]} ${match[2]}` : match[1];
}
