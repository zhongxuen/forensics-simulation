import { describe, expect, it } from "vitest";
import { errorCodes, eventTypes, fixtureState, text } from "../__fixtures__/harness";
import { FIXTURE_SCENARIO } from "../__fixtures__/scenario";
import { screen, sh, shell, shellSession } from "../__fixtures__/shell";
import { deserializeRun, replay, serializeRun } from "../core/replay";
import { serializeState } from "../core/serialize";
import { sessionFs } from "../core/session";
import { readFile } from "../fs/ops";
import type { SimState } from "../core/types";
import { MAX_HISTORY } from "./run";

const read = (state: SimState, path: string) => {
  const { vfs, ctx } = sessionFs(state, 0);
  const result = readFile(vfs, ctx, path);
  return result.ok ? result.value : undefined;
};

describe("pipelines", () => {
  it("sends each command's output into the next", () => {
    const result = shell(fixtureState(), "cat /var/log/auth.log | grep Failed | wc -l");
    expect(text(result)).toBe("3");
    expect(result.exitCode).toBe(0);
  });

  it("chains at least three commands, with sort and uniq", () => {
    const result = shell(
      fixtureState(),
      "cat /var/log/auth.log | grep Failed | cut -d_ -f1 | sort | uniq -c | sort -rn | head -n 1",
    );
    expect(result.exitCode).toBe(0);
    expect(result.output).toHaveLength(1);
  });

  it("sends error lines to the screen, not down the pipe", () => {
    const result = shell(fixtureState(), "cat nope.txt notes.txt | wc -l");
    expect(result.output.map((line) => line.stream)).toEqual(["stderr", "stdout"]);
    expect(text(result)).toContain("cat: nope.txt: No such file or directory");
    expect(text(result)).toContain("4");
  });

  it("uses the last command's exit status", () => {
    expect(shell(fixtureState(), "cat nope.txt | wc -l").exitCode).toBe(0);
    expect(shell(fixtureState(), "cat notes.txt | grep zzz").exitCode).toBe(1);
  });

  it("runs each part of a pipeline on its own, so cd doesn't stick", () => {
    const result = shell(fixtureState(), "cd /tmp | ls");
    expect(result.state.session.cwd).toBe("/home/recruit");
  });

  it("emits a command.run event for every command in the pipeline", () => {
    const result = shell(fixtureState(), "cat notes.txt | grep Say");
    const runs = result.events.filter((event) => event.type === "command.run");
    expect(runs).toEqual([
      { type: "command.run", command: "cat", line: "cat notes.txt", exitCode: 0 },
      { type: "command.run", command: "grep", line: "grep Say", exitCode: 0 },
    ]);
  });
});

