import { compareNames } from "../fs/tree";
import type { Tool, ToolRegistry } from "./types";

const TOOL_NAME = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * A lookup table of tools. Commands are only ever looked up here by name; nothing a learner types
 * is evaluated as code. Duplicate or malformed names are programming errors, so they throw.
 */
export function createRegistry(tools: readonly Tool[]): ToolRegistry {
  const byName = new Map<string, Tool>();
  for (const tool of tools) {
    if (!TOOL_NAME.test(tool.name)) throw new Error(`tool name "${tool.name}" must be lowercase`);
    if (byName.has(tool.name)) throw new Error(`tool "${tool.name}" is registered twice`);
    byName.set(tool.name, tool);
  }
  const names = [...byName.keys()].sort(compareNames);
  return {
    get: (name) => byName.get(name),
    has: (name) => byName.has(name),
    names: () => names,
  };
}
