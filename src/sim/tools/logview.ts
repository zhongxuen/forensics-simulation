/**
 * logview: reads simulated log files from the virtual filesystem and filters them. Permission
 * checks apply: a log only root may read stays unreadable, and the error says so.
 */
import { columns, failure, plural, splitLines, stdout, success } from "../core/output";
import { sessionFs, sessionHost } from "../core/session";
import type { OutputLine, SimEvent, SimResult, SimState } from "../core/types";
import { listDir, readFile, stat } from "../fs/ops";
import { canAccess } from "../fs/perms";
import { resolvePath } from "../fs/resolve";
import { hasSwitch, optionValue, parseArgs } from "./args";
import type { Tool } from "./types";

const NAME = "logview";
const LOG_DIR = "/var/log";
const MAX_FILTER_LENGTH = 200;

/** Level words a log line may carry, and what each one normalizes to. */
const LEVELS: Readonly<Record<string, string>> = {
  debug: "debug",
  info: "info",
  notice: "notice",
  warn: "warn",
  warning: "warn",
  err: "error",
  error: "error",
  crit: "crit",
  critical: "crit",
  fatal: "crit",
};

const levelOf = (word: string): string | undefined =>
  Object.hasOwn(LEVELS, word) ? LEVELS[word] : undefined;

/** A line's level: the first of its first four words that is a level name, like "WARN" or "[error]". */
export function lineLevel(line: string): string | undefined {
  for (const word of line.split(/\s+/).slice(0, 4)) {
    const level = levelOf(word.replace(/^[[(<]+|[\])>:]+$/g, "").toLowerCase());
    if (level) return level;
  }
  return undefined;
}