describe("redirection", () => {
  it("writes output to a file with >, replacing it, and appends with >>", () => {
    const [first, second, third] = shellSession(
      fixtureState(),
      "echo one > out.txt",
      "echo two >> out.txt",
      "cat out.txt",
    );
    expect(first?.output).toEqual([]);
    expect(read(second?.state as SimState, "out.txt")).toBe("one\ntwo\n");
    expect(text(third!)).toBe("one\ntwo");
    const replaced = shell(third!.state, "echo three > out.txt");
    expect(read(replaced.state, "out.txt")).toBe("three\n");
  });

  it("reports file changes as events", () => {
    const created = shell(fixtureState(), "echo hi > new.txt");
    expect(created.events).toContainEqual({
      type: "file.changed",
      hostId: "ws-01",
      path: "/home/recruit/new.txt",
      change: "created",
    });
    const appended = shell(created.state, "echo again >> new.txt");
    expect(appended.events).toContainEqual({
      type: "file.changed",
      hostId: "ws-01",
      path: "/home/recruit/new.txt",
      change: "modified",
    });
  });

  it("empties the file before the command runs, even if the command fails", () => {
    const start = shell(fixtureState(), "echo keep > keep.txt").state;
    const result = shell(start, "cat nope.txt > keep.txt");
    expect(read(result.state, "keep.txt")).toBe("");
    expect(text(result)).toContain("No such file or directory");
  });

  it("refuses to write where the user has no permission, and doesn't run the command", () => {
    const result = shell(fixtureState(), "echo hi > /etc/hostname");
    expect(text(result)).toBe("bash: /etc/hostname: Permission denied");
    expect(errorCodes(result)).toEqual(["EACCES"]);
    expect(result.exitCode).toBe(1);
    expect(eventTypes(result)).not.toContain("command.run");
  });

  it("reads input from a file with <", () => {
    expect(text(shell(fixtureState(), "wc -l < notes.txt"))).toBe("4");
    expect(text(shell(fixtureState(), "wc -l < nope.txt"))).toBe(
      "bash: nope.txt: No such file or directory",
    );
  });

  it("sends errors to a file with 2>, and into output with 2>&1", () => {
    const hidden = shell(fixtureState(), "cat nope.txt 2> errors.txt");
    expect(hidden.output).toEqual([]);
    expect(read(hidden.state, "errors.txt")).toBe("cat: nope.txt: No such file or directory\n");
    const merged = shell(fixtureState(), "cat nope.txt 2>&1 | wc -l");
    expect(text(merged)).toBe("1");
  });

  it("throws output away into /dev/null", () => {
    const state = fixtureState();
    const result = shell(state, "cat notes.txt > /dev/null");
    expect(result.output).toEqual([]);
    expect(result.state.machines).toBe(state.machines);
  });

  it("refuses an ambiguous redirect", () => {
    const start = shellSession(fixtureState(), "touch a.log", "touch b.log").at(-1)!.state;
    const result = shell(start, "echo hi > *.log");
    expect(text(result)).toBe("bash: a.log b.log: ambiguous redirect");
  });

  it("refuses to redirect into a folder", () => {
    expect(text(shell(fixtureState(), "echo hi > /tmp"))).toBe("bash: /tmp: Is a directory");
  });
});

describe("lists", () => {
  it("runs the next command only after success with &&", () => {
    expect(text(shell(fixtureState(), "cat notes.txt && echo done"))).toContain("done");
    expect(text(shell(fixtureState(), "cat nope.txt && echo done"))).not.toContain("done");
  });

  it("runs the next command only after failure with ||", () => {
    expect(text(shell(fixtureState(), "cat nope.txt || echo fallback"))).toContain("fallback");
    expect(text(shell(fixtureState(), "cat notes.txt || echo fallback"))).not.toContain("fallback");
  });

  it("runs everything with ;", () => {
    const result = shell(fixtureState(), "cat nope.txt ; echo still");
    expect(text(result)).toContain("still");
    expect(result.exitCode).toBe(0);
  });

  it("combines && and || like bash", () => {
    expect(text(shell(fixtureState(), "cat nope.txt && echo yes || echo no"))).toContain("no");
    expect(text(shell(fixtureState(), "echo a && echo b ; echo c"))).toBe("a\nb\nc");
  });

  it("keeps cd across a list", () => {
    const result = shell(fixtureState(), "cd /tmp && pwd");
    expect(text(result)).toBe("/tmp");
    expect(result.state.session.cwd).toBe("/tmp");
  });
});

describe("expansion", () => {
  it("expands variables", () => {
    expect(text(shell(fixtureState(), "echo $HOME $USER"))).toBe("/home/recruit recruit");
    expect(text(shell(fixtureState(), "echo $NOPE."))).toBe(".");
  });

  it("follows cd in $PWD and $OLDPWD", () => {
    expect(text(shell(fixtureState(), "cd /tmp ; echo $PWD $OLDPWD"))).toBe("/tmp /home/recruit");
  });

  it("reports the last exit status as $?", () => {
    expect(text(shell(fixtureState(), "cat nope.txt ; echo $?"))).toContain("1");
  });

  it("sets variables with NAME=value, for the session or for one command", () => {
    const [set, used] = shellSession(fixtureState(), "GREETING=hi", "echo $GREETING");
    expect(set?.output).toEqual([]);
    expect(text(used!)).toBe("hi");
    const once = shell(fixtureState(), "LANG=C env");
    expect(text(once)).toContain("LANG=C");
    expect(once.state.session.env.LANG).toBeUndefined();
  });

  it("expands ~ to the home folder", () => {
    expect(text(shell(fixtureState(), "echo ~"))).toBe("/home/recruit");
    expect(text(shell(fixtureState(), "ls ~/notes.txt"))).toBe("/home/recruit/notes.txt");
  });

  it("expands wildcards to matching names, sorted, skipping hidden files", () => {
    expect(text(shell(fixtureState(), "echo *.txt"))).toBe("hashes.txt notes.txt");
    expect(text(shell(fixtureState(), "echo /var/log/*.log"))).toBe(
      "/var/log/auth.log /var/log/private.log",
    );
    expect(text(shell(fixtureState(), "echo .secret*"))).toBe(".secret-note");
    expect(text(shell(fixtureState(), "echo note?.txt"))).toBe("notes.txt");
    expect(text(shell(fixtureState(), "echo [hn]*.txt"))).toBe("hashes.txt notes.txt");
  });

  it("leaves a wildcard that matches nothing as typed", () => {
    expect(text(shell(fixtureState(), "echo *.zip"))).toBe("*.zip");
  });

  it("never expands quoted wildcards", () => {
    expect(text(shell(fixtureState(), "echo '*.txt'"))).toBe("*.txt");
  });

  it("only matches what the user can list", () => {
    expect(text(shell(fixtureState(), "echo /home/alex/*"))).toBe("/home/alex/*");
  });
});

