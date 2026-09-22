/**
 * A run is everything needed to reproduce a session: `{ seed, scenarioId, commands }`. Replaying
 * it rebuilds the exact final state and output. That gives free regression tests, bug reports
 * that are one JSON blob, and the transcript the AI Mentor reads in phase 10.
 */
import { checkShellCommand } from "../shell/validate";
import { steppingClock } from "./clock";
import { err, ok, type Result } from "./result";
import { createInitialState, scenarioStartMs } from "./scenario";
import { parseEnvelope, type SnapshotError } from "./serialize";
import { stableStringify } from "./stable-json";
import { step } from "./step";
import type {
  OutputLine,
  ScenarioSpec,
  SimCommand,
  SimContext,
  SimEvent,
  SimResult,
} from "./types";

export const RUN_FORMAT = "hacker-sim/run";
export const RUN_VERSION = 1;
/** Replays longer than this are refused when deserializing. */
export const MAX_RUN_COMMANDS = 10_000;
const MAX_ARG_LENGTH = 4096;
const MAX_ARGS = 256;

export interface Run {
  readonly seed: number;
  readonly scenarioId: string;
  readonly commands: readonly SimCommand[];
}

export interface ReplayStep {
  readonly command: SimCommand;
  readonly output: readonly OutputLine[];
  readonly events: readonly SimEvent[];
  readonly exitCode: number;
}

/** The final result (state, all output, all events, last exit code), plus each step on its own. */
export interface ReplayResult extends SimResult {
  readonly steps: readonly ReplayStep[];
}

export type ScenarioLookup =
  Readonly<Record<string, ScenarioSpec>> | ((scenarioId: string) => ScenarioSpec | undefined);

export interface ReplayOptions {
  /**
   * The clock. Defaults to the scenario's in-world clock: its start time, plus one second per
   * command. Pass the same clock the live session used to reproduce its timestamps exactly.
   */
  readonly now?: () => number;
  readonly registry?: SimContext["registry"];
}

export const createRun = (
  scenarioId: string,
  seed: number,
  commands: readonly SimCommand[] = [],
): Run => ({
  seed,
  scenarioId,
  commands,
});

export const appendCommand = (run: Run, command: SimCommand): Run => ({
  ...run,
  commands: [...run.commands, command],
});

/** The default replay clock for a scenario: in-world start time, one second per command. */
export const scenarioClock = (spec: ScenarioSpec) => steppingClock(scenarioStartMs(spec), 1000);

/**
 * Replays a run from the scenario's initial state. Throws if the scenario isn't in `scenarios`:
 * that's a caller mistake, not something a run can cause.
 */
export function replay(
  run: Run,
  scenarios: ScenarioLookup,
  options: ReplayOptions = {},
): ReplayResult {
  const spec =
    typeof scenarios === "function" ? scenarios(run.scenarioId) : lookup(scenarios, run.scenarioId);
  if (!spec) throw new Error(`replay: no scenario "${run.scenarioId}" was provided`);

  const ctx: SimContext = {
    now: options.now ?? scenarioClock(spec).now,
    ...(options.registry && { registry: options.registry }),
  };
  let state = createInitialState(spec, run.seed);
  const steps: ReplayStep[] = [];
  let exitCode = 0;
  for (const command of run.commands) {
    const result = step(state, command, ctx);
    state = result.state;
    exitCode = result.exitCode;
    steps.push({ command, output: result.output, events: result.events, exitCode });
  }
  return {
    state,
    output: steps.flatMap((s) => s.output),
    events: steps.flatMap((s) => s.events),
    exitCode,
    steps,
  };
}

const lookup = (scenarios: Readonly<Record<string, ScenarioSpec>>, id: string) =>
  Object.hasOwn(scenarios, id) ? scenarios[id] : undefined;

export function serializeRun(run: Run): string {
  return stableStringify({ format: RUN_FORMAT, version: RUN_VERSION, ...run });
}

/** Reads a run back, checking every field. Runs are untrusted input (they arrive as bug reports). */
export function deserializeRun(text: string): Result<Run, SnapshotError> {
  const envelope = parseEnvelope(text, RUN_FORMAT, RUN_VERSION);
  if (!envelope.ok) return envelope;
  const { seed, scenarioId, commands } = envelope.value;
  const bad = (reason: string) => err<SnapshotError>({ code: "BAD_SNAPSHOT", reason });
  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    return bad("seed: expected a whole number from 0 to 4294967295");
  }
  if (typeof scenarioId !== "string" || scenarioId.length === 0)
    return bad("scenarioId: expected a string");
  if (!Array.isArray(commands) || commands.length > MAX_RUN_COMMANDS) {
    return bad(`commands: expected a list of at most ${MAX_RUN_COMMANDS}`);
  }
  const checked: SimCommand[] = [];
  for (const [i, command] of commands.entries()) {
    const c = command as Record<string, unknown> | null;
    if (c?.type === "shell") {
      const shell = checkShellCommand(c, `commands[${i}]`);
      if (!shell.ok) return bad(shell.reason);
      checked.push(shell.command);
      continue;
    }
    const argvOk =
      Array.isArray(c?.argv) &&
      c.argv.length <= MAX_ARGS &&
      c.argv.every((arg: unknown) => typeof arg === "string" && arg.length <= MAX_ARG_LENGTH);
    if (
      !c ||
      c.type !== "exec" ||
      !argvOk ||
      (c.stdin !== undefined && typeof c.stdin !== "string")
    ) {
      return bad(
        `commands[${i}]: expected { type: "exec", argv: string[], stdin?: string } or a shell command`,
      );
    }
    checked.push({
      type: "exec",
      argv: c.argv as string[],
      ...(typeof c.stdin === "string" && { stdin: c.stdin }),
    });
  }
  return ok({ seed, scenarioId, commands: checked });
}
