/**
 * "Did you mean…?" for the beginner layer: the command a learner probably meant, and a corrected
 * line they can accept with Tab. Suggestions come from the tool registry and the filesystem as the
 * learner can see it, never from guessing what's hidden.
 */
import { closestMatches, defaultRegistry, formatArgv, suggestPath } from "@/sim";
import type { SimError, SimState } from "@/sim/types";
import type { CommandLineNode, WordNode } from "../parser";

/**
 * Commands people bring from elsewhere: Windows, other shells, and real security tools, which
 * this platform replaces with simulated ones on purpose.
 */
export const COMMAND_ALIASES: Readonly<
  Record<string, { readonly use?: string; readonly note: string }>
> = {
  dir: { use: "ls", note: "`dir` lists files on Windows. On Linux, it's `ls`." },
  cls: { use: "clear", note: "`cls` clears the screen on Windows. On Linux, it's `clear`." },
  type: { use: "cat", note: "`type` shows a file on Windows. On Linux, it's `cat`." },
  copy: { use: "cp", note: "`copy` is the Windows name. On Linux, copying is `cp`." },
  move: { use: "mv", note: "`move` is the Windows name. On Linux, moving is `mv`." },
  del: { use: "rm", note: "`del` deletes on Windows. On Linux, it's `rm`." },
  erase: { use: "rm", note: "`erase` deletes on Windows. On Linux, it's `rm`." },
  md: { use: "mkdir", note: "`md` makes a folder on Windows. On Linux, it's `mkdir`." },
  rmdir: { use: "rm -r", note: "This terminal deletes folders with `rm -r`." },
  ipconfig: { use: "ifconfig", note: "`ipconfig` is the Windows name. On Linux, it's `ifconfig`." },
  ip: {
    use: "ifconfig",
    note: "Newer Linux uses `ip a` for addresses. This terminal has `ifconfig`.",
  },
  // nmap, masscan, curl, wget and nikto pointed at netscan and webprobe, which weren't vendored
  // (VENDORED.md). An investigator works from the evidence, not by probing computers.
  nmap: {
    note: "`nmap` is a real network scanner. There's no scanning here: you work from the evidence you've been given.",
  },
  masscan: {
    note: "There's no scanning here: you work from the evidence you've been given.",
  },
  curl: {
    note: "`curl` fetches web pages for real. This workstation doesn't fetch anything: the evidence is already here.",
  },
  wget: {
    note: "This workstation doesn't fetch anything: the evidence is already here.",
  },
  nikto: { note: "There's no web scanning here: you work from the evidence you've been given." },
  journalctl: {
    use: "logview",
    note: "This practice terminal reads logs with `logview`, or `cat` and `grep`.",
  },
  quit: { use: "exit", note: "To log out, the command is `exit`." },
  logout: { use: "exit", note: "To log out, the command is `exit`." },
  hashcat: { note: "There's no password cracking here." },
  john: { note: "There's no password cracking here." },
  vi: {
    note: 'There\'s no text editor in this practice terminal. Write a file with `echo "text" > file.txt`, and read it with `cat`.',
  },
  vim: {
    note: 'There\'s no text editor in this practice terminal. Write a file with `echo "text" > file.txt`, and read it with `cat`.',
  },
  nano: {
    note: 'There\'s no text editor in this practice terminal. Write a file with `echo "text" > file.txt`, and read it with `cat`.',
  },
  su: {
    use: "sudo",
    note: "`su` switches to another account. This terminal runs single commands as the admin with `sudo`.",
  },
  ssh: {
    note: "Connecting to another computer isn't part of this practice terminal.",
  },
  apt: {
    note: "Installing software isn't possible here: this practice computer has every command it needs.",
  },
  "apt-get": {
    note: "Installing software isn't possible here: this practice computer has every command it needs.",
  },
  python: {
    note: "This practice terminal doesn't run programs or scripts. Everything here is a simulation.",
  },
  python3: {
    note: "This practice terminal doesn't run programs or scripts. Everything here is a simulation.",
  },
  bash: { note: "You're already in the shell. This practice terminal doesn't start new ones." },
  sh: { note: "You're already in the shell. This practice terminal doesn't start new ones." },
};

export interface Suggestion {
  /** What to show in the explainer: a command or path that exists. */
  readonly suggestion?: string;
  readonly suggestionSummary?: string;
  /** Extra plain-words note, for commands from other systems. */
  readonly note?: string;
  /** The whole line with the fix applied, ready for Tab. */
  readonly fixedLine?: string;
}

/** The line with one word replaced, keeping everything else as typed. */
function replaceWord(line: string, word: WordNode, replacement: string): string {
  return `${line.slice(0, word.start)}${replacement}${line.slice(word.end)}`;
}

/** Every word in the line, in order. */
function allWords(ast: CommandLineNode): WordNode[] {
  return ast.items.flatMap((item) =>
    item.pipeline.commands.flatMap((command) => [
      ...command.words,
      ...command.redirects.flatMap((redirect) => (redirect.target ? [redirect.target] : [])),
    ]),
  );
}

/**
 * A suggestion for an error, given the line that caused it. Commands come from the registry
 * (typo distance) or the alias list; paths come from what the learner can list on this machine.
 */
export function suggestFix(
  error: SimError,
  line: string,
  ast: CommandLineNode | undefined,
  sim: SimState,
): Suggestion {
  if (error.code === "UNKNOWN_COMMAND") {
    const alias = Object.hasOwn(COMMAND_ALIASES, error.command)
      ? COMMAND_ALIASES[error.command]
      : undefined;
    const guess = alias?.use ?? closestMatches(error.command, defaultRegistry.names())[0];
    const word = ast && allWords(ast).find((w) => w.raw === error.command);
    const summary = guess && defaultRegistry.get(guess.split(" ")[0] ?? guess)?.help.oneLiner;
    return {
      ...(guess && { suggestion: guess }),
      ...(summary && !alias && { suggestionSummary: summary }),
      ...(alias && { note: alias.note }),
      ...(guess && word && { fixedLine: replaceWord(line, word, guess) }),
    };
  }
  if (error.code === "ENOENT") {
    const fixed = suggestPath(sim, error.path);
    if (!fixed) return {};
    const word =
      ast && allWords(ast).find((w) => w.raw === error.path || w.raw === formatArgv([error.path]));
    return {
      suggestion: fixed,
      ...(word && { fixedLine: replaceWord(line, word, formatArgv([fixed])) }),
    };
  }
  return {};
}
