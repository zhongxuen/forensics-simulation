/**
 * The terminal session, as pure data: the engine state, the run (every command sent to the
 * engine, for replay and later the mentor), and the screen buffer. The React hook
 * (hooks/use-terminal-session.ts) holds one of these; everything that changes it is a function
 * here, so it's testable in plain Node.
 *
 * The flow for one line: parse it (parser/), turn it into the engine's ShellCommand, `step` it,
 * then turn the output into screen lines (colour codes parsed once, here) with beginner
 * explanations attached. No command is implemented here: those all live in the engine.
 */
import {
  appendCommand,
  createInitialState,
  createRun,
  defaultRegistry,
  scenarioStartMs,
  serializeRun,
  step,
} from "@/sim";
import type { Run, ScenarioSpec, SimError, SimEvent, SimState, ToolRegistry } from "@/sim/types";
import { explainError, explainParseError } from "../beginner/explain-error";
import { suggestFix } from "../beginner/suggest";
import { parseCommandLine, toShellCommand, type CommandLineNode, type ParseError } from "../parser";
import { parseAnsi, type AnsiSpan } from "./ansi";

/** How many screen lines to keep before the oldest are dropped. */
export const DEFAULT_SCROLLBACK = 5000;

export type TerminalLineKind = "output" | "explain" | "note";

export interface TerminalLine {
  readonly id: number;
  readonly kind: TerminalLineKind;
  /** stdout or stderr, for output lines. */
  readonly stream?: "stdout" | "stderr";
  readonly spans: readonly AnsiSpan[];
  /** The text without colour codes: for copying, and for screen readers. */
  readonly text: string;
  /** The typed error, on lines that report one. */
  readonly error?: SimError;
  /** An explain line that repeats the command or points at a column in it: no arrow in front. */
  readonly pointer?: boolean;
}

export interface PromptInfo {
  readonly user: string;
  readonly host: string;
  /** The folder, with the home folder shown as ~. */
  readonly cwd: string;
  /** `#` for root, `$` for everyone else. */
  readonly symbol: "$" | "#";
}

export interface TerminalBlock {
  readonly id: number;
  /** `command`: something the learner typed. `note`: a message from the terminal itself. */
  readonly kind: "command" | "note";
  readonly prompt: PromptInfo;
  readonly input: string;
  readonly lines: readonly TerminalLine[];
  readonly exitCode: number;
  readonly events: readonly SimEvent[];
  readonly ast?: CommandLineNode;
  readonly parseError?: ParseError;
  /** The whole line with a "did you mean" fix applied: Tab puts it at the prompt. */
  readonly fixedLine?: string;
  /** Ctrl+C: the line was abandoned, not run. */
  readonly interrupted?: boolean;
}

export interface TerminalSessionState {
  readonly scenario: ScenarioSpec;
  readonly seed: number;
  readonly sim: SimState;
  /** Every command sent to the engine since the last reset: replaying it rebuilds `sim`. */
  readonly run: Run;
  readonly blocks: readonly TerminalBlock[];
  /** Every line submitted, oldest first, for the up arrow and Ctrl+R. */
  readonly inputHistory: readonly string[];
  readonly nextId: number;
  readonly scrollback: number;
  /** Events from the most recent command, for missions and the network map. */
  readonly lastEvents: readonly SimEvent[];
  /** Commands whose silent success has been explained once already. */
  readonly explainedQuiet: readonly string[];
}

export interface SessionOptions {
  readonly scenario: ScenarioSpec;
  readonly seed: number;
  readonly scrollback?: number;
}

export function createTerminalSession({
  scenario,
  seed,
  scrollback,
}: SessionOptions): TerminalSessionState {
  return {
    scenario,
    seed,
    sim: createInitialState(scenario, seed),
    run: createRun(scenario.id, seed),
    blocks: [],
    inputHistory: [],
    nextId: 1,
    scrollback: Math.max(100, scrollback ?? DEFAULT_SCROLLBACK),
    lastEvents: [],
    explainedQuiet: [],
  };
}

/** The prompt for a state: who, where, and which machine. */
export function promptFor(sim: SimState): PromptInfo {
  const { user, cwd, env } = sim.session;
  const home = Object.hasOwn(env, "HOME") ? (env.HOME as string) : "";
  const host =
    (sim.network.hosts[sim.session.hostId]?.hostname ?? sim.session.hostId).split(".")[0] ?? "";
  const shown =
    home && (cwd === home || cwd.startsWith(`${home}/`)) ? `~${cwd.slice(home.length)}` : cwd;
  return { user, host, cwd: shown, symbol: user === "root" ? "#" : "$" };
}

export const formatPrompt = (prompt: PromptInfo): string =>
  `${prompt.user}@${prompt.host}:${prompt.cwd}${prompt.symbol}`;

/**
 * In-world time for the next command: the scenario's start, plus one second for every command
 * sent to the engine so far. It's exactly the clock `replay` uses by default, so a run replays to
 * the same timestamps.
 */
