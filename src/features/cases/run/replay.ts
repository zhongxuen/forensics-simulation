import type { LogEntry } from "@/lib/case-storage";
import {
  applyChange,
  createTerminalSession,
  resetMachine,
  submitLine,
  type TerminalSessionState,
} from "@/features/terminal";
import type { EvidenceSet } from "@/sim/types";
import type { RunnableCase } from "./case-definition";
import { browseChange, evidenceSetup } from "./workstation";

/**
 * Replays a saved log from the workstation's starting state (with the case's evidence attached,
 * when it has any): every line through the terminal's own `submitLine` (the parser, then the
 * engine's `step`, on the same in-world clock as the live session), every Reset machine press
 * through `resetMachine`, and every image opened in the Evidence Browser through the same engine
 * call the browser makes. The result is the session the player left: the same machine, the same
 * screen, the same events.
 *
 * The engine's own `replay` (src/sim/core/replay.ts) rebuilds the machine from engine commands;
 * this goes one level up, from typed lines, because a save must bring back the screen too.
 * `onStep` sees each session as it's made, for the run reducer to hear the events.
 */
export function replayLog(
  caseDef: Pick<RunnableCase, "scenario" | "seed">,
  log: readonly LogEntry[],
  onStep?: (session: TerminalSessionState, entry: LogEntry) => void,
  evidence?: EvidenceSet | null,
): TerminalSessionState {
  let session = createTerminalSession({
    scenario: caseDef.scenario,
    seed: caseDef.seed,
    ...(evidence && { setup: evidenceSetup(caseDef.scenario, evidence) }),
  });
  for (const entry of log) {
    if ("reset" in entry) session = resetMachine(session);
    else if ("browse" in entry) session = applyChange(session, browseChange(entry.browse)).session;
    else session = submitLine(session, entry.line);
    onStep?.(session, entry);
  }
  return session;
}
