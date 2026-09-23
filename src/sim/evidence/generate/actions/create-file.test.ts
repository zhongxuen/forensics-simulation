import { describe, expect, it } from "vitest";
import { at, oneLog, play, recordAt } from "../__fixtures__/case";

const WHEN = at("2026-04-11T08:20:14Z");
const PATH = "C:\\Users\\dana\\Documents\\Invoices\\inv-0412.txt";

describe("create-file", () => {
  it("gives a new file the same time for all four of its MACB times", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "create-file",
        path: PATH,
        content: "Invoice 0412\n",
      },
    ]);

    const file = recordAt(evidence, PATH);
    expect(file.times).toEqual({ m: WHEN, a: WHEN, c: WHEN, b: WHEN });
    expect(file.size).toBe("Invoice 0412\n".length);
    expect(file.owner).toBe("dana");
    expect(file.deleted).toBe(false);
    expect(file.clusters.length).toBeGreaterThan(0);
  });

  it("makes the folders above it, and records the write", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "create-file",
        path: PATH,
      },
    ]);

    expect(recordAt(evidence, "C:\\Users\\dana\\Documents\\Invoices").kind).toBe("dir");
    expect(oneLog(evidence, "sysmon-lite", 11).fields.TargetFilename).toBe(PATH);
  });

  it("refuses a file on a machine that is never imaged", () => {
    expect(() =>
      play(
        [
          {
            at: WHEN,
            actor: { kind: "analyst" },
            on: "ir-ws-01",
            do: "create-file",
            path: PATH,
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
    ).toThrow(/never imaged/);
  });
});