describe("history", () => {
  it("records each line, including the history command itself", () => {
    const results = shellSession(fixtureState(), "pwd", "echo hi | wc -l", "history");
    expect(text(results[2]!)).toBe("    1  pwd\n    2  echo hi | wc -l\n    3  history");
  });

  it("keeps a bounded number of lines", () => {
    let state = fixtureState();
    for (let i = 0; i < MAX_HISTORY + 5; i++) state = shell(state, "pwd").state;
    expect(state.session.history).toHaveLength(MAX_HISTORY);
  });

  it("forgets everything with history -c", () => {
    const results = shellSession(fixtureState(), "pwd", "history -c", "history");
    expect(text(results[2]!)).toBe("    1  history");
  });
});

describe("flags", () => {
  it("counts a flag found when its token reaches the screen, even in colour", () => {
    const result = shell(fixtureState(), "grep SIM .secret-note");
    expect(screen(result)).toContain("\x1b["); // grep highlighted the match
    expect(result.events).toContainEqual({ type: "flag.found", flagId: "hidden-note" });
  });

  it("doesn't count a flag that only went into a file", () => {
    const result = shell(fixtureState(), "cat .secret-note > copy.txt");
    expect(eventTypes(result)).not.toContain("flag.found");
  });
});

describe("shell commands and replay", () => {
  it("never mutates the input state", () => {
    const state = fixtureState();
    const before = serializeState(state);
    shell(state, "echo x > f.txt ; cd /tmp ; rm -rf /tmp/alex-scratch.txt");
    expect(serializeState(state)).toBe(before);
  });

  it("does nothing for an empty line", () => {
    const state = fixtureState();
    const empty = shell(state, "");
    expect(empty.state).toBe(state);
    expect(empty.output).toEqual([]);
    expect(empty.events).toEqual([]);
  });

  it("round-trips shell commands through a serialized run and replays identically", () => {
    const run = {
      seed: 7,
      scenarioId: FIXTURE_SCENARIO.id,
      commands: [
        sh("cd /var/log"),
        sh("grep -c Failed auth.log > ~/count.txt"),
        sh("cat ~/count.txt"),
      ],
    };
    const back = deserializeRun(serializeRun(run));
    expect(back).toEqual({ ok: true, value: run });
    const scenarios = { [FIXTURE_SCENARIO.id]: FIXTURE_SCENARIO };
    const a = replay(run, scenarios);
    const b = replay(run, scenarios);
    expect(serializeState(a.state)).toBe(serializeState(b.state));
    expect(a.steps.at(-1)?.output.map((line) => line.text)).toEqual(["3"]);
  });

  it("rejects a malformed shell command in a run", () => {
    const bad = JSON.stringify({
      format: "hacker-sim/run",
      version: 1,
      seed: 1,
      scenarioId: "x",
      commands: [
        { type: "shell", line: "ls", list: [{ when: "sometimes", pipeline: { commands: [] } }] },
      ],
    });
    const result = deserializeRun(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toContain("when");
  });
});
