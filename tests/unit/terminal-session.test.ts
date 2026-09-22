import { describe, expect, it } from "vitest";
import {
  clearScreen,
  createTerminalSession,
  formatPrompt,
  interruptLine,
  nextCommandTime,
  parseAnsi,
  plainTranscript,
  promptFor,
  resetMachine,
  screenLineCount,
  sessionSnapshot,
  submitLine,
  type TerminalSessionState,
} from "@/features/terminal";
import { FIXTURE_SCENARIO, FIXTURE_SEED } from "@/sim/__fixtures__/scenario";
import { deserializeRun, replay, serializeState } from "@/sim";

/**
 * The terminal session bridge (md-files/05-terminal-module.md, prompt 05.2), tested in plain Node
 * through its pure core, with the phase 04 fixture scenario.
 */

const fresh = () => createTerminalSession({ scenario: FIXTURE_SCENARIO, seed: FIXTURE_SEED });

function type(session: TerminalSessionState, ...lines: string[]): TerminalSessionState {
  return lines.reduce((current, line) => submitLine(current, line), session);
}

const lastBlock = (session: TerminalSessionState) => {
  const block = session.blocks.at(-1);
  if (!block) throw new Error("no block");
  return block;
};

const outputText = (session: TerminalSessionState) =>
  lastBlock(session)
    .lines.filter((line) => line.kind === "output")
    .map((line) => line.text)
    .join("\n");

describe("createTerminalSession", () => {
  it("starts the scenario with an empty screen and run", () => {
    const session = fresh();
    expect(session.sim.session.cwd).toBe("/home/recruit");
    expect(session.run).toEqual({
      seed: FIXTURE_SEED,
      scenarioId: FIXTURE_SCENARIO.id,
      commands: [],
    });
    expect(session.blocks).toEqual([]);
  });

  it("shows a prompt like a real shell, with ~ for home and # for root", () => {
    const session = fresh();
    expect(formatPrompt(promptFor(session.sim))).toBe("recruit@ws-01:~$");
    expect(formatPrompt(promptFor(type(session, "cd /var/log").sim))).toBe(
      "recruit@ws-01:/var/log$",
    );
  });
});

describe("submitLine", () => {
  it("parses, runs through the engine, and adds a block with the prompt it ran at", () => {
    const session = type(fresh(), "cd /tmp", "pwd");
    const block = lastBlock(session);
    expect(block.prompt.cwd).toBe("/tmp");
    expect(block.input).toBe("pwd");
    expect(outputText(session)).toBe("/tmp");
    expect(block.exitCode).toBe(0);
    expect(block.events.at(-1)).toMatchObject({ type: "command.run", command: "pwd" });
  });

  it("runs pipelines, redirection and && across three commands", () => {
    const session = type(
      fresh(),
      "cat /var/log/auth.log | grep Failed | wc -l > count.txt && cat count.txt",
    );
    expect(outputText(session)).toBe("3");
  });

  it("records every command sent to the engine in the run, and replays to the same state", () => {
    const session = type(fresh(), "ls -la", "echo hi > f.txt", "netscan 10.0.1.0/24", "cat f.txt");
    expect(session.run.commands).toHaveLength(4);
    expect(session.run.commands.every((command) => command.type === "shell")).toBe(true);
    const back = deserializeRun(sessionSnapshot(session).serializedRun);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const replayed = replay(back.value, { [FIXTURE_SCENARIO.id]: FIXTURE_SCENARIO });
    expect(serializeState(replayed.state)).toBe(serializeState(session.sim));
  });

  it("uses in-world time: the scenario start plus a second per command", () => {
    const start = nextCommandTime(fresh());
    const session = type(fresh(), "date");
    expect(nextCommandTime(session)).toBe(start + 1000);
    expect(outputText(session)).toBe("Mon Mar  2 09:00:00 UTC 2026");
  });

  it("keeps every submitted line in the input history, without repeating the last", () => {
    const session = type(fresh(), "ls", "ls", "pwd", "", "echo 'unfinished");
    expect(session.inputHistory).toEqual(["ls", "pwd", "echo 'unfinished"]);
  });

  it("shows a parse error with the bash message, a pointer, and an explanation, and runs nothing", () => {
    const session = type(fresh(), "echo 'hello");
    const block = lastBlock(session);
    expect(block.parseError?.code).toBe("UNTERMINATED_QUOTE");
    expect(block.lines.map((line) => [line.kind, line.text])).toEqual([
      ["output", "bash: unexpected EOF while looking for matching `''"],
      ["explain", "echo 'hello"],
      ["explain", "     ^"],
      ["explain", expect.stringContaining("never closed")],
    ]);
    expect(session.run.commands).toEqual([]);
  });

  it("shows an empty line as a fresh prompt without running anything", () => {
    const session = type(fresh(), "   ");
    expect(lastBlock(session).lines).toEqual([]);
    expect(session.run.commands).toEqual([]);
  });

  it("parses colour codes once, when the line arrives", () => {
    const session = type(fresh(), "ls");
    const spans = lastBlock(session).lines[0]?.spans ?? [];
    expect(spans.some((span) => span.style.fg === "cyan" && span.style.bold)).toBe(true);
    expect(lastBlock(session).lines[0]?.text).toBe("hashes.txt  logs  notes.txt");
  });

  it("clears the screen for clear, and for Ctrl+L", () => {
    const cleared = type(fresh(), "ls", "pwd", "clear");
    expect(cleared.blocks).toEqual([]);
    expect(cleared.run.commands).toHaveLength(3);
    expect(clearScreen(type(fresh(), "ls")).blocks).toEqual([]);
  });
});