export const logview: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner: "read a computer's diary: the log files where it writes down what happened.",
    usage: ["logview", "logview <file> [--grep <text>] [--level <level>] [--last <n>] [--count]"],
    description: [
      "Computers keep logs: files where programs write a line every time something happens, like a login, an error, or a file being changed. Each line usually starts with the date and time.",
      "On Linux, logs live in the /var/log folder. Run logview on its own to list them, then open one with logview /var/log/<name>.",
      "Logs can be long, so you can filter them. --grep keeps only lines containing some text. --level keeps only lines of one importance level, such as info, warn, or error.",
    ],
    options: [
      {
        flags: "-g, --grep <text>",
        text: "Only show lines containing this text (capital letters don't matter).",
      },
      {
        flags: "-l, --level <level>",
        text: "Only show lines at this level: debug, info, notice, warn, error, or crit.",
      },
      { flags: "-n, --last <n>", text: "Only show the last n matching lines." },
      { flags: "-c, --count", text: "Only count the matching lines." },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      { command: "logview", text: "List the log files in /var/log." },
      { command: "logview /var/log/auth.log --grep failed", text: "Show failed login attempts." },
      {
        command: "logview /var/log/syslog --level error --count",
        text: "Count how many errors were logged.",
      },
    ],
    concept: [
      "Logs are how defenders find out what happened. A burst of failed logins can mean someone is guessing passwords. Security analysts spend much of their day reading and filtering logs.",
      "Logs are protected too: many can only be read by the admin account (root) or the adm group, because they can contain private details. Attackers often try to delete logs to hide their tracks, which is why defenders copy them somewhere safe.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-g", "--grep"], key: "grep", takesValue: true },
      { names: ["-l", "--level"], key: "level", takesValue: true },
      { names: ["-n", "--last"], key: "last", takesValue: true },
      { names: ["-c", "--count"], key: "count" },
    ]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [file, extra] = parsed.value.positionals;
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "file", value: extra, reason: "extra-argument" },
        state,
      );
    }

    const grep = optionValue(parsed.value, "grep");
    if (grep !== undefined && grep.length > MAX_FILTER_LENGTH) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "--grep", value: grep, reason: "too-long" },
        state,
      );
    }
    const levelText = optionValue(parsed.value, "level");
    const level = levelText === undefined ? undefined : levelOf(levelText.toLowerCase());
    if (levelText !== undefined && level === undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "--level", value: levelText, reason: "unknown-value" },
        state,
      );
    }
    const lastText = optionValue(parsed.value, "last");
    const last = lastText === undefined ? undefined : Number(lastText);
    if (lastText !== undefined && (!/^\d{1,6}$/.test(lastText) || last === 0)) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "--last", value: lastText, reason: "out-of-range" },
        state,
      );
    }

    const { vfs, ctx: fsCtx } = sessionFs(state, ctx.now);
    const hostId = sessionHost(state).id;
    const events: SimEvent[] = [];
    let text: string;
    let label: string;

    if (file === undefined && ctx.stdin !== undefined) {
      text = ctx.stdin;
      label = "(piped input)";
    } else {
      const info = stat(vfs, fsCtx, file ?? LOG_DIR);
      if (!info.ok) return failure(NAME, info.error, state);
      if (info.value.kind === "dir") return listLogs(file ?? LOG_DIR, state, ctx.now);
      const content = readFile(vfs, fsCtx, file ?? LOG_DIR);
      if (!content.ok) return failure(NAME, content.error, state);
      text = content.value;
      label = info.value.path;
      events.push({ type: "file.read", hostId, path: label });
    }

    const lines = splitLines(text);
    const needle = grep?.toLowerCase();
    let matches = lines
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(
        ({ line }) =>
          (needle === undefined || line.toLowerCase().includes(needle)) &&
          (level === undefined || lineLevel(line) === level),
      );
    const matched = matches.length;
    if (last !== undefined) matches = matches.slice(-last);

    const filters = [
      ...(grep !== undefined ? [`containing "${grep}"`] : []),
      ...(level !== undefined ? [`at level ${level}`] : []),
    ];
    const tally = filters.length
      ? `${matched} of ${plural(lines.length, "line")} ${filters.join(" and ")}`
      : plural(lines.length, "line");
    const output: OutputLine[] = [stdout(`logview (simulated) · ${label} · ${tally}`)];
    if (!hasSwitch(parsed.value, "count")) {
      output.push(stdout(""));
      if (lines.length === 0) output.push(stdout("(this log is empty)"));
      else if (matches.length === 0) output.push(stdout("(no lines match)"));
      const width = String(lines.length).length;
      for (const { line, number } of matches)
        output.push(stdout(`${String(number).padStart(width)}  ${line}`));
    }
    events.push({ type: "log.queried", hostId, path: label, matched });
    return success(state, output, events);
  },
};

/** Lists a folder's files, and whether the learner may read each one. */
function listLogs(path: string, state: SimState, now: number): SimResult {
  const { vfs, ctx } = sessionFs(state, now);
  const entries = listDir(vfs, ctx, path);
  if (!entries.ok) return failure(NAME, entries.error, state);
  const rows = entries.value.map((entry) => {
    const target = resolvePath(vfs, ctx.actor, ctx.cwd, entry.path);
    if (!target.ok) return [entry.name, "-", "can't open"];
    const { node } = target.value;
    if (node.kind === "dir") return [`${entry.name}/`, "-", "folder"];
    if (node.kind !== "file" || !canAccess(ctx.actor, node, "r")) {
      return [entry.name, "-", `no permission (owner ${node.owner}, group ${node.group})`];
    }
    return [entry.name, plural(splitLines(node.content).length, "line"), "readable"];
  });
  const dir = stat(vfs, ctx, path);
  const shown = dir.ok ? dir.value.path : path;
  const output: OutputLine[] = [stdout(`logview (simulated) · files in ${shown}`), stdout("")];
  if (rows.length === 0) output.push(stdout("(this folder is empty)"));
  else output.push(...columns(rows).map((line) => stdout(`  ${line}`)));
  output.push(stdout(""), stdout(`Open one with: logview ${shown === "/" ? "" : shown}/<name>`));
  return success(state, output);
}
