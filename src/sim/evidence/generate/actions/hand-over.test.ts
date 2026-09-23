import { describe, expect, it } from "vitest";
import { hashHex } from "../../hash";
import { imageBytes } from "../../image";
import { at, play, WORKSTATION } from "../__fixtures__/case";

const BORN = at("2026-04-11T08:20:14Z");
const SIGNED = at("2026-04-12T09:30:00Z");
const PATH = "C:\\Users\\dana\\Documents\\notes.txt";

const write = {
  at: BORN,
  actor: { kind: "user", account: "dana" } as const,
  on: "qf-lt-07",
  do: "create-file" as const,
  path: PATH,
  content: "one\n",
};

const sign = {
  at: SIGNED,
  actor: { kind: "analyst" } as const,
  on: "qf-lt-07",
  do: "hand-over" as const,
  item: "qf-lt-07",
  by: "The Quillfen Freight yard office",
};

describe("hand-over", () => {
  it("puts the hashes of the image, as it stands, on the form", () => {
    const { evidence } = play([write, sign]);
    const form = evidence.handover[0];
    const disk = evidence.disks[0];

    expect(form?.item).toBe("qf-lt-07");
    expect(form?.receivedAt).toBe(SIGNED);
    expect(form?.by).toBe("The Quillfen Freight yard office");
    expect(form?.hashes?.sha256).toBe(hashHex("sha256", imageBytes(disk!)));
    expect(form?.hashes?.md5).toMatch(/^[0-9a-f]{32}$/);
  });

  it("refuses a story that changes the disk after signing for it", () => {
    expect(() =>
      play([
        write,
        sign,
        {
          at: SIGNED + 60_000,
          actor: { kind: "attacker" },
          on: "qf-lt-07",
          do: "read-file",
          path: PATH,
        },
      ]),
    ).toThrow(/changed after it was handed over/);
  });

  it("can be signed on the workstation for a machine's disk", () => {
    const { evidence } = play([write, { ...sign, on: "ir-ws-01" }], {
      machines: [
        {
          id: "qf-lt-07",
          kind: "windows-laptop",
          baseline: "office-laptop-v1",
          zone: "UTC",
          accounts: ["dana"],
        },
        WORKSTATION,
      ],
      disks: ["qf-lt-07"],
    });
    expect(evidence.handover[0]?.hashes).toBeDefined();
  });

  it("refuses to take hashes of something that has no image", () => {
    expect(() => play([{ ...sign, item: "qf-usb-09", hashes: true }])).toThrow(
      /no disk image called "qf-usb-09"/,
    );
  });
});
