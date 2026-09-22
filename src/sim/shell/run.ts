/**
 * Runs a parsed command line (a ShellCommand): pipelines, redirections, `;`, `&&`, `||`, variable
 * assignments and word expansion. It's the shell half of a terminal, with the parsing done
 * elsewhere (the terminal feature turns text into a ShellCommand). Every command still goes
 * through the tool registry: nothing is evaluated as code.
 *
 * Like bash:
 * - each command in a pipeline gets the previous command's output as its input, and error lines
 *   go to the screen, not down the pipe (unless `2>&1`)
 * - `> file` empties the file before the command runs, even if the command then fails
 * - a failed redirection stops that command from running
 * - the parts of a multi-command pipeline run on their own, so `cd /tmp | ls` doesn't move you
 * - `$?` is the exit status of the previous pipeline on the same line (0 at the start of a line)
 */
import { errorLineText, stderr } from "../core/output";
import { revealFlags, runTool } from "../core/run-tool";
import { fileChanged, sessionFs, withSession, withSessionFs } from "../core/session";
import { fsMessage, type FsError, type SimError } from "../core/errors";
import type { OutputLine, SimEvent, SimResult, SimState } from "../core/types";
import { readFile, realpath, stat, writeFile } from "../fs/ops";
import type { ToolRegistry } from "../tools/types";
import { expandToString, expandWord, type ExpandContext } from "./expand";
import type { ShellCommand, ShellPipeline, ShellSimpleCommand } from "./types";

export interface ShellRunOptions {
  readonly registry: ToolRegistry;
  readonly now: number;
}

/** Lines kept in `history`, oldest dropped first. */
export const MAX_HISTORY = 1000;
/** More output than this from one line is cut short, so a runaway command can't freeze the page. */
export const MAX_OUTPUT_LINES = 5000;

const NULL_DEVICE = "/dev/null";

/** Where a stream goes. */
type Destination =
  | { readonly kind: "screen" }
  | { readonly kind: "pipe" }
  | { readonly kind: "null" }
  | { readonly kind: "file"; readonly path: string };

export function runShell(
  initial: SimState,
  cmd: ShellCommand,
  options: ShellRunOptions,
): SimResult {
  let state = initial;
  if (cmd.line.trim() !== "") {
    const history = [...state.session.history, cmd.line].slice(-MAX_HISTORY);
    state = withSession(state, { history });
  }

  const output: OutputLine[] = [];
  const events: SimEvent[] = [];
  let lastExit = 0;
  for (const item of cmd.list) {
    if (item.when === "success" && lastExit !== 0) continue;
    if (item.when === "failure" && lastExit === 0) continue;
    const result = runPipeline(state, item.pipeline, { ...options, lastExit });
    state = result.state;
    output.push(...result.output);
    events.push(...result.events);
    lastExit = result.exitCode;
  }

  const shown = capOutput(output);
  const flags = revealFlags(state, shown);
  return {
    state: flags.state,
    output: shown,
    events: [...events, ...flags.events],
    exitCode: lastExit,
  };
}

interface PipelineResult {
  readonly state: SimState;
  readonly output: readonly OutputLine[];
  readonly events: readonly SimEvent[];
  readonly exitCode: number;
}

function runPipeline(
  initial: SimState,
  pipeline: ShellPipeline,
  options: ShellRunOptions & { readonly lastExit: number },
): PipelineResult {
  let state = initial;
  const output: OutputLine[] = [];
  const events: SimEvent[] = [];
  let stdin: string | undefined;
  let exitCode = 0;
  pipeline.commands.forEach((command, index) => {
    const result = runSimple(state, command, {
      ...options,
      stdin,
      last: index === pipeline.commands.length - 1,
    });
    state = result.state;
    output.push(...result.shown);
    events.push(...result.events);
    stdin = result.piped;
    exitCode = result.exitCode;
  });

  // Each part of a multi-command pipeline runs on its own: `cd` or a variable set inside one
  // doesn't stick. Files it wrote, and what it discovered, do.
  if (pipeline.commands.length > 1) {
    const { cwd, env, user } = initial.session;
    state = withSession(state, { cwd, env, user });
  }
  return { state, output, events, exitCode };
}

interface SimpleResult {
  readonly state: SimState;
  /** Lines for the screen. */
  readonly shown: readonly OutputLine[];
  /** Text for the next command in the pipeline. */
  readonly piped: string;
  readonly events: readonly SimEvent[];
  readonly exitCode: number;
}

