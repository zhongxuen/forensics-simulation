import { describe, expect, it } from "vitest";
import { at, logsOf, oneLog, play } from "../__fixtures__/case";

const IN = at("2026-04-11T19:40:12Z");
const OUT = at("2026-04-11T19:52:40Z");

describe("logoff", () => {
  it("carries the same logon id as the sign-in that started the session", () => {
    const { evidence } = play([
      {
        at: IN,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "logon",
        account: "dana",
        type: "interactive",
      },
      {
        at: OUT,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "logoff",
        account: "dana",
      },
    ]);

    const on = oneLog(evidence, "security", 4624);
    const off = oneLog(evidence, "security", 4634);
    expect(off.fields.TargetLogonId).toBe(on.fields.TargetLogonId);
    expect(off.fields.LogonType).toBe("2");
    expect(off.at).toBe(OUT);
  });

  it("gives the next session a new logon id", () => {
    const { evidence } = play([
      {
        at: IN,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "logon",
        account: "dana",
        type: "interactive",
      },
      {
        at: OUT,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "logoff",
        account: "dana",
      },
      {
        at: OUT + 60_000,
        actor: { kind: "attacker" },
        on: "qf-lt-07",
        do: "logon",
        account: "dana",
        type: "remote",
        from: "10.60.0.21",
      },
    ]);
    const [first, second] = logsOf(evidence, "security", 4624);
    expect(first?.fields.TargetLogonId).not.toBe(second?.fields.TargetLogonId);
  });
});
