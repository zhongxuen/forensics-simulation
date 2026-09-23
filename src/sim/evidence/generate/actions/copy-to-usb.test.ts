import { describe, expect, it } from "vitest";
import { decodeBase64 } from "../../base64";
import { at, logsOf, play, recordAt } from "../__fixtures__/case";

const BORN = at("2026-04-11T08:20:14Z");
const COPIED = at("2026-04-11T19:46:00Z");
const PATH = "C:\\Users\\dana\\Documents\\inv-0412.txt";

const written = {
  at: BORN,
  actor: { kind: "user", account: "dana" } as const,
  on: "qf-lt-07",
  do: "create-file" as const,
  path: PATH,
  content: "Invoice 0412\n",
};

const plugged = {
  at: COPIED - 60_000,
  actor: { kind: "attacker" } as const,
  on: "qf-lt-07",
  do: "usb-insert" as const,
  device: "qf-usb-01",
};

const copied = {
  at: COPIED,
  actor: { kind: "attacker" } as const,
  on: "qf-lt-07",
  do: "copy-to-usb" as const,
  path: PATH,
};

const story = [written, plugged, copied];

const options = { disks: ["qf-lt-07", "qf-usb-01"] };

describe("copy-to-usb", () => {
  it("writes a new file on the drive and moves the original's accessed time", () => {
    const { evidence } = play(story, options);

    const copy = recordAt(evidence, "E:\\inv-0412.txt", "qf-usb-01");
    expect(copy.times).toEqual({ m: COPIED, a: COPIED, c: COPIED, b: COPIED });
    expect(new TextDecoder().decode(decodeBase64(copy.contentB64))).toBe("Invoice 0412\n");

    const original = recordAt(evidence, PATH);
    expect(original.times).toEqual({ m: BORN, a: COPIED, c: BORN, b: BORN });
    // The first file-created record is the story's own; the second is the copy on the drive.
    const written = logsOf(evidence, "sysmon-lite", 11);
    expect(written.map((record) => record.fields.TargetFilename)).toEqual([
      PATH,
      "E:\\inv-0412.txt",
    ]);
  });

  it("refuses a copy with no drive plugged in", () => {
    expect(() => play([written, copied], options)).toThrow(/no removable drive/);
  });
});
