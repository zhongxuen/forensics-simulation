import { describe, expect, it } from "vitest";
import { at, play, recordAt } from "../__fixtures__/case";

const WHEN = at("2026-04-11T19:44:00Z");

const insert = {
  at: WHEN,
  actor: { kind: "attacker" } as const,
  on: "qf-lt-07",
  do: "usb-insert" as const,
  device: "qf-usb-01",
};

describe("usb-insert", () => {
  it("makes the drive its own image, with its own device details", () => {
    const { evidence } = play([insert], { disks: ["qf-lt-07", "qf-usb-01"] });
    const drive = evidence.disks.find((disk) => disk.id === "qf-usb-01");

    expect(drive?.device.model).toBe("Wrenfold 32 GB memory stick");
    expect(drive?.device.serial).toMatch(/^WF-\d{4}-\d{4}$/);
    expect(recordAt(evidence, "E:\\", "qf-usb-01").kind).toBe("dir");
  });

  it("takes the letter it is given", () => {
    const { evidence } = play([{ ...insert, letter: "F" }], {
      disks: ["qf-lt-07", "qf-usb-01"],
    });
    expect(recordAt(evidence, "F:\\", "qf-usb-01").kind).toBe("dir");
  });

  it("refuses two drives on one letter, and a letter that isn't one", () => {
    expect(() =>
      play([insert, { ...insert, at: WHEN + 1000, device: "qf-usb-02" }], {
        disks: ["qf-lt-07", "qf-usb-01", "qf-usb-02"],
      }),
    ).toThrow(/drive E: is already in use/);

    expect(() => play([{ ...insert, letter: "C" }], { disks: ["qf-lt-07"] })).toThrow(
      /not a drive letter/,
    );
  });
});
