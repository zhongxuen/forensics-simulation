import { describe, expect, it } from "vitest";
import { base64ByteLength } from "../../base64";
import { at, oneLog, play, recordsAt, tracedBy } from "../__fixtures__/case";

const BORN = at("2026-04-11T08:20:14Z");
const GONE = at("2026-04-11T19:42:03Z");
const PATH = "C:\\Users\\dana\\Documents\\inv-0412.txt";

const story = [
  {
    at: BORN,
    actor: { kind: "user", account: "dana" } as const,
    on: "qf-lt-07",
    do: "create-file" as const,
    path: PATH,
    content: "Invoice 0412: 12 pallets\n",
  },
  {
    id: "deleted",
    at: GONE,
    actor: { kind: "attacker" } as const,
    on: "qf-lt-07",
    do: "delete-file" as const,
    path: PATH,
  },
];

describe("delete-file", () => {
  it("keeps the record and its clusters, and moves only the changed time", () => {
    const { evidence } = play(story);
    const [file] = recordsAt(evidence, PATH);

    expect(file?.deleted).toBe(true);
    expect(file?.times).toEqual({ m: BORN, a: BORN, c: GONE, b: BORN });
    expect(file?.clusters.length).toBeGreaterThan(0);
    expect(file?.size).toBe("Invoice 0412: 12 pallets\n".length);
  });

  it("leaves a copy of the bytes in unallocated space, and records the deletion", () => {
    const result = play(story);
    const disk = result.evidence.disks[0];

    expect(base64ByteLength(disk?.unallocatedB64 ?? "")).toBe("Invoice 0412: 12 pallets\n".length);
    expect(oneLog(result.evidence, "sysmon-lite", 23).fields.TargetFilename).toBe(PATH);
    expect(tracedBy(result, "deleted")).toContain("disk:qf-lt-07:carve/0");
  });

  it("refuses to delete something that isn't there", () => {
    expect(() =>
      play([
        {
          at: GONE,
          actor: { kind: "attacker" },
          on: "qf-lt-07",
          do: "delete-file",
          path: "C:\\Users\\dana\\Documents\\nothing.txt",
        },
      ]),
    ).toThrow(/no file at/);
  });
});
