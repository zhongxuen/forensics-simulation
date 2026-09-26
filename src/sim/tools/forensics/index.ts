/**
 * The forensics tools (docs/plan/04-disk-tools.md and file 07 onwards): the disk half of the
 * toolset, plus the write-blocker switch and the case board's pin.
 *
 * Adding one is a file here and one line in this list, the same as any other tool. Names are made
 * up on purpose: the registry test bans real tool names as commands, and the real ones are named
 * in each page's "Real-world equivalent" section instead (docs/plan/99-reference.md §Simulation
 * framing).
 */
import { acquire } from "./acquire";
import { blocker } from "./blocker";
import { carve } from "./carve";
import { hashsum } from "./hashsum";
import { inode } from "./inode";
import { logq } from "./logq";
import { lsfs } from "./lsfs";
import { mem } from "./mem";
import { pin } from "./pin";
import { recover } from "./recover";
import { strings } from "./strings";
import { timeline } from "./timeline";
import type { Tool } from "../types";

export const FORENSICS_TOOLS: readonly Tool[] = [
  acquire,
  blocker,
  carve,
  hashsum,
  inode,
  logq,
  lsfs,
  mem,
  pin,
  recover,
  strings,
  timeline,
];

export {
  acquire,
  blocker,
  carve,
  hashsum,
  inode,
  logq,
  lsfs,
  mem,
  pin,
  recover,
  strings,
  timeline,
};