describe("beginner explanations", () => {
  it("follows every error line with an explainer", () => {
    const session = type(fresh(), "cat /etc/shadow");
    const [error, explain] = lastBlock(session).lines;
    expect(error).toMatchObject({ kind: "output", text: "cat: /etc/shadow: Permission denied" });
    expect(error?.error?.code).toBe("EACCES");
    expect(explain).toMatchObject({ kind: "explain" });
    expect(explain?.text).toContain("password hashes");
  });

  it("suggests a command for a typo, with a fixed line for Tab", () => {
    const block = lastBlock(type(fresh(), "sl -la"));
    expect(block.lines[0]?.text).toBe("sl: command not found");
    expect(block.lines[1]?.text).toContain("Did you mean `ls`?");
    expect(block.lines[1]?.text).toContain("Press Tab to use it.");
    expect(block.fixedLine).toBe("ls -la");
  });

  it("explains commands from other systems", () => {
    const block = lastBlock(type(fresh(), "dir"));
    expect(block.lines[1]?.text).toContain("On Linux, it's `ls`");
    expect(block.fixedLine).toBe("ls");
    // nmap pointed at netscan, which wasn't vendored (VENDORED.md); ipconfig keeps a target.
    expect(lastBlock(type(fresh(), "ipconfig -a")).fixedLine).toBe("ifconfig -a");
  });

  it("suggests a real file name for a misspelt path", () => {
    const block = lastBlock(type(fresh(), "cat note.txt"));
    expect(block.lines[1]?.text).toContain("Did you mean `notes.txt`?");
    expect(block.fixedLine).toBe("cat notes.txt");
  });

  it("explains that a silent command worked, the first time only", () => {
    const once = type(fresh(), "mkdir box");
    expect(lastBlock(once).lines.map((line) => line.text)).toEqual([
      expect.stringContaining("prints nothing when it works"),
    ]);
    expect(lastBlock(type(once, "mkdir box2")).lines).toEqual([]);
  });

  it("adds a note after deleting, saying Reset brings it back", () => {
    const block = lastBlock(type(fresh(), "rm notes.txt"));
    expect(block.lines.at(-1)?.text).toContain("Reset machine button brings everything back");
  });
});

describe("interrupt, reset and scrollback", () => {
  it("Ctrl+C abandons the line with ^C", () => {
    const session = interruptLine(fresh(), "rm -rf ~");
    expect(lastBlock(session)).toMatchObject({ input: "rm -rf ~^C", interrupted: true, lines: [] });
    expect(session.run.commands).toEqual([]);
  });

  it("reset restores the scenario's starting state and starts a fresh run, keeping the screen", () => {
    const changed = type(fresh(), "rm notes.txt", "cd /tmp");
    const reset = resetMachine(changed);
    expect(serializeState(reset.sim)).toBe(serializeState(fresh().sim));
    expect(reset.run.commands).toEqual([]);
    expect(reset.blocks).toHaveLength(3);
    expect(lastBlock(reset)).toMatchObject({ kind: "note" });
  });

  it("drops the oldest lines past the scrollback limit", () => {
    let session = createTerminalSession({ scenario: FIXTURE_SCENARIO, seed: 1, scrollback: 100 });
    for (let i = 0; i < 60; i++) session = submitLine(session, "cat notes.txt");
    expect(screenLineCount(session)).toBeLessThanOrEqual(100);
    expect(session.blocks.at(-1)?.input).toBe("cat notes.txt");
    expect(session.run.commands).toHaveLength(60);
  });

  it("handles 200 commands quickly", () => {
    const started = performance.now();
    let session = fresh();
    for (let i = 0; i < 200; i++)
      session = submitLine(session, i % 2 ? "ls -la /etc" : "echo $USER | wc -c");
    expect(session.run.commands).toHaveLength(200);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});

describe("plainTranscript", () => {
  it("copies prompts, commands and output without colour codes or explanations", () => {
    const session = type(fresh(), "ls", "cat nope");
    expect(plainTranscript(session.blocks)).toBe(
      "recruit@ws-01:~$ ls\nhashes.txt  logs  notes.txt\nrecruit@ws-01:~$ cat nope\ncat: nope: No such file or directory",
    );
  });
});

describe("parseAnsi", () => {
  it("turns colour codes into styled spans, and finds clear-screen codes", () => {
    const parsed = parseAnsi("a\x1b[01;34mdir\x1b[0m b");
    expect(parsed.plain).toBe("adir b");
    expect(parsed.spans).toEqual([
      { text: "a", style: {} },
      { text: "dir", style: { bold: true, fg: "blue" } },
      { text: " b", style: {} },
    ]);
    expect(parseAnsi("\x1b[H\x1b[2J\x1b[3J")).toEqual({ spans: [], plain: "", clearsScreen: true });
    expect(parseAnsi("\x1b[92mhi\x1b[39m\x1b[K").spans).toEqual([
      { text: "hi", style: { fg: "bright-green" } },
    ]);
  });
});
