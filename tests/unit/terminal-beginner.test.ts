import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { findBannedWords } from "@/content/voice";
import {
  announceBlock,
  COMMAND_ALIASES,
  completeAtCursor,
  completesStep,
  createTerminalSession,
  explainBlock,
  explainError,
  explainParseError,
  ghostSuggestion,
  MAX_ANNOUNCED_LINES,
  PARSE_ERROR_CODES,
  parseCommandLine,
  reverseSearch,
  submitLine,
  successText,
  TERMINAL_TOUR,
  type ParseError,
  type TerminalSessionState,
} from "@/features/terminal";
import { FIXTURE_SCENARIO } from "@/sim/__fixtures__/scenario";
import { defaultRegistry } from "@/sim";
import { SIM_ERROR_CODES, type SimError, type SimErrorCode } from "@/sim/types";

const session = (): TerminalSessionState =>
  createTerminalSession({ scenario: FIXTURE_SCENARIO, seed: 1 });
const type = (start: TerminalSessionState, ...lines: string[]) =>
  lines.reduce((current, line) => submitLine(current, line), start);

/** One realistic example of every engine error code, including the variants with their own copy. */
const EXAMPLES: Record<SimErrorCode, readonly SimError[]> = {
  ENOENT: [
    { code: "ENOENT", path: "note.txt" },
    { code: "ENOENT", path: "/etc/nope" },
  ],
  EACCES: [
    { code: "EACCES", path: "/etc/shadow" },
    { code: "EACCES", path: "/root" },
    { code: "EACCES", path: "/home/alex/diary.txt" },
    { code: "EACCES", path: "/var/log/private.log" },
    { code: "EACCES", path: "/etc/hostname" },
  ],
  EPERM: [
    { code: "EPERM", path: "/tmp/x", detail: "sticky" },
    { code: "EPERM", path: "/etc/passwd" },
  ],
  ENOTDIR: [{ code: "ENOTDIR", path: "notes.txt" }],
  EISDIR: [
    { code: "EISDIR", path: "docs" },
    { code: "EISDIR", path: "docs", detail: "omit-directory" },
  ],
  EEXIST: [{ code: "EEXIST", path: "logs" }],
  ENOTEMPTY: [{ code: "ENOTEMPTY", path: "docs" }],
  ELOOP: [{ code: "ELOOP", path: "/tmp/loop-a" }],
  EINVAL: [
    { code: "EINVAL", path: "..", detail: "dot-path" },
    { code: "EINVAL", path: "a", detail: "into-itself" },
    { code: "EINVAL", path: "a", detail: "bad-name" },
    { code: "EINVAL", path: "f", detail: "unknown-user", value: "mallory" },
    { code: "EINVAL", path: "f", detail: "unknown-group", value: "ghosts" },
    { code: "EINVAL", path: "f" },
  ],
  EBUSY: [{ code: "EBUSY", path: "/", detail: "root" }],
  EFBIG: [{ code: "EFBIG", path: "big.txt" }],
  UNKNOWN_COMMAND: [{ code: "UNKNOWN_COMMAND", command: "sl" }],
  BAD_FLAG: [{ code: "BAD_FLAG", flag: "-z" }],
  MISSING_ARGUMENT: [
    { code: "MISSING_ARGUMENT", argument: "file operand" },
    { code: "MISSING_ARGUMENT", argument: "OLDPWD" },
    { code: "MISSING_ARGUMENT", argument: "page" },
    { code: "MISSING_ARGUMENT", argument: "destination file operand after 'a'" },
    { code: "MISSING_ARGUMENT", argument: "target" },
  ],
  BAD_ARGUMENT: [
    { code: "BAD_ARGUMENT", argument: "argument", value: "x", reason: "extra-argument" },
    { code: "BAD_ARGUMENT", argument: "--ports", value: "99999", reason: "out-of-range" },
    { code: "BAD_ARGUMENT", argument: "target", value: "10.0.0.0/8", reason: "range-too-large" },
    { code: "BAD_ARGUMENT", argument: "--path", value: "x", reason: "too-long" },
    { code: "BAD_ARGUMENT", argument: "--level", value: "loud", reason: "unknown-value" },
    { code: "BAD_ARGUMENT", argument: "mode", value: "999", reason: "bad-format" },
    { code: "BAD_ARGUMENT", argument: "redirect", value: "a b", reason: "bad-format" },
  ],
  HOST_NOT_FOUND: [{ code: "HOST_NOT_FOUND", target: "nowhere" }],
  HOST_UNREACHABLE: [{ code: "HOST_UNREACHABLE", target: "10.0.2.50" }],
  CONNECTION_REFUSED: [{ code: "CONNECTION_REFUSED", target: "10.0.1.20", port: 8080 }],
  PROTOCOL_MISMATCH: [
    { code: "PROTOCOL_MISMATCH", target: "10.0.1.20", port: 22, expected: "http", found: "ssh" },
  ],
  OUT_OF_SCOPE: [{ code: "OUT_OF_SCOPE", target: "8.8.8.8" }],
  SUDO_DENIED: [{ code: "SUDO_DENIED", user: "recruit" }],
  NO_MANUAL_ENTRY: [{ code: "NO_MANUAL_ENTRY", topic: "nmap" }],
  // Forensics (docs/plan/04-disk-tools.md).
  EVIDENCE_NOT_LOADED: [{ code: "EVIDENCE_NOT_LOADED" }],
  NOT_EVIDENCE: [{ code: "NOT_EVIDENCE", name: "qf-lt-99" }],
  WRITE_TO_EVIDENCE: [{ code: "WRITE_TO_EVIDENCE", path: "/dev/evidence/qf-lt-07" }],
  RECORD_NOT_FOUND: [{ code: "RECORD_NOT_FOUND", image: "qf-lt-07", record: 900 }],
  CLUSTERS_REUSED: [{ code: "CLUSTERS_REUSED", image: "qf-lt-07", record: 51 }],
  NOTHING_TO_PIN: [
    { code: "NOTHING_TO_PIN", reason: "no-output" },
    { code: "NOTHING_TO_PIN", reason: "no-ref", line: 3 },
  ],
  MEMORY_NOT_FOUND: [{ code: "MEMORY_NOT_FOUND", name: "qf-srv-99-mem" }],
  PROCESS_NOT_FOUND: [{ code: "PROCESS_NOT_FOUND", image: "qf-srv-01-mem", pid: 7 }],
};

