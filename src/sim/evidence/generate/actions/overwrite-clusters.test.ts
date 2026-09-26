import { describe, expect, it } from "vitest";
import { decodeBase64 } from "../../base64";
import { carveBytes } from "../../magic";
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

  describe("with keep", () => {
    // Two clusters' worth of PDF: a header, then enough rows to run past one 4096-byte cluster.
    const PDF = "C:\\Users\\dana\\Documents\\inv-0398.pdf";
    const ZIP = "C:\\Users\\dana\\Documents\\price-lists.zip";
    const rows = Array.from({ length: 320 }, (_, i) => `run ${String(i).padStart(3, "0")} 120.00`);
    const pdf = `%PDF-1.4\nInvoice 0398\n${rows.join("\n")}\ntotal 38400.00\n%%EOF\n`;
    const partly = (keep: number) =>
      play([
        { ...written, path: PDF, content: pdf },
        { ...deleted, path: PDF },
        {
          at: OVER,
          actor: { kind: "attacker" } as const,
          on: "qf-lt-07",
          do: "overwrite-clusters" as const,
          path: PDF,
          by: ZIP,
          content: "PK\u0003\u0004zip",
          keep,
        },
      ]).evidence;

    it("takes only the clusters after the first `keep`", () => {
      const evidence = partly(1);
      const [gone] = recordsAt(evidence, PDF);
      const [taken] = recordsAt(evidence, ZIP);
      expect(gone?.clusters).toHaveLength(2);
      expect(taken?.clusters).toEqual(gone?.clusters.slice(1));
    });

    it("leaves the start in unallocated space, so a carver finds a header and no end", () => {
      const bytes = decodeBase64(partly(1).disks[0]?.unallocatedB64 ?? "");
      const [object] = carveBytes(bytes, ["pdf"]);
      expect(object?.complete).toBe(false);
      const text = new TextDecoder().decode(object?.bytes);
      expect(text).toContain("Invoice 0398");
      expect(text).not.toContain("total 38400.00");
      expect(new TextDecoder().decode(bytes)).not.toContain("PK\u0003\u0004zip");
    });

    it("refuses to keep every cluster the file has", () => {
      expect(() => partly(2)).toThrow(/leaves nothing to write over/);
    });
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