function runSimple(
  initial: SimState,
  command: ShellSimpleCommand,
  options: ShellRunOptions & {
    readonly lastExit: number;
    readonly stdin: string | undefined;
    readonly last: boolean;
  },
): SimpleResult {
  let state = initial;
  const events: SimEvent[] = [];
  const expandCtx: ExpandContext = { state, lastExit: options.lastExit, now: options.now };
  const argv = command.words.flatMap((word) => expandWord(word, expandCtx));
  const assigned: Record<string, string> = {};
  for (const { name, value } of command.assignments)
    assigned[name] = expandToString(value, expandCtx);
  const name = argv[0] ?? "bash";

  const stop = (error: SimError, text: string): SimpleResult => ({
    state,
    shown: [errorLineText(text, error)],
    piped: "",
    events: [...events, { type: "command.error", command: name, ...error }],
    exitCode: 1,
  });

  // Redirections are set up, left to right, before the command runs.
  let stdin = options.stdin;
  let out: Destination = options.last ? { kind: "screen" } : { kind: "pipe" };
  let err: Destination = { kind: "screen" };
  for (const redirect of command.redirects) {
    if (!redirect.target) {
      err = out; // 2>&1: errors go wherever output goes right now
      continue;
    }
    const targets = expandWord(redirect.target, expandCtx);
    const raw = targets.join(" ");
    if (targets.length !== 1 || raw === "") {
      return stop(
        { code: "BAD_ARGUMENT", argument: "redirect", value: raw, reason: "bad-format" },
        `bash: ${raw}: ambiguous redirect`,
      );
    }
    const path = targets[0] as string;
    if (redirect.fd === 0) {
      if (path === NULL_DEVICE) {
        stdin = "";
        continue;
      }
      const { vfs, ctx } = sessionFs(state, options.now);
      const read = readFile(vfs, ctx, path);
      if (!read.ok) return stop(read.error, shellFsError(read.error));
      stdin = read.value;
      continue;
    }
    let destination: Destination = { kind: "null" };
    if (path !== NULL_DEVICE) {
      const prepared = prepareFile(state, path, redirect.mode === "append", options.now);
      if (!prepared.ok) return stop(prepared.error, shellFsError(prepared.error));
      state = prepared.state;
      events.push(...prepared.events);
      destination = { kind: "file", path };
    }
    if (redirect.fd === 1) out = destination;
    else err = destination;
  }

  // A line of only assignments sets the variables for the rest of the session.
  if (argv.length === 0) {
    if (command.assignments.length > 0) {
      state = withSession(state, { env: { ...state.session.env, ...assigned } });
    }
    return { state, shown: [], piped: "", events, exitCode: 0 };
  }

  // `NAME=value command` sets the variable for that one command only.
  const env = state.session.env;
  const runState =
    command.assignments.length > 0 ? withSession(state, { env: { ...env, ...assigned } }) : state;
  const result = runTool(runState, argv, {
    registry: options.registry,
    now: options.now,
    tty: out.kind === "screen",
    ...(stdin !== undefined && { stdin }),
  });
  state = command.assignments.length > 0 ? withSession(result.state, { env }) : result.state;
  events.push(...result.events);

  const shown: OutputLine[] = [];
  const piped: string[] = [];
  const files = new Map<string, string[]>();
  for (const line of result.output) {
    const destination = line.stream === "stdout" ? out : err;
    switch (destination.kind) {
      case "screen":
        shown.push(line);
        break;
      case "pipe":
        piped.push(line.text);
        break;
      case "file":
        files.set(destination.path, [...(files.get(destination.path) ?? []), line.text]);
        break;
      case "null":
        break;
    }
  }

  let exitCode = result.exitCode;
  for (const [path, lines] of files) {
    const { vfs, ctx } = sessionFs(state, options.now);
    const written = writeFile(vfs, ctx, path, `${lines.join("\n")}\n`, { append: true });
    if (!written.ok) {
      shown.push(errorLineText(shellFsError(written.error), written.error));
      events.push({ type: "command.error", command: name, ...written.error });
      exitCode = 1;
      continue;
    }
    state = withSessionFs(state, written.value);
    const canonical = realpath(written.value, ctx, path);
    const reported = events.some(
      (event) => event.type === "file.changed" && canonical.ok && event.path === canonical.value,
    );
    if (canonical.ok && !reported) events.push(fileChanged(state, canonical.value, "modified"));
  }

  return { state, shown, piped: piped.length > 0 ? `${piped.join("\n")}\n` : "", events, exitCode };
}

/**
 * Opens a file for a redirection: `>` empties it (creating it if needed), `>>` only creates it.
 * Either way this happens before the command runs, like a real shell.
 */
function prepareFile(
  state: SimState,
  path: string,
  append: boolean,
  now: number,
): { ok: true; state: SimState; events: SimEvent[] } | { ok: false; error: FsError } {
  const { vfs, ctx } = sessionFs(state, now);
  const existed = stat(vfs, ctx, path);
  if (existed.ok && existed.value.kind === "dir") {
    return { ok: false, error: { code: "EISDIR", path } };
  }
  const written = writeFile(vfs, ctx, path, "", { append });
  if (!written.ok) return written;
  const next = withSessionFs(state, written.value);
  const canonical = realpath(written.value, ctx, path);
  const change = existed.ok ? (append ? undefined : "modified") : "created";
  return {
    ok: true,
    state: next,
    events: canonical.ok && change ? [fileChanged(next, canonical.value, change)] : [],
  };
}

/** How bash words a failed redirection: "bash: notes.txt: Permission denied". */
function shellFsError(error: FsError): string {
  return `bash: ${error.path}: ${fsMessage(error.code)}`;
}

function capOutput(output: readonly OutputLine[]): readonly OutputLine[] {
  if (output.length <= MAX_OUTPUT_LINES) return output;
  return [
    ...output.slice(0, MAX_OUTPUT_LINES),
    stderr(
      `(output cut short: only the first ${MAX_OUTPUT_LINES} lines are shown. Try adding | head or | grep to narrow it down.)`,
    ),
  ];
}