export const nextCommandTime = (session: TerminalSessionState): number =>
  scenarioStartMs(session.scenario) + session.run.commands.length * 1000;

/** Commands that print nothing when they work: the first time, say that silence means success. */
const QUIET_SUCCESS: Readonly<Record<string, string>> = {
  cd: "You moved. `cd` prints nothing when it works: the prompt now shows where you are.",
  touch: "Done. `touch` prints nothing when it works: type `ls` to see the new file.",
  mkdir: "Done. `mkdir` prints nothing when it works: type `ls` to see the new folder.",
  cp: "Copied. `cp` prints nothing when it works: type `ls` to check.",
  mv: "Moved. `mv` prints nothing when it works: type `ls` to check.",
  chmod: "Changed. `chmod` prints nothing when it works: `ls -l` shows the new permissions.",
  chown: "Changed. `chown` prints nothing when it works: `ls -l` shows the new owner.",
};

interface Draft {
  lines: TerminalLine[];
  nextId: number;
}

function addLine(draft: Draft, line: Omit<TerminalLine, "id">): void {
  draft.lines.push({ ...line, id: draft.nextId++ });
}

function explainLine(draft: Draft, text: string, pointer = false): void {
  addLine(draft, {
    kind: "explain",
    spans: [{ text, style: {} }],
    text,
    ...(pointer && { pointer }),
  });
}

/** Submits one line: parses it, runs it through the engine, and adds it to the screen. */
export function submitLine(
  session: TerminalSessionState,
  input: string,
  registry: ToolRegistry = defaultRegistry,
): TerminalSessionState {
  const line = input.replace(/\r?\n/g, " ");
  const prompt = promptFor(session.sim);
  const inputHistory =
    line.trim() === "" || session.inputHistory.at(-1) === line
      ? session.inputHistory
      : [...session.inputHistory, line].slice(-1000);
  const draft: Draft = { lines: [], nextId: session.nextId + 1 };
  const blockId = session.nextId;

  const parsed = parseCommandLine(line);
  if (!parsed.ok) {
    const { error } = parsed;
    addLine(draft, {
      kind: "output",
      stream: "stderr",
      spans: [{ text: error.message, style: {} }],
      text: error.message,
    });
    // Point at the problem: the line again, then a caret under the column.
    explainLine(draft, line, true);
    explainLine(draft, `${" ".repeat(Math.max(0, error.column - 1))}^`, true);
    explainLine(draft, explainParseError(error));
    const block: TerminalBlock = {
      id: blockId,
      kind: "command",
      prompt,
      input: line,
      lines: draft.lines,
      exitCode: 2,
      events: [],
      parseError: error,
    };
    return trim({
      ...session,
      inputHistory,
      nextId: draft.nextId,
      blocks: [...session.blocks, block],
      lastEvents: [],
    });
  }

  const ast = parsed.ast;
  if (ast.items.length === 0) {
    // An empty line (or only a comment) shows a fresh prompt, like a real terminal.
    const block: TerminalBlock = {
      id: blockId,
      kind: "command",
      prompt,
      input: line,
      lines: [],
      exitCode: 0,
      events: [],
      ast,
    };
    return trim({
      ...session,
      inputHistory,
      nextId: draft.nextId,
      blocks: [...session.blocks, block],
      lastEvents: [],
    });
  }

  const command = toShellCommand(line, ast);
  const now = nextCommandTime(session);
  const result = step(session.sim, command, { now: () => now, registry });
  const run = appendCommand(session.run, command);

  let cleared = false;
  let fixedLine: string | undefined;
  for (const output of result.output) {
    const parsedLine = parseAnsi(output.text);
    if (parsedLine.clearsScreen) {
      cleared = true;
      draft.lines = [];
    }
    if (parsedLine.clearsScreen && parsedLine.plain === "") continue;
    addLine(draft, {
      kind: "output",
      stream: output.stream,
      spans: parsedLine.spans,
      text: parsedLine.plain,
      ...(output.error && { error: output.error }),
    });
    if (output.error) {
      const failing = [...result.events]
        .reverse()
        .find((event) => event.type === "command.error" && event.code === output.error?.code);
      const commandName =
        failing && "command" in failing ? failing.command : (output.text.split(":")[0] ?? "");
      const fix = suggestFix(output.error, line, ast, result.state);
      fixedLine ??= fix.fixedLine;
      const explanation = fix.note
        ? fix.note
        : explainError(output.error, {
            command: commandName === "bash" ? "bash" : commandName,
            user: result.state.session.user,
            cwd: result.state.session.cwd,
            ...(fix.suggestion !== undefined && { suggestion: fix.suggestion }),
            ...(fix.suggestionSummary !== undefined && {
              suggestionSummary: fix.suggestionSummary,
            }),
          });
      explainLine(
        draft,
        fixedLine && fix.fixedLine ? `${explanation} Press Tab to use it.` : explanation,
      );
    }
  }

  // Notes for the beginner layer: silence means success, and deleting is reversible here.
  let explainedQuiet = session.explainedQuiet;
  const runs = result.events.filter((event) => event.type === "command.run");
  const deleted = result.events.some(
    (event) => event.type === "file.changed" && event.change === "deleted",
  );
  if (deleted && result.exitCode === 0) {
    explainLine(
      draft,
      "In real life, deleted files are gone for good: there's no recycle bin. Here, the Reset machine button brings everything back.",
    );
  }
  const onlyRun = runs.length === 1 ? runs[0] : undefined;
  if (
    onlyRun &&
    onlyRun.type === "command.run" &&
    result.output.length === 0 &&
    result.exitCode === 0
  ) {
    const note = QUIET_SUCCESS[onlyRun.command];
    if (note && !explainedQuiet.includes(onlyRun.command)) {
      explainLine(draft, note);
      explainedQuiet = [...explainedQuiet, onlyRun.command];
    }
  }
  if (onlyRun && onlyRun.type === "command.run" && onlyRun.command === "exit") {
    explainLine(draft, "This practice terminal stays open after exit, so you can keep going.");
  }

  const block: TerminalBlock = {
    id: blockId,
    kind: "command",
    prompt,
    input: line,
    lines: draft.lines,
    exitCode: result.exitCode,
    events: result.events,
    ast,
    ...(fixedLine !== undefined && { fixedLine }),
  };
  return trim({
    ...session,
    sim: result.state,
    run,
    inputHistory,
    nextId: draft.nextId,
    // `clear` wipes the screen, its own line included, like the real thing.
    blocks: cleared ? [] : [...session.blocks, block],
    lastEvents: result.events,
    explainedQuiet,
  });
}

