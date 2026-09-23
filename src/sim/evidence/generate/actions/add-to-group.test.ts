import { describe, expect, it } from "vitest";
import { at, oneLog, play } from "../__fixtures__/case";

const WHEN = at("2026-04-11T20:03:00Z");

describe("add-to-group", () => {
  it("records the account, the group and a SID that is the same every time", () => {
    const story = [
      {
        at: WHEN,
        actor: { kind: "attacker" } as const,
        on: "qf-lt-07",
        do: "add-to-group" as const,
        account: "dana",
        group: "Administrators",
        by: "Administrator",
      },
    ];
    const first = play(story).evidence;
    const second = play(story).evidence;

    const record = oneLog(first, "security", 4732);
    expect(record.fields.TargetUserName).toBe("Administrators");
    expect(record.fields.MemberName).toBe("QF-LT-07\\dana");
    expect(record.fields.MemberSid).toMatch(/^S-1-5-21-\d+-\d+-\d+-\d+$/);
    expect(oneLog(second, "security", 4732).fields.MemberSid).toBe(record.fields.MemberSid);
  });

  it("refuses a group for an account that isn't there", () => {
    expect(() =>
      play([
        {
          at: WHEN,
          actor: { kind: "attacker" },
          on: "qf-lt-07",
          do: "add-to-group",
          account: "ghost",
          group: "Administrators",
        },
      ]),
    ).toThrow(/no account called "ghost"/);
  });
});
