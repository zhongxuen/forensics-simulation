import { describe, expect, it } from "vitest";
import { at, logsOf, play } from "../__fixtures__/case";

const START = at("2026-04-11T19:49:00Z");

const run = {
  at: START,
  actor: { kind: "attacker" } as const,
  on: "qf-lt-07",
  do: "run-process" as const,
  name: "dispatch-sync.exe",
};

describe("connect", () => {
  it("records the connection in memory and in the monitor", () => {
    const { evidence } = play(
      [
        run,
        {
          at: START + 30_000,
          actor: { kind: "attacker" },
          on: "qf-lt-07",
          do: "connect",
          remote: "203.0.113.47:443",
        },
        { at: START + 60_000, actor: { kind: "analyst" }, on: "qf-lt-07", do: "capture-memory" },
      ],
      { memory: ["qf-lt-07"] },
    );

    const connection = evidence.memory[0]?.connections[0];
    expect(connection?.remote).toBe("203.0.113.47:443");
    expect(connection?.state).toBe("ESTABLISHED");
    expect(connection?.createdAt).toBe(START + 30_000);

    const record = logsOf(evidence, "sysmon-lite", 3)[0];
    expect(record?.fields.DestinationIp).toBe("203.0.113.47");
    expect(record?.fields.DestinationPort).toBe("443");
  });

  it("beacons at a steady interval, with only the last one still open", () => {
    const { evidence } = play(
      [
        run,
        {
          at: START + 30_000,
          actor: { kind: "attacker" },
          on: "qf-lt-07",
          do: "connect",
          remote: "203.0.113.47:443",
          every: 300,
          times: 4,
        },
        { at: START + 3_600_000, actor: { kind: "analyst" }, on: "qf-lt-07", do: "capture-memory" },
      ],
      { memory: ["qf-lt-07"] },
    );

    const connections = evidence.memory[0]?.connections ?? [];
    expect(connections).toHaveLength(4);
    const gaps = connections.slice(1).map((c, i) => c.createdAt - (connections[i]?.createdAt ?? 0));
    expect(gaps).toEqual([300_000, 300_000, 300_000]);
    expect(connections.map((c) => c.state)).toEqual([
      "CLOSE_WAIT",
      "CLOSE_WAIT",
      "CLOSE_WAIT",
      "ESTABLISHED",
    ]);
  });

  it("asks which process opened it when nothing is running", () => {
    expect(() =>
      play(
        [
          {
            at: START,
            actor: { kind: "attacker" },
            on: "ir-ws-01",
            do: "connect",
            remote: "203.0.113.47:443",
            process: "ghost",
          },
        ],
        {
          machines: [
            {
              id: "ir-ws-01",
              kind: "linux-workstation",
              baseline: "analyst-workstation-v1",
              zone: "UTC",
            },
          ],
          disks: [],
        },
      ),
    ).toThrow(/no process called "ghost"/);
  });
});