const CONTEXT = { command: "cat", user: "recruit", cwd: "/home/recruit" };

/** Words banned by md-files/voice-and-tone.md that a checked string must not use about the learner. */
const ABOUT_THE_LEARNER = /\b(wrong|failed|illegal|invalid)\b/i;

describe("explainer copy", () => {
  it("covers every engine error code: this fails if a new code has no copy", () => {
    for (const code of SIM_ERROR_CODES) {
      const examples = EXAMPLES[code];
      expect(examples?.length, code).toBeGreaterThan(0);
      for (const error of examples) {
        const text = explainError(error, CONTEXT);
        expect(text.length, code).toBeGreaterThan(30);
        expect(findBannedWords(text), `${code}: ${text}`).toEqual([]);
        expect(text, `${code}: ${text}`).not.toMatch(ABOUT_THE_LEARNER);
      }
    }
  });

  it("covers every parse error code", () => {
    const examples: Record<(typeof PARSE_ERROR_CODES)[number], string> = {
      UNTERMINATED_QUOTE: "echo 'hi",
      UNEXPECTED_TOKEN: "| ls",
      UNEXPECTED_END: "ls |",
      BAD_SUBSTITUTION: "echo ${}",
      UNSUPPORTED_SYNTAX: "sleep 1 &",
      LINE_TOO_LONG: `echo ${"a".repeat(5000)}`,
    };
    for (const code of PARSE_ERROR_CODES) {
      const result = parseCommandLine(examples[code]);
      expect(result.ok, code).toBe(false);
      const error = (result as { error: ParseError }).error;
      expect(error.code).toBe(code);
      const text = explainParseError(error);
      expect(text.length, code).toBeGreaterThan(30);
      expect(findBannedWords(text), text).toEqual([]);
    }
  });

  it("gives the special explanations: shadow, sticky /tmp, the rm safety catch", () => {
    expect(explainError({ code: "EACCES", path: "/etc/shadow" }, CONTEXT)).toContain(
      "password hashes",
    );
    expect(
      explainError(
        { code: "EPERM", path: "/tmp/x", detail: "sticky" },
        { ...CONTEXT, command: "rm" },
      ),
    ).toContain("/tmp");
    expect(
      explainError({ code: "EBUSY", path: "/", detail: "root" }, { ...CONTEXT, command: "rm" }),
    ).toContain("Reset machine");
    expect(
      explainError({ code: "UNKNOWN_COMMAND", command: "sl" }, { ...CONTEXT, suggestion: "ls" }),
    ).toContain("Did you mean `ls`?");
  });

  it("uses no banned words in alias notes, the tour, or a sample of what-happened text", () => {
    for (const { note } of Object.values(COMMAND_ALIASES))
      expect(findBannedWords(note), note).toEqual([]);
    for (const step of TERMINAL_TOUR) {
      expect(findBannedWords(`${step.title} ${step.body} ${step.success ?? ""}`)).toEqual([]);
    }
  });

  it("points real tool names at the simulated ones", () => {
    // netscan and webprobe weren't vendored, so nmap and curl only explain (VENDORED.md).
    expect(COMMAND_ALIASES.nmap?.use).toBeUndefined();
    expect(COMMAND_ALIASES.journalctl?.use).toBe("logview");
    for (const alias of Object.values(COMMAND_ALIASES)) {
      if (alias.use)
        expect(defaultRegistry.has(alias.use.split(" ")[0] as string), alias.use).toBe(true);
    }
  });
});

