import { describe, expect, it } from "vitest";
import { at, oneLog, play, SERVER } from "../__fixtures__/case";

const WHEN = at("2026-04-11T19:38:00Z");

describe("web-request", () => {
  it("writes one line with who asked, what for, and what came back", () => {
    const { evidence } = play(
      [
        {
          at: WHEN,
          actor: { kind: "attacker" },
          on: "qf-srv-01",
          do: "web-request",
          path: "/dockets/4471",
          method: "POST",
          status: "403",
          clientIp: "203.0.113.47",
          bytes: "512",
          userAgent: "a tool nobody at the yard uses",
        },
      ],
      { machines: [SERVER] },
    );

    const record = oneLog(evidence, "web-access");
    expect(record.host).toBe("qf-srv-01");
    expect(record.fields).toMatchObject({
      clientIp: "203.0.113.47",
      method: "POST",
      path: "/dockets/4471",
      status: "403",
      bytes: "512",
    });
  });

  it("fills in the ordinary answers when a story doesn't care", () => {
    const { evidence } = play(
      [{ at: WHEN, actor: { kind: "system" }, on: "qf-srv-01", do: "web-request", path: "/" }],
      { machines: [SERVER] },
    );
    expect(oneLog(evidence, "web-access").fields).toMatchObject({ method: "GET", status: "200" });
  });
});
