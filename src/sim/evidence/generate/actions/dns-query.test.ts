import { describe, expect, it } from "vitest";
import { at, oneLog, play } from "../__fixtures__/case";

const WHEN = at("2026-04-11T19:39:00Z");

describe("dns-query", () => {
  it("records an answer when there is one", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "system" },
        on: "qf-lt-07",
        do: "dns-query",
        query: "cdn-sync.example",
        answer: "203.0.113.47",
      },
    ]);

    const record = oneLog(evidence, "dns");
    expect(record.fields.query).toBe("cdn-sync.example");
    expect(record.fields.rcode).toBe("NOERROR");
    expect(record.fields.answer).toBe("203.0.113.47");
    expect(record.fields.client).toBe("10.60.0.27");
  });

  it("records a name that answered with nothing", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "system" },
        on: "qf-lt-07",
        do: "dns-query",
        query: "gone.example",
      },
    ]);
    const record = oneLog(evidence, "dns");
    expect(record.fields.rcode).toBe("NXDOMAIN");
    expect(record.fields.answer).toBeUndefined();
  });
});