describe("completion and ghost text", () => {
  const sim = session().sim;

  it("completes a unique command or path, adding a space after files and keeping folder slashes", () => {
    expect(completeAtCursor("who", 3, sim)).toEqual({ input: "whoami ", cursor: 7, choices: [] });
    expect(completeAtCursor("cat no", 6, sim)).toEqual({
      input: "cat notes.txt ",
      cursor: 14,
      choices: [],
    });
    expect(completeAtCursor("cd l", 4, sim)).toEqual({ input: "cd logs/", cursor: 8, choices: [] });
    expect(completeAtCursor("cat /etc/pa", 11, sim).input).toBe("cat /etc/passwd ");
  });

  it("fills in the shared start of several matches, then lists them", () => {
    const shared = completeAtCursor("ch", 2, sim);
    expect(shared.input).toBe("ch");
    expect(shared.choices).toEqual(["chmod", "chown"]);
    expect(completeAtCursor("cat /var/log/", 13, sim).choices).toEqual([
      "auth.log",
      "private.log",
      "syslog",
    ]);
  });

  it("completes in the middle of a line, after pipes and sudo", () => {
    expect(completeAtCursor("cat notes.txt | gre", 19, sim).input).toBe("cat notes.txt | grep ");
    expect(completeAtCursor("sudo wh", 7, sim).input).toBe("sudo whoami ");
  });

  it("offers ghost text from history first, then a unique completion, then a fix on an empty line", () => {
    expect(ghostSuggestion("net", 3, sim, ["netscan 10.0.1.0/24"])).toBe("scan 10.0.1.0/24");
    expect(ghostSuggestion("cat no", 6, sim, [])).toBe("tes.txt");
    expect(ghostSuggestion("", 0, sim, [], "ls -la")).toBe("ls -la");
    expect(ghostSuggestion("cat no", 2, sim, [])).toBe("");
  });

  it("searches history backwards for Ctrl+R", () => {
    const history = ["ls", "cat notes.txt", "cat hashes.txt", "pwd"];
    expect(reverseSearch(history, "cat")).toEqual({ index: 2, line: "cat hashes.txt" });
    expect(reverseSearch(history, "cat", 2)).toEqual({ index: 1, line: "cat notes.txt" });
    expect(reverseSearch(history, "zzz")).toBeUndefined();
  });
});

