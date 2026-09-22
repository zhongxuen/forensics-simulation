import { describe, expect, it } from "vitest";
import {
  errorCodes,
  eventTypes,
  fixtureState,
  run,
  testContext,
  text,
} from "../__fixtures__/harness";
import { createRegistry } from "../tools/registry";
import { BUILTIN_TOOLS } from "../tools";
import { success, stdout } from "./output";
import { step } from "./step";
import { serializeState } from "./serialize";
import type { SimEvent } from "./types";
import type { Tool } from "../tools/types";

describe("step", () => {
  it("does nothing for an empty line, and doesn't count it as a command", () => {
    const state = fixtureState();
    const result = run(state);
    expect(result.state).toBe(state);
    expect(result.output).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(run(state, "   ").state.tick).toBe(0);
  });

  it("reports an unknown command with a stable code and exit status 127", () => {
    const result = run(fixtureState(), "sl");
    expect(text(result)).toBe("sl: command not found");
    expect(errorCodes(result)).toEqual(["UNKNOWN_COMMAND"]);
    expect(result.exitCode).toBe(127);
    expect(result.state.tick).toBe(1);
    expect(result.events).toContainEqual({
      type: "command.error",
      command: "sl",
      code: "UNKNOWN_COMMAND",
    });
  });

  it("emits command.run last for every command, with the exit code", () => {
    const result = run(fixtureState(), "ping", "-c", "1", "10.0.1.20");
    expect(result.events.at(-1)).toEqual({
      type: "command.run",
      command: "ping",
      line: "ping -c 1 10.0.1.20",
      exitCode: 0,
    });
  });

  it("quotes words with spaces in command.run lines", () => {
    const result = run(fixtureState(), "logview", "--grep", "Failed password", "/var/log/auth.log");
    expect(result.events.at(-1)).toMatchObject({
      line: "logview --grep 'Failed password' /var/log/auth.log",
    });
  });

  it("handles --help for every tool, emitting help.viewed", () => {
    for (const tool of BUILTIN_TOOLS) {
      const result = run(fixtureState(), tool.name, "--help");
      expect(result.exitCode, tool.name).toBe(0);
      expect(text(result), tool.name).toContain(tool.help.oneLiner);
      expect(text(result), tool.name).toContain("SIMULATED");
      expect(result.events[0]).toEqual({ type: "help.viewed", command: tool.name });
    }
  });

  it("treats --help after -- as an ordinary argument", () => {
    const result = run(fixtureState(), "cat", "--", "--help");
    expect(eventTypes(result)).not.toContain("help.viewed");
    expect(text(result)).toContain("No such file");
  });

  it("never mutates its input state", () => {
    const state = fixtureState();
    const before = serializeState(state);
    run(state, "ping", "-c", "3", "10.0.1.20");
    run(state, "logview", "/home/recruit/.secret-note");
    expect(serializeState(state)).toBe(before);
  });

  it("freezes returned state in development, so outside code can't mutate it", () => {
    const result = run(fixtureState(), "ping", "-c", "1", "10.0.1.20");
    const session = result.state.session as { cwd: string };
    expect(Object.isFrozen(result.state)).toBe(true);
    expect(() => {
      session.cwd = "/tmp";
    }).toThrow(TypeError);
    expect(() => (result.output as unknown[]).push("x")).toThrow(TypeError);
    // The engine keeps working from the untouched state.
    expect(run(result.state, "ping", "-c", "1", "10.0.1.20").state.session.cwd).toBe(
      "/home/recruit",
    );
  });

  it("shares every part of the state a command didn't change", () => {
    const state = fixtureState();
    const scanned = run(state, "ping", "-c", "1", "10.0.1.20").state;
    expect(scanned.machines).toBe(state.machines);
    expect(scanned.network).toBe(state.network);
    expect(scanned.discovery).not.toBe(state.discovery);
    const read = run(scanned, "logview", "/var/log/syslog").state;
    expect(read.discovery).toBe(scanned.discovery);
  });

  it("gives each command its own seeded randomness, derived from the seed and tick", () => {
    const a = run(fixtureState(1), "ping", "-c", "1", "10.0.1.20");
    const b = run(fixtureState(1), "ping", "-c", "1", "10.0.1.20");
    const c = run(fixtureState(2), "ping", "-c", "1", "10.0.1.20");
    expect(text(a)).toBe(text(b));
    expect(text(a)).not.toBe(text(c));
  });

  it("continues identically from a restored snapshot", () => {
    // Randomness comes from (seed, tick), so a state rebuilt mid-run produces the same next output.
    const first = run(fixtureState(), "ping", "-c", "1", "10.0.1.20");
    const direct = run(first.state, "ping", "-c", "2", "10.0.1.20");
    const copy = structuredClone(first.state);
    const restored = run(copy, "ping", "-c", "2", "10.0.1.20");
    expect(text(restored)).toBe(text(direct));
  });

  it("reads the clock exactly once per command", () => {
    let calls = 0;
    const now = () => {
      calls++;
      return 0;
    };
    step(fixtureState(), { type: "exec", argv: ["ping", "-c", "3", "10.0.1.20"] }, { now });
    step(fixtureState(), { type: "exec", argv: [] }, { now });
    expect(calls).toBe(2);
  });

  it("finds a flag when its token appears in any output, once", () => {
    const first = run(fixtureState(), "logview", "/home/recruit/.secret-note");
    expect(first.events).toContainEqual({ type: "flag.found", flagId: "hidden-note" });
    expect(first.state.flagsFound).toEqual(["hidden-note"]);
    const again = run(first.state, "logview", "/home/recruit/.secret-note");
    expect(eventTypes(again)).not.toContain("flag.found");
    expect(again.state.flagsFound).toEqual(["hidden-note"]);
  });

  it("passes piped input to the tool", () => {
    const result = step(
      fixtureState(),
      { type: "exec", argv: ["logview", "--grep", "ssh"], stdin: "cron ok\nsshd restarted\n" },
      testContext(),
    );
    expect(text(result)).toContain("sshd restarted");
    expect(text(result)).not.toContain("cron ok");
  });

  it("dispatches to a custom registry: a new tool is one file plus one registration", () => {
    const events: SimEvent[] = [{ type: "hash.identified", format: "demo" }];
    const echo: Tool = {
      name: "echo-sim",
      category: "text",
      help: {
        oneLiner: "repeat what you type.",
        usage: ["echo-sim <words>"],
        description: ["Repeats words."],
        concept: ["Demo."],
      },
      run: (args, state) => success(state, [stdout(args.join(" "))], events),
    };
    const registry = createRegistry([...BUILTIN_TOOLS, echo]);
    const result = step(
      fixtureState(),
      { type: "exec", argv: ["echo-sim", "hi", "there"] },
      testContext({ registry }),
    );
    expect(text(result)).toBe("hi there");
    expect(eventTypes(result)).toEqual(["hash.identified", "command.run"]);
    // The default registry is unaffected.
    expect(errorCodes(run(fixtureState(), "echo-sim"))).toEqual(["UNKNOWN_COMMAND"]);
  });
});
