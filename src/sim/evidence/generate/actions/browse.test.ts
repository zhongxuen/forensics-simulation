import { describe, expect, it } from "vitest";
import { decodeBase64 } from "../../base64";
import { at, oneLog, play, recordAt } from "../__fixtures__/case";

// British Summer Time in April, so the machine writes 20:40 for 19:40 UTC.
const WHEN = at("2026-04-11T19:40:00Z");
const HISTORY = "C:\\Users\\dana\\AppData\\Local\\Web\\history.log";

describe("browse", () => {
  it("writes the machine's own local time into the history, and looks the name up", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "browse",
        url: "https://updates.example/notes",
      },
    ]);

    const history = new TextDecoder().decode(decodeBase64(recordAt(evidence, HISTORY).contentB64));
    expect(history).toContain("2026-04-11 20:40:00 +01:00 https://updates.example/notes");

    const lookup = oneLog(evidence, "dns");
    expect(lookup.fields.query).toBe("updates.example");
    expect(lookup.fields.client).toBe("10.60.0.27");
  });

  it("takes the account from the action when the actor isn't a person", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "attacker" },
        on: "qf-lt-07",
        do: "browse",
        url: "https://updates.example/",
        account: "dana",
      },
    ]);
    expect(recordAt(evidence, HISTORY).owner).toBe("dana");
  });

  it("asks who was browsing when nothing says", () => {
    expect(() =>
      play([
        {
          at: WHEN,
          actor: { kind: "attacker" },
          on: "qf-lt-07",
          do: "browse",
          url: "https://updates.example/",
        },
      ]),
    ).toThrow(/say which account was browsing/);
  });
});
