import { describe, expect, it } from "vitest";
import { at, oneLog, play } from "../__fixtures__/case";

const WHEN = at("2026-04-11T19:40:12Z");

describe("logon", () => {
  it("records who signed in, how, and from where", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "attacker" },
        on: "qf-lt-07",
        do: "logon",
        account: "dana",
        type: "remote",
        from: "10.60.0.21",
      },
    ]);

    const record = oneLog(evidence, "security", 4624);
    expect(record.at).toBe(WHEN);
    expect(record.host).toBe("qf-lt-07");
    expect(record.fields.TargetUserName).toBe("dana");
    expect(record.fields.LogonType).toBe("10");
    expect(record.fields.IpAddress).toBe("10.60.0.21");
    expect(record.fields.TargetLogonId).toMatch(/^0x[0-9a-f]+$/);
  });

  it("leaves no address on a sign-in at the keyboard", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "logon",
        account: "dana",
        type: "interactive",
      },
    ]);
    const record = oneLog(evidence, "security", 4624);
    expect(record.fields.LogonType).toBe("2");
    expect(record.fields.IpAddress).toBe("-");
    expect(record.fields.IpPort).toBe("-");
  });

  it("adds the privileges record for an elevated session", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "logon",
        account: "dana",
        type: "interactive",
        elevated: true,
      },
    ]);
    expect(oneLog(evidence, "security", 4672).fields.SubjectUserName).toBe("dana");
  });

  it("refuses an account the machine doesn't have, and says which it does", () => {
    expect(() =>
      play([
        {
          at: WHEN,
          actor: { kind: "attacker" },
          on: "qf-lt-07",
          do: "logon",
          account: "nobody",
          type: "remote",
          from: "10.60.0.21",
        },
      ]),
    ).toThrow(/no account called "nobody" on qf-lt-07/);
  });
});
