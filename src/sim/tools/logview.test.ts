import { describe, expect, it } from "vitest";
import { errorCodes, fixtureState, run, testContext, text } from "../__fixtures__/harness";
import { step } from "../core/step";
import { lineLevel } from "./logview";

describe("logview", () => {
  it("lists /var/log with what the learner may read", () => {
    const result = run(fixtureState(), "logview");
    expect(text(result)).toMatch(/auth\.log\s+6 lines\s+readable/);
    expect(text(result)).toMatch(/private\.log\s+-\s+no permission \(owner root, group root\)/);
    expect(result.events.map((e) => e.type)).toEqual(["command.run"]);
  });

  it("lists any folder it's given", () => {
    expect(text(run(fixtureState(), "logview", "/tmp"))).toMatch(/files in \/tmp/);
  });

  it("filters by text, case-insensitively, keeping line numbers", () => {
    const result = run(fixtureState(), "logview", "/var/log/auth.log", "-g", "FAILED");
    expect(text(result)).toContain('3 of 6 lines containing "FAILED"');
    expect(text(result)).toMatch(/^2 {2}2026-03-01T23:02:44Z WARN/m);
    expect(result.events).toContainEqual({
      type: "file.read",
      hostId: "ws-01",
      path: "/var/log/auth.log",
    });
    expect(result.events).toContainEqual({
      type: "log.queried",
      hostId: "ws-01",
      path: "/var/log/auth.log",
      matched: 3,
    });
  });

  it("filters by level, accepting common spellings", () => {
    expect(text(run(fixtureState(), "logview", "/var/log/syslog", "--level", "ERR"))).toContain(
      "could not reach db-01",
    );
    expect(text(run(fixtureState(), "logview", "/var/log/syslog", "--level", "warning"))).toContain(
      "1 of 4 lines at level warn",
    );
  });

  it("combines filters, and can show only the last matches or a count", () => {
    const last = run(
      fixtureState(),
      "logview",
      "/var/log/auth.log",
      "--grep",
      "failed",
      "--last",
      "1",
    );
    expect(text(last)).toContain("for admin");
    expect(text(last)).not.toContain("40112");
    const count = run(fixtureState(), "logview", "/var/log/auth.log", "--level", "info", "-c");
    expect(text(count)).toBe(
      "logview (simulated) · /var/log/auth.log · 2 of 6 lines at level info",
    );
  });

  it("follows symlinks and reports the real path", () => {
    expect(text(run(fixtureState(), "logview", "logs/syslog"))).toContain(
      "/var/log/syslog · 4 lines",
    );
  });

  it("reads piped input when no file is given", () => {
    const result = step(
      fixtureState(),
      { type: "exec", argv: ["logview", "-g", "b"], stdin: "a\nb\nab\n" },
      testContext(),
    );
    expect(text(result)).toContain("(piped input) · 2 of 3 lines");
  });

  it.each([
    ["/var/log/private.log", "EACCES"],
    ["/etc/shadow", "EACCES"],
    ["/home/alex/todo.txt", "EACCES"],
    ["/tmp/loop-a", "ELOOP"],
    ["/var/log/missing.log", "ENOENT"],
    ["notes.txt/x", "ENOTDIR"],
  ])("%s fails with %s", (path, code) => {
    expect(errorCodes(run(fixtureState(), "logview", path))).toEqual([code]);
  });

  it.each([
    [["logview", "/var/log/syslog", "--level", "loud"], "BAD_ARGUMENT"],
    [["logview", "/var/log/syslog", "--last", "0"], "BAD_ARGUMENT"],
    [["logview", "/var/log/syslog", "--last", "-3"], "MISSING_ARGUMENT"],
    [["logview", "a", "b"], "BAD_ARGUMENT"],
    [["logview", "--tail"], "BAD_FLAG"],
  ])("%j fails with %s", (argv, code) => {
    expect(errorCodes(run(fixtureState(), ...argv))).toEqual([code]);
  });

  it("reads the level from the first few words", () => {
    expect(lineLevel("2026-03-01T22:14:03Z INFO sshd: ok")).toBe("info");
    expect(lineLevel("[ERROR] disk full")).toBe("error");
    expect(lineLevel("2026-03-02 09:00:01 warning: disk almost full")).toBe("warn");
    expect(lineLevel("nothing to see here, error later")).toBeUndefined();
    expect(lineLevel("constructor toString")).toBeUndefined();
  });
});
