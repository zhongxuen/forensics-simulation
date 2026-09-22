/**
 * The cheat sheet's content: every command, grouped by what a beginner wants to do ("Look
 * around", "Read files", "Find things"...), each with its one-line summary and a first example.
 * The same groups as the bare `help` command, from the same registry.
 */
import { commandGroups, defaultRegistry } from "@/sim";
import type { ToolRegistry } from "@/sim/types";

export interface CheatSheetEntry {
  readonly name: string;
  readonly summary: string;
  readonly example?: { readonly command: string; readonly text: string };
}

export interface CheatSheetGroup {
  readonly label: string;
  readonly entries: readonly CheatSheetEntry[];
}

export function cheatSheetGroups(registry: ToolRegistry = defaultRegistry): CheatSheetGroup[] {
  return commandGroups(registry).map((group) => ({
    label: group.label,
    entries: group.commands.flatMap((name) => {
      const tool = registry.get(name);
      if (!tool) return [];
      const example = tool.help.examples?.[0];
      return [{ name, summary: tool.help.oneLiner, ...(example && { example }) }];
    }),
  }));
}
