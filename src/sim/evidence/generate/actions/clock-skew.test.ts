import { describe, expect, it } from "vitest";
import { at, oneLog, play, recordAt } from "../__fixtures__/case";

const SET = at("2026-04-11T06:00:00Z");
const WHEN = at("2026-04-11T19:40:12Z");
const PATH = "C:\\Users\\dana\\Documents\\notes.txt";

describe("clock-skew", () => {
  it("makes the machine write the time it believes it is, not the real one", () => {
    const { evidence, trace } = play([
      { at: SET, actor: { kind: "system" }, on: "qf-lt-07", do: "clock-skew", minutes: 43 },
      {
        id: "signed-in",
        at: WHEN,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "logon",
        account: "dana",
        type: "interactive",
      },
      {
        at: WHEN,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "create-file",
        path: PATH,
      },
    ]);

    const skewed = WHEN + 43 * 60_000;
    expect(oneLog(evidence, "security", 4624).at).toBe(skewed);
    expect(recordAt(evidence, PATH).times.b).toBe(skewed);

    // The story still knows when it really happened, which is what a timeline has to line up.
    const entry = trace.find((item) => item.id === "signed-in");
    expect(entry?.at).toBe(WHEN);
    expect(entry?.artefacts[0]?.at).toBe(skewed);
  });

  it("puts a clock behind as easily as ahead", () => {
    const { evidence } = play([
      { at: SET, actor: { kind: "system" }, on: "qf-lt-07", do: "clock-skew", minutes: -15 },
      {
        at: WHEN,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "logon",
        account: "dana",
        type: "interactive",
      },
    ]);
    expect(oneLog(evidence, "security", 4624).at).toBe(WHEN - 15 * 60_000);
  });
});
