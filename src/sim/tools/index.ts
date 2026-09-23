/**
 * The built-in tool list: the simulated security tools, then the Linux command set. Adding a tool
 * takes two files: the tool itself, and one line here (or, for a Linux command, one line in
 * commands/index.ts).
 */
import { LINUX_COMMANDS } from "./commands";
import { FORENSICS_TOOLS } from "./forensics";
import { logview } from "./logview";
import { createRegistry } from "./registry";
import type { Tool } from "./types";

export const SECURITY_TOOLS: readonly Tool[] = [logview, ...FORENSICS_TOOLS];

export const BUILTIN_TOOLS: readonly Tool[] = [...SECURITY_TOOLS, ...LINUX_COMMANDS];

export const defaultRegistry = createRegistry(BUILTIN_TOOLS);