/** Ctrl+C: the line is abandoned. It shows with ^C and doesn't run. */
export function interruptLine(session: TerminalSessionState, input: string): TerminalSessionState {
  const block: TerminalBlock = {
    id: session.nextId,
    kind: "command",
    prompt: promptFor(session.sim),
    input: `${input}^C`,
    lines: [],
    exitCode: 130,
    events: [],
    interrupted: true,
  };
  return trim({
    ...session,
    nextId: session.nextId + 1,
    blocks: [...session.blocks, block],
    lastEvents: [],
  });
}

/** Ctrl+L: clears the screen. Nothing on the machine changes. */
export const clearScreen = (session: TerminalSessionState): TerminalSessionState => ({
  ...session,
  blocks: [],
});

/**
 * Reset machine: back to the scenario's starting state, with a fresh run. The screen keeps what
 * was there, with a note, so the learner can still see what they did.
 */
export function resetMachine(session: TerminalSessionState): TerminalSessionState {
  const sim = createInitialState(session.scenario, session.seed);
  const text =
    "The practice machine is back to how it started. Everything you changed has been undone.";
  const block: TerminalBlock = {
    id: session.nextId,
    kind: "note",
    prompt: promptFor(sim),
    input: "",
    lines: [{ id: session.nextId + 1, kind: "note", spans: [{ text, style: {} }], text }],
    exitCode: 0,
    events: [],
  };
  return trim({
    ...session,
    sim,
    run: createRun(session.scenario.id, session.seed),
    nextId: session.nextId + 2,
    blocks: [...session.blocks, block],
    lastEvents: [],
    explainedQuiet: [],
  });
}

/** Keeps the screen within the scrollback limit, dropping the oldest lines first. */
function trim(session: TerminalSessionState): TerminalSessionState {
  const rows = (block: TerminalBlock) => block.lines.length + 1;
  let total = session.blocks.reduce((sum, block) => sum + rows(block), 0);
  if (total <= session.scrollback) return session;
  const blocks = [...session.blocks];
  while (blocks.length > 1 && total > session.scrollback)
    total -= rows(blocks.shift() as TerminalBlock);
  const only = blocks[0];
  if (blocks.length === 1 && only && total > session.scrollback) {
    blocks[0] = { ...only, lines: only.lines.slice(-(session.scrollback - 1)) };
  }
  return { ...session, blocks };
}

/** Lines on screen, counting each block's prompt line. */
export const screenLineCount = (session: TerminalSessionState): number =>
  session.blocks.reduce((sum, block) => sum + block.lines.length + 1, 0);

/**
 * The screen as plain text, without colour codes or beginner explanations: what a real terminal
 * would let you copy.
 */
export function plainTranscript(blocks: readonly TerminalBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    if (block.kind === "command")
      lines.push(`${formatPrompt(block.prompt)} ${block.input}`.trimEnd());
    for (const line of block.lines) if (line.kind !== "explain") lines.push(line.text);
  }
  return lines.join("\n");
}

/** What a session holds, for replay and bug reports: the state, the run, and the transcript. */
export function sessionSnapshot(session: TerminalSessionState) {
  return {
    state: session.sim,
    run: session.run,
    serializedRun: serializeRun(session.run),
    transcript: plainTranscript(session.blocks),
  };
}
