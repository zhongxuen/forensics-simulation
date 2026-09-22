import { describe, expect, it } from "vitest";
import { GOLDEN_RUN } from "../__fixtures__/golden-run";
import { fixtureState, run } from "../__fixtures__/harness";
import { FIXTURE_SCENARIO } from "../__fixtures__/scenario";
import { createRun, appendCommand, deserializeRun, replay, serializeRun } from "./replay";
import { deserializeState, serializeState } from "./serialize";
import { stableStringify } from "./stable-json";

const scenarios = { [FIXTURE_SCENARIO.id]: FIXTURE_SCENARIO };

/** Walks into parsed JSON: dig(state, "machines", "ws-01") is state.machines["ws-01"]. */
function dig(value: unknown, ...keys: string[]): Record<string, unknown> {
  return keys.reduce<Record<string, unknown>>(
    (node, key) => node[key] as Record<string, unknown>,
    value as Record<string, unknown>,
  );
}

const wsRoot = (s: Record<string, unknown>) => dig(s, "machines", "ws-01", "fs", "root");

/** A snapshot with one field changed, to check validation. */
function tampered(edit: (state: Record<string, unknown>) => void): string {
  const envelope = JSON.parse(serializeState(fixtureState())) as { state: Record<string, unknown> };
  edit(envelope.state);
  return JSON.stringify(envelope);
}