describe("what just happened", () => {
  it("explains each command, its options, pipes and redirection, from the man pages", () => {
    const block = type(session(), "ls -la /etc | grep pass > found.txt").blocks.at(-1)!;
    const explanation = explainBlock(block);
    expect(explanation.steps.map((step) => step.name)).toEqual(["ls", "grep"]);
    expect(explanation.steps[0]?.summary).toBe(defaultRegistry.get("ls")?.help.oneLiner);
    expect(explanation.steps[0]?.details.join(" ")).toContain("`-l`");
    expect(explanation.steps[0]?.details.join(" ")).toContain("`-a`");
    expect(explanation.steps[1]?.details.join(" ")).toContain("saved the output into found.txt");
    expect(explanation.joins[0]).toContain("The | (a pipe) sent what `ls` printed into `grep`");
    expect(explanation.outcome[0]).toContain("printed nothing");
  });

  it("explains errors, discoveries and && using the block's own lines and events", () => {
    const failed = explainBlock(type(session(), "cat nope && ls").blocks.at(-1)!);
    expect(failed.outcome[0]).toBe("It reported a problem.");
    expect(failed.joins[0]).toContain("only because `cat` worked");
    const scan = explainBlock(type(session(), "ping -c 1 10.0.1.20").blocks.at(-1)!);
    expect(scan.outcome.join(" ")).toContain("You discovered a new computer");
    const parse = explainBlock(type(session(), "ls |").blocks.at(-1)!);
    expect(parse.outcome[0]).toContain("nothing ran");
  });
});

describe("screen reader announcements", () => {
  it("reads short output in full, with explainers in beginner mode", () => {
    const block = type(session(), "cat /etc/shadow").blocks.at(-1)!;
    const text = announceBlock(block, true);
    expect(text).toContain("cat finished with a problem.");
    expect(text).toContain("Error: cat: /etc/shadow: Permission denied");
    expect(text).toContain("password hashes");
    expect(announceBlock(block, false)).not.toContain("password hashes");
  });

  it("summarises long output instead of reading every line", () => {
    const block = type(session(), "man ls").blocks.at(-1)!;
    expect(block.lines.length).toBeGreaterThan(MAX_ANNOUNCED_LINES);
    expect(announceBlock(block, true)).toMatch(
      /\d+ lines of output\. Press Shift\+Tab to review them/,
    );
  });

  it("says when a command printed nothing", () => {
    expect(announceBlock(type(session(), "cd /tmp").blocks.at(-1)!, false)).toBe(
      "cd finished. No output.",
    );
  });
});

describe("guided tour", () => {
  it("goes whoami, ls, cat, and ticks a step when its command works", () => {
    expect(TERMINAL_TOUR.map((step) => step.waitFor).filter(Boolean)).toEqual([
      "whoami",
      "ls",
      "cat",
    ]);
    const whoami = TERMINAL_TOUR.find((step) => step.id === "whoami")!;
    const worked = type(session(), "whoami").blocks.at(-1)!;
    expect(completesStep(whoami, worked.events)).toBe(true);
    expect(successText(whoami, "recruit")).toContain("You're `recruit`");
    const cat = TERMINAL_TOUR.find((step) => step.id === "cat")!;
    expect(completesStep(cat, type(session(), "cat nope").blocks.at(-1)!.events)).toBe(false);
  });
});

describe("the terminal's boundary with the engine", () => {
  const root = join(import.meta.dirname, "../../src");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? files(path) : /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
    });

  it("terminal components import nothing from the engine except types", () => {
    const components = files(join(root, "features/terminal/components"));
    expect(components.length).toBeGreaterThan(5);
    for (const file of components) {
      const source = readFileSync(file, "utf8");
      const runtimeSimImports = [
        ...source.matchAll(/^import (?!type)[^;]*from "@\/sim(?:\/[^"]*)?";/gm),
      ]
        .map((match) => match[0])
        .filter((line) => !/from "@\/sim\/types"/.test(line));
      expect(runtimeSimImports, relative(root, file)).toEqual([]);
    }
  });

  it("nothing in src evaluates text as code", () => {
    for (const file of files(root)) {
      const source = readFileSync(file, "utf8");
      expect(source, relative(root, file)).not.toMatch(/\beval\s*\(|new\s+Function\s*\(/);
    }
  });
});
