import { describe, expect, it } from "vitest";
import { at, oneLog, play } from "../__fixtures__/case";

const WHEN = at("2026-04-11T19:31:00Z");

describe("failed-logon", () => {
  it("says the password was wrong for an account that exists", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "attacker" },
        on: "qf-lt-07",
        do: "failed-logon",
        account: "dana",
        type: "remote",
        from: "203.0.113.47",
      },
    ]);
    const record = oneLog(evidence, "security", 4625);
    expect(record.fields.SubStatus).toBe("0xC000006A");
    expect(record.fields.FailureReason).toBe("The password was not correct.");
    expect(record.fields.IpAddress).toBe("203.0.113.47");
  });

  it("says there is no such account for a name nobody has, without needing one", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "attacker" },
        on: "qf-lt-07",
        do: "failed-logon",
        account: "admin1",
        type: "remote",
        from: "203.0.113.47",
      },
    ]);
    const record = oneLog(evidence, "security", 4625);
    expect(record.fields.SubStatus).toBe("0xC0000064");
    expect(record.fields.TargetUserName).toBe("admin1");
  });
});
