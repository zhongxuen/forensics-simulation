import { describe, expect, it } from "vitest";
import { at, logsOf, oneLog, play } from "../__fixtures__/case";

const WHEN = at("2026-04-11T19:50:00Z");

describe("firewall-block", () => {
  it("writes the same line as an allow, with the other verdict", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "system" },
        on: "qf-lt-07",
        do: "firewall-block",
        dst: "203.0.113.47",
        dpt: "8443",
        proto: "udp",
      },
    ]);

    const record = oneLog(evidence, "firewall");
    expect(record.fields.action).toBe("block");
    expect(record.fields.proto).toBe("udp");
    expect(record.fields.dpt).toBe("8443");
  });

  it("keeps a run of attempts in the order they happened", () => {
    const { evidence } = play(
      [0, 1, 2].map((minute) => ({
        at: WHEN + minute * 60_000,
        actor: { kind: "system" } as const,
        on: "qf-lt-07",
        do: "firewall-block" as const,
        dst: "203.0.113.47",
        dpt: String(8000 + minute),
      })),
    );
    expect(logsOf(evidence, "firewall").map((record) => record.fields.dpt)).toEqual([
      "8000",
      "8001",
      "8002",
    ]);
  });
});
