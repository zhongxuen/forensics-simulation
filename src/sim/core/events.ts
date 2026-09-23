import type { SimEventType } from "./types";

/**
 * Every event type the engine emits. Mission schemas (phase 06) validate `event` checks against
 * this list, so a typo in content fails a test instead of silently never matching.
 */
export const SIM_EVENT_TYPES = [
  "command.run",
  "command.error",
  "help.viewed",
  "host.discovered",
  "service.discovered",
  "service.fingerprinted",
  "scan.completed",
  "web.probed",
  "file.read",
  "file.changed",
  "log.queried",
  "hash.identified",
  "flag.found",
  // Forensics (docs/plan/04-disk-tools.md §Events).
  "evidence.acquired",
  "evidence.hashed",
  "evidence.readOriginal",
  "evidence.recovered",
  "board.pinned",
] as const satisfies readonly SimEventType[];

// Compile-time check that the list above is complete.
type Missing = Exclude<SimEventType, (typeof SIM_EVENT_TYPES)[number]>;
const complete: Missing extends never ? true : Missing = true;
void complete;
