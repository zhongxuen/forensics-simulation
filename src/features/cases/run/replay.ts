import type { LogEntry } from "@/lib/case-storage";
import {
  createTerminalSession,
  resetMachine,
  submitLine,
  type TerminalSessionState,
} from "@/features/terminal";
import type { RunnableCase } from "./case-definition";

/**
 * Replays a saved command log from the workstation's starting state: every line through the
 * terminal's own `submitLine` (the parser, then the engine's `step`, on the same in-world clock as
 * the live session), and every Reset machine press through `resetMachine`. The result is the
 * session the player left: the same machine, the same screen, the same events.
 *
 * The engine's own `replay` (src/sim/core/replay.ts) rebuilds the machine from engine commands;
 * this goes one level up, from typed lines, because a save must bring back the screen too.
 * `onStep` sees each session as it's made, for the run reducer to hear the events.
 */
export function replayLog(
  caseDef: Pick<RunnableCase, "scenario" | "seed">,
  log: readonly LogEntry[],
  onStep?: (session: TerminalSessionState, entry: LogEntry) => void,
): TerminalSessionState {
  let session = createTerminalSession({ scenario: caseDef.scenario, seed: caseDef.seed });
  for (const entry of log) {
    session = "reset" in entry ? resetMachine(session) : submitLine(session, entry.line);
    onStep?.(session, entry);
  }
  return session;
}
