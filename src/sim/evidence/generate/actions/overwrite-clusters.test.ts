import { describe, expect, it } from "vitest";
import { decodeBase64 } from "../../base64";
import { at, play, recordsAt } from "../__fixtures__/case";

const BORN = at("2026-04-11T08:20:14Z");
const GONE = at("2026-04-11T19:42:03Z");
const OVER = at("2026-04-12T02:00:00Z");
const PATH = "C:\\Users\\dana\\Documents\\inv-0412.txt";

const written = {
  at: BORN,
  actor: { kind: "user", account: "dana" } as const,
  on: "qf-lt-07",
  do: "create-file" as const,
  path: PATH,
  content: "Invoice 0412\n",
};

const deleted = {
  at: GONE,
  actor: { kind: "attacker" } as const,
  on: "qf-lt-07",
  do: "delete-file" as const,
  path: PATH,
};

const story = [written, deleted];

describe("overwrite-clusters", () => {
  it("hands the deleted file's clusters to another file", () => {
    const { evidence } = play([
      ...story,
      {
        at: OVER,
        actor: { kind: "system" },
        on: "qf-lt-07",
        do: "overwrite-clusters",
        path: PATH,
        by: "C:\\Users\\Public\\Downloads\\cache.bin",
        content: "zzzzzzzzzzzz\n",
      },
    ]);

    const [deleted] = recordsAt(evidence, PATH);
    const [taken] = recordsAt(evidence, "C:\\Users\\Public\\Downloads\\cache.bin");
    expect(deleted?.deleted).toBe(true);
    expect(taken?.clusters).toEqual(deleted?.clusters);
  });

  it("writes over the copy in unallocated space too, so carving finds nothing", () => {
    const before = play(story).evidence.disks[0];
    const after = play([
      ...story,
      {
        at: OVER,
        actor: { kind: "system" },
        on: "qf-lt-07",
        do: "overwrite-clusters",
        path: PATH,
        content: "z",
      },
    ]).evidence.disks[0];

    const text = (b64: string) => new TextDecoder().decode(decodeBase64(b64));
    expect(text(before?.unallocatedB64 ?? "")).toContain("Invoice 0412");
    expect(text(after?.unallocatedB64 ?? "")).not.toContain("Invoice 0412");
  });

  it("refuses when nothing deleted is at that path", () => {
    expect(() =>
      play([
        written,
        {
          at: OVER,
          actor: { kind: "system" },
          on: "qf-lt-07",
          do: "overwrite-clusters",
          path: PATH,
        },
      ]),
    ).toThrow(/nothing deleted is at/);
  });
});
