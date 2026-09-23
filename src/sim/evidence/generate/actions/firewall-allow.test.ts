import { describe, expect, it } from "vitest";
import { at, oneLog, play } from "../__fixtures__/case";

const WHEN = at("2026-04-11T19:50:00Z");

describe("firewall-allow", () => {
  it("writes the verdict, the addresses and the ports", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "system" },
        on: "qf-lt-07",
        do: "firewall-allow",
        dst: "203.0.113.47",
        dpt: "443",
        bytes: "1840",
        rule: "outbound-web",
      },
    ]);

    const record = oneLog(evidence, "firewall");
    expect(record.fields.action).toBe("allow");
    expect(record.fields.src).toBe("10.60.0.27");
    expect(record.fields.dst).toBe("203.0.113.47");
    expect(record.fields.dpt).toBe("443");
    expect(record.fields.proto).toBe("tcp");
    expect(record.fields.rule).toBe("outbound-web");
  });
});