describe("stableStringify", () => {
  it("sorts keys, so creation order doesn't change the bytes", () => {
    expect(stableStringify({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}',
    );
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it("drops undefined properties like JSON.stringify, and indents on request", () => {
    expect(stableStringify({ a: undefined, b: [undefined] })).toBe('{"b":[null]}');
    expect(stableStringify({ a: [1] }, 2)).toBe('{\n  "a": [\n    1\n  ]\n}');
  });

  it("refuses values JSON can't hold", () => {
    expect(() => stableStringify({ a: Number.NaN })).toThrow(TypeError);
    expect(() => stableStringify({ a: () => 1 })).toThrow(TypeError);
  });
});

describe("serializeState / deserializeState", () => {
  it("round-trips byte for byte", () => {
    const state = run(
      run(fixtureState(), "ping", "-c", "2", "10.0.1.20").state,
      "logview",
      "/home/recruit/.secret-note",
    ).state;
    const text = serializeState(state);
    const back = deserializeState(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(serializeState(back.value)).toBe(text);
    expect(back.value).toEqual(state);
  });

  it("carries a format name and version", () => {
    const envelope = JSON.parse(serializeState(fixtureState())) as Record<string, unknown>;
    expect(envelope.format).toBe("hacker-sim/state");
    expect(envelope.version).toBe(1);
  });

  it("returns a frozen state the engine can keep running", () => {
    const back = deserializeState(serializeState(fixtureState()));
    if (!back.ok) throw new Error(back.error.reason);
    expect(Object.isFrozen(back.value.session)).toBe(true);
    expect(run(back.value, "ping", "-c", "1", "10.0.1.20").exitCode).toBe(0);
  });

  it.each([
    ["not JSON", "{nope", "not valid JSON"],
    ["a JSON array", "[]", "not a JSON object"],
    ["another format", JSON.stringify({ format: "other", version: 1 }), "format"],
    [
      "a future version",
      JSON.stringify({ format: "hacker-sim/state", version: 2, state: {} }),
      "version 2",
    ],
  ])("rejects %s", (_, text, reason) => {
    const result = deserializeState(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BAD_SNAPSHOT");
      expect(result.error.reason).toContain(reason);
    }
  });

  it.each<[string, (state: Record<string, unknown>) => void, string]>([
    ["a missing field", (s) => delete s.tick, "state.tick"],
    ["a wrong type", (s) => (s.seed = "42"), "state.seed"],
    ["a bad file mode", (s) => (wsRoot(s).mode = 99_999), ".mode"],
    ["an unknown node kind", (s) => (dig(wsRoot(s), "children", "tmp").kind = "socket"), ".kind"],
    [
      "a file name with a slash",
      (s) =>
        (dig(wsRoot(s), "children")["a/b"] = {
          kind: "file",
          owner: "root",
          group: "root",
          mode: 420,
          mtime: 0,
          content: "",
        }),
      "a valid file name",
    ],
    [
      "a session on a missing host",
      (s) => (dig(s, "session").hostId = "nowhere"),
      "state.session.hostId",
    ],
    [
      "a session user who doesn't exist",
      (s) => (dig(s, "session").user = "mallory"),
      "state.session.user",
    ],
    [
      "a non-canonical cwd",
      (s) => (dig(s, "session").cwd = "/home/recruit/../recruit"),
      "state.session.cwd",
    ],
    [
      "a host keyed under the wrong id",
      (s) => (dig(s, "network", "hosts", "web-01").id = "db-01"),
      ".id",
    ],
  ])("rejects a snapshot with %s", (_, edit, where) => {
    const result = deserializeState(tampered(edit));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toContain(where);
  });

  it("rejects a hostile, absurdly deep tree without crashing", () => {
    // Built as text, the way a hostile blob would arrive: too deep for a recursive walker.
    const depth = 20_000;
    const open =
      '{"kind":"dir","owner":"root","group":"root","mode":493,"mtime":0,"children":{"d":';
    const deep = `${open.repeat(depth)}{"kind":"file","owner":"root","group":"root","mode":420,"mtime":0,"content":""}${"}}".repeat(depth)}`;
    const text = tampered((s) => (dig(wsRoot(s), "children").deep = "__DEEP__")).replace(
      '"__DEEP__"',
      deep,
    );
    const result = deserializeState(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toContain("levels deep");
  });

  it("stores a file named __proto__ as a plain name", () => {
    const text = tampered((s) => {
      dig(wsRoot(s), "children", "tmp").children = JSON.parse(
        '{"__proto__":{"kind":"file","owner":"root","group":"root","mode":420,"mtime":0,"content":"x"}}',
      );
    });
    const result = deserializeState(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tmp = result.value.machines["ws-01"]?.fs.root.children.tmp;
    expect(tmp?.kind === "dir" && Object.hasOwn(tmp.children, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });
});

describe("runs", () => {
  it("round-trips through JSON", () => {
    const text = serializeRun(GOLDEN_RUN);
    const back = deserializeRun(text);
    expect(back).toEqual({ ok: true, value: GOLDEN_RUN });
    expect(JSON.parse(text)).toMatchObject({ format: "hacker-sim/run", version: 1 });
  });

  it("builds up one command at a time", () => {
    const empty = createRun(FIXTURE_SCENARIO.id, 7);
    const one = appendCommand(empty, { type: "exec", argv: ["sl"] });
    expect(empty.commands).toEqual([]);
    expect(one.commands).toEqual([{ type: "exec", argv: ["sl"] }]);
  });

  it.each([
    ["a negative seed", { seed: -1, scenarioId: "x", commands: [] }],
    ["a missing scenario id", { seed: 1, commands: [] }],
    [
      "a command that isn't exec",
      { seed: 1, scenarioId: "x", commands: [{ type: "eval", argv: [] }] },
    ],
    ["non-string arguments", { seed: 1, scenarioId: "x", commands: [{ type: "exec", argv: [1] }] }],
  ])("rejects a run with %s", (_, body) => {
    expect(
      deserializeRun(JSON.stringify({ format: "hacker-sim/run", version: 1, ...body })).ok,
    ).toBe(false);
  });

  it("replays to the same final state as stepping by hand", () => {
    const replayed = replay(GOLDEN_RUN, scenarios);
    expect(replayed.steps).toHaveLength(GOLDEN_RUN.commands.length);
    expect(replayed.output).toEqual(replayed.steps.flatMap((s) => s.output));
    expect(replayed.state.flagsFound).toEqual(["hidden-note"]);
  });

  it("accepts a lookup function and refuses an unknown scenario", () => {
    expect(
      replay(GOLDEN_RUN, (id) => (id === FIXTURE_SCENARIO.id ? FIXTURE_SCENARIO : undefined)).steps,
    ).toHaveLength(GOLDEN_RUN.commands.length);
    expect(() => replay({ ...GOLDEN_RUN, scenarioId: "nope" }, scenarios)).toThrow(
      /no scenario "nope"/,
    );
  });
});
