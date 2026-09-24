/**
 * "What just happened?": a plain-language walk through one command line, built from static text:
 * each command's man-page one-liner and option descriptions, what the symbols between commands
 * do, and what the result means. (The AI mentor's version arrives in phase 10.)
 */
import { defaultRegistry } from "@/sim";
import type { ToolHelp, ToolRegistry } from "@/sim/types";
import type { CommandNode, WordNode } from "../parser";
import type { TerminalBlock } from "../session/terminal-session";

export interface CommandStep {
  /** The command as typed: "ls -la /etc". */
  readonly typed: string;
  readonly name: string;
  /** What the command does, in one line. */
  readonly summary: string;
  /** What each option and redirection did. */
  readonly details: readonly string[];
}

export interface WhatHappened {
  readonly steps: readonly CommandStep[];
  /** How the commands were joined: pipes, && and ;. */
  readonly joins: readonly string[];
  /** What the result means. */
  readonly outcome: readonly string[];
}

const wordText = (word: WordNode) =>
  word.parts
    .map((part) =>
      "text" in part ? part.text : "variable" in part ? `$${part.variable}` : `~${part.tilde}`,
    )
    .join("");

/** "-p, --ports <list>" → ["-p", "--ports"]. */
const optionNames = (flags: string) =>
  flags
    .split(/,\s*|\s+\/\s+|\s+/)
    .map((name) => name.replace(/\[=.*$/, ""))
    .filter((name) => name.startsWith("-"));

function describeOption(help: ToolHelp | undefined, flag: string): string | undefined {
  if (!help?.options) return undefined;
  const plain = flag.replace(/=.*$/, "");
  const found = help.options.find((option) => optionNames(option.flags).includes(plain));
  return found ? `\`${plain}\`: ${found.text}` : undefined;
}

/** Extra notes on reading some commands' output. Static, like a footnote in the manual. */
const OUTPUT_NOTES: Readonly<Record<string, (flags: readonly string[]) => string | undefined>> = {
  ls: (flags) =>
    flags.some((flag) => /^-[a-zA-Z]*l/.test(flag))
      ? "Each row of a long listing reads: permissions, number of links, owner, group, size in bytes, last-changed time, name."
      : undefined,
  netscan: () => "Every computer that answered is now on your network map.",
  grep: () =>
    "grep's exit status is 0 when it finds a match and 1 when it doesn't, which is how && and || know what happened.",
  // The disk tools (docs/plan/04-disk-tools.md). Each says how to read what it printed.
  blocker: () =>
    "With a write-blocker on, this workstation can read that drive but never write to it, so examining it can't change it. Turning one off is how Case 1 teaches why they exist.",
  acquire: () =>
    "The two hashes at the end are fingerprints of the copy's bytes. Compare one with the hash on the handover form (`hashsum --verify`) to show the copy matches the drive you were given.",
  hashsum: () =>
    "A hash is a fingerprint of a pile of bytes: the same bytes always give the same fingerprint, and one changed byte gives a completely different one. MATCH means nothing changed; MISMATCH means something did, and finding out what is part of the job.",
  lsfs: (flags) =>
    flags.some((flag) => /^-[a-zA-Z]*l/.test(flag))
      ? "Each row reads: deleted mark, record number, size, owner, then the four MACB times (modified, accessed, changed, born) and the name. A `*` in front means the record was deleted."
      : "Each row reads: deleted mark, record number, size, name. A `*` in front means the file was deleted, and its record is still there to be read.",
  inode: () =>
    'MACB is the four times a record carries: modified, accessed, changed and born. For a deleted record, "Reused" is the line that matters: while nothing has been written over its clusters, `recover` can still write the content out.',
  recover: () =>
    "What was written is a copy of bytes still sitting in the image's clusters. The image itself isn't touched, and the record number and cluster list are what a report points at.",
  carve: () =>
    "Each row is one object found in the drive's free space by its first bytes: where it starts, what type it looks like, and how big it is. A partial one lost its end to something written later. None of them has a name or times, because those lived in the file record.",
  strings: () =>
    "Each line is a run of readable characters found in the bytes, in the order they sit. With `-o`, the number in front is how far in it was found. A string shows that some text was there, not who put it there.",
  logq: (flags) =>
    flags.some((flag) => flag.startsWith("--count-by"))
      ? "Each row is one value of the field you counted by, how many records have it, and when it first and last appears. Many records sharing one value in a short time is what a burst looks like."
      : "Each record is printed the way its source writes it, with every line carrying the record's ref, so a line you keep with `grep` can still be pinned.",
  // The memory tools (docs/plan/08-memory-tools.md): one note per subcommand.
  mem: (args) => {
    const sub = args.find((arg) => !arg.startsWith("-")) ?? "";
    return Object.hasOwn(MEM_NOTES, sub) ? MEM_NOTES[sub] : undefined;
  },
  pin: () =>
    "A pin stores the artefact ref, the short string that names exactly one piece of evidence, so the report can point back at this record rather than at your memory of it.",
};

/** How to read each `mem` subcommand's output. */
const MEM_NOTES: Readonly<Record<string, string>> = {
  info: "A memory image is one moment on one computer: everything in it was true at the capture time, and says nothing about after.",
  ps: "Each row is one running process: its number (PID), the number of the process that started it (PPID), its name, when it started and whose account it runs as. This is the list Windows keeps, and it can be tampered with.",
  psscan:
    "This searched the whole image for processes instead of trusting the list. A row marked `unlinked` is still running but was taken out of the list `mem ps` reads; compare the two.",
  pstree:
    "Each process sits under the one that started it. Most of Windows starts in a known order, so a familiar name under an unfamiliar parent is worth a look.",
  netscan:
    "LOCAL is this computer's end of a connection and REMOTE the other end. The same REMOTE address over and over, a steady time apart, is a program checking in on a timer. Note it; never connect to it.",
  cmdline:
    "The command line is the full instruction a process started with: where its file really is, and what it was asked to do.",
  malfind:
    "Each block is memory that can be written and run, with no file behind it, and its first 64 bytes. Injected code looks like this, and so does a runtime compiling code as it goes: which process it's in, and whether it starts with `MZ`, tell them apart.",
  strings:
    "Reading the text out of a process's memory isn't built yet. `mem cmdline` holds most of the text worth reading.",
};

const REDIRECT_TEXT: Readonly<Record<string, (target: string) => string>> = {
  ">": (file) =>
    `\`> ${file}\` saved the output into ${file} instead of showing it, replacing what was in it.`,
  ">>": (file) => `\`>> ${file}\` added the output to the end of ${file} instead of showing it.`,
  "<": (file) =>
    `\`< ${file}\` fed the contents of ${file} into the command, as if you'd piped it in.`,
  "2>": (file) => `\`2> ${file}\` sent error messages into ${file} instead of the screen.`,
  "2>>": (file) => `\`2>> ${file}\` added error messages to the end of ${file}.`,
  "2>&1": () => "`2>&1` sent error messages to the same place as the output.",
};

function stepFor(
  command: CommandNode,
  line: string,
  registry: ToolRegistry,
): CommandStep | undefined {
  const first = command.words[0];
  if (!first) {
    const names = command.assignments.map((a) => a.name).join(", ");
    return {
      typed: line.slice(command.start, command.end),
      name: names,
      summary: `set the variable${command.assignments.length > 1 ? "s" : ""} ${names}, so $${command.assignments[0]?.name ?? ""} can be used in later commands.`,
      details: [],
    };
  }
  const name = wordText(first);
  const tool = registry.get(name);
  const args = command.words.slice(1).map(wordText);
  const details: string[] = [];
  for (const arg of args) {
    if (!arg.startsWith("-") || arg === "-" || arg === "--") continue;
    if (!arg.startsWith("--") && arg.length > 2) {
      // A cluster like -la: each letter is its own option.
      const letters = [...arg.slice(1)].map((letter) => describeOption(tool?.help, `-${letter}`));
      if (letters.every(Boolean)) {
        details.push(...(letters as string[]));
        continue;
      }
    }
    details.push(
      describeOption(tool?.help, arg) ??
        `\`${arg}\`: an option. \`${name} --help\` lists what each one does.`,
    );
  }
  if (tool && name === "sudo" && args[0])
    details.push(`It ran \`${args.join(" ")}\` as the admin account, root.`);
  for (const redirect of command.redirects) {
    details.push(
      REDIRECT_TEXT[redirect.op]?.(redirect.target ? wordText(redirect.target) : "") ?? "",
    );
  }
  const note = OUTPUT_NOTES[name]?.(args);
  if (note) details.push(note);
  return {
    typed: line.slice(command.start, command.end),
    name,
    summary: tool
      ? tool.help.oneLiner
      : "not a command on this computer. Type help to see the ones you can use.",
    details: details.filter(Boolean),
  };
}

/** The explanation for one block on the screen. */
export function explainBlock(
  block: TerminalBlock,
  registry: ToolRegistry = defaultRegistry,
): WhatHappened {
  if (block.parseError) {
    const explain = block.lines.find((line) => line.kind === "explain" && !line.pointer);
    return {
      steps: [],
      joins: [],
      outcome: [
        "The computer couldn't read the line, so nothing ran. A line is checked before anything happens, exactly like any input a program receives.",
        ...(explain ? [explain.text] : []),
      ],
    };
  }
  if (block.interrupted) {
    return {
      steps: [],
      joins: [],
      outcome: ["You pressed Ctrl+C, so the line was abandoned without running."],
    };
  }
  const ast = block.ast;
  if (!ast || ast.items.length === 0) {
    return { steps: [], joins: [], outcome: ["Nothing: an empty line gives you a fresh prompt."] };
  }

  const steps: CommandStep[] = [];
  const joins: string[] = [];
  ast.items.forEach((item, i) => {
    const commands = item.pipeline.commands;
    commands.forEach((command) => {
      const s = stepFor(command, block.input, registry);
      if (s) steps.push(s);
    });
    for (let c = 1; c < commands.length; c++) {
      const from = commands[c - 1]?.words[0];
      const to = commands[c]?.words[0];
      if (from && to) {
        joins.push(
          `The | (a pipe) sent what \`${wordText(from)}\` printed into \`${wordText(to)}\`, instead of the screen.`,
        );
      }
    }
    if (i > 0 && item.operator) {
      // A pipeline's success is its last command's, so that's the one && and || look at.
      const before = ast.items[i - 1]?.pipeline.commands.at(-1)?.words[0];
      const after = commands[0]?.words[0];
      const a = before ? `\`${wordText(before)}\`` : "the command before";
      const b = after ? `\`${wordText(after)}\`` : "the next one";
      joins.push(
        item.operator === "&&"
          ? `\`&&\` ran ${b} only because ${a} worked.`
          : item.operator === "||"
            ? `\`||\` ran ${b} only if ${a} didn't work.`
            : `\`;\` ran ${b} after ${a}, whatever happened.`,
      );
    }
  });

  const outcome: string[] = [];
  const shown = block.lines.filter((line) => line.kind === "output");
  const errors = shown.filter((line) => line.error);
  if (errors.length > 0) {
    outcome.push(`It reported ${errors.length === 1 ? "a problem" : `${errors.length} problems`}.`);
    const explanations = block.lines.filter((line) => line.kind === "explain" && !line.pointer);
    outcome.push(...explanations.map((line) => line.text));
  } else if (shown.length === 0) {
    outcome.push(
      "It printed nothing. For most commands, that means it worked: no news is good news.",
    );
  } else {
    outcome.push(`It printed ${shown.length === 1 ? "one line" : `${shown.length} lines`}.`);
  }
  const discovered = block.events.filter((event) => event.type === "host.discovered").length;
  if (discovered > 0) {
    outcome.push(
      `You discovered ${discovered === 1 ? "a new computer" : `${discovered} new computers`}.`,
    );
  }
  const services = block.events.filter((event) => event.type === "service.discovered").length;
  if (services > 0) {
    outcome.push(
      `You found ${services === 1 ? "an open port" : `${services} open ports`} (a door into a computer) and the program answering there.`,
    );
  }
  if (block.events.some((event) => event.type === "flag.found"))
    outcome.push("You found a secret!");
  const changed = block.events.filter((event) => event.type === "file.changed");
  for (const event of changed.slice(0, 5)) {
    if (event.type === "file.changed")
      outcome.push(
        `\`${event.path}\` was ${event.change === "permissions" ? "given new permissions" : event.change === "owner" ? "given a new owner" : event.change}.`,
      );
  }
  return { steps, joins, outcome };
}
