import { describe, expect, it } from "vitest";
import { at, oneLog, play, recordAt } from "../__fixtures__/case";

const WHEN = at("2026-04-11T20:02:00Z");

describe("create-account", () => {
  it("records the new account and gives it a home folder", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "attacker" },
        on: "qf-lt-07",
        do: "create-account",
        account: "svc-update",
        by: "dana",
      },
    ]);

    const record = oneLog(evidence, "security", 4720);
    expect(record.fields.TargetUserName).toBe("svc-update");
    expect(record.fields.SubjectUserName).toBe("dana");
    expect(recordAt(evidence, "C:\\Users\\svc-update").kind).toBe("dir");
  });

  it("lets the new account sign in afterwards", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "attacker" },
        on: "qf-lt-07",
        do: "create-account",
        account: "svc-update",
      },
      {
        at: WHEN + 60_000,
        actor: { kind: "attacker" },
        on: "qf-lt-07",
        do: "logon",
        account: "svc-update",
        type: "remote",
        from: "10.60.0.21",
      },
    ]);
    expect(oneLog(evidence, "security", 4624).fields.TargetUserName).toBe("svc-update");
  });

  it("refuses to make an account that is already there", () => {
    expect(() =>
      play([
        {
          at: WHEN,
          actor: { kind: "attacker" },
          on: "qf-lt-07",
          do: "create-account",
          account: "dana",
        },
      ]),
    ).toThrow(/already an account called "dana"/);
  });
});
