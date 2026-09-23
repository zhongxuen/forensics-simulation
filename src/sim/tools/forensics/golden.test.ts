/**
 * The disk tools end to end (docs/plan/04-disk-tools.md, "Done when"):
 *
 * 1. a committed transcript of the whole workflow, acquire → hashsum --verify → lsfs -d → inode →
 *    recover → pin, which has to be the same bytes every run;
 * 2. the wrong turn: reading the original with the write-blocker off changes the drive's SHA-256
 *    and is recorded as `evidence.readOriginal` with `blocker: false`.
 */
import { describe, expect, it } from "vitest";
import { imageHash } from "../../evidence/image";
import { renderTranscript } from "../../core/transcript";
import type { ReplayStep } from "../../core/replay";
import type { DiskImage } from "../../evidence/types";
import {
  caseEvidence,
  caseState,
  CASE_DIR,
  DEVICE_PATH,
  eventTypes,
  formSha256,
  IMAGE_PATH,
  runAll,
  runCase,
} from "./__fixtures__/evidence";

/** One pass through the disk half of an investigation, in the order a case teaches it. */
const WORKFLOW: readonly (readonly string[])[] = [
  ["blocker"],
  ["acquire", DEVICE_PATH, "--out", IMAGE_PATH],
  ["hashsum", "--verify", formSha256(), IMAGE_PATH],
  ["lsfs", "qf-lt-07", "-r", "-d", "-l"],
  ["inode", "qf-lt-07", "51"],
  ["recover", "qf-lt-07", "51", "--out", `${CASE_DIR}/export/inv-0413.pdf`],
  ["pin", "-m", "the invoice the office says went missing"],
];

function transcript(): string {
  const { results } = runAll(caseState(), WORKFLOW);
  const steps: ReplayStep[] = results.map((result, index) => ({
    command: { type: "exec", argv: WORKFLOW[index] as readonly string[] },
    output: result.output,
    events: result.events,
    exitCode: result.exitCode,
  }));
  return renderTranscript(steps);
}

/** The drive as it stands in a state: the bytes a hash would be taken of. */
const deviceNow = (state: Parameters<typeof runCase>[0]): DiskImage =>
  state.evidence?.images[DEVICE_PATH] as DiskImage;

describe("the disk tools, end to end", () => {
  it("matches the committed transcript", async () => {
    await expect(transcript()).toMatchFileSnapshot("./__fixtures__/golden/disk-tools.txt");
  });

  it("is byte-identical when run twice", () => {
    expect(transcript()).toBe(transcript());
  });

  it("ends with the working copy matching the handover form", () => {
    const { state } = runAll(caseState(), WORKFLOW);
    expect(imageHash("sha256", state.evidence?.images[IMAGE_PATH] as DiskImage)).toBe(formSha256());
    expect(imageHash("sha256", deviceNow(state))).toBe(formSha256());
  });
});

describe("reading the original without the write-blocker", () => {
  it("changes the drive's SHA-256 and says so, once the blocker is off", () => {
    const start = caseState();
    expect(imageHash("sha256", deviceNow(start))).toBe(formSha256());
    expect(caseEvidence().handover[0]?.hashes?.sha256).toBe(formSha256());

    const off = runCase(start, "blocker", "off", DEVICE_PATH);
    // Turning the blocker off changes nothing on its own: it takes a read.
    expect(imageHash("sha256", deviceNow(off.state))).toBe(formSha256());

    const read = runCase(off.state, "lsfs", "qf-lt-07");
    expect(read.events[0]).toEqual({
      type: "evidence.readOriginal",
      device: DEVICE_PATH,
      blocker: false,
      tool: "lsfs",
    });
    const after = imageHash("sha256", deviceNow(read.state));
    expect(after).not.toBe(formSha256());
    expect(read.state.evidence?.attached["qf-lt-07"]?.changedAt).toBeDefined();

    // And the form no longer matches, which is how an examiner would find out.
    const check = runCase(read.state, "hashsum", "--verify", formSha256(), DEVICE_PATH);
    expect(check.output.map((line) => line.text).join("\n")).toContain("MISMATCH");
    expect(check.events[1]).toMatchObject({ type: "evidence.hashed", verified: false });
  });

  it("records the read with blocker: true while the blocker is on, and changes nothing", () => {
    const read = runCase(caseState(), "lsfs", "qf-lt-07");
    expect(eventTypes(read)).toEqual(["evidence.readOriginal", "command.run"]);
    expect(read.events[0]).toMatchObject({ blocker: true });
    expect(imageHash("sha256", deviceNow(read.state))).toBe(formSha256());
  });

  it("leaves a copy taken after the mistake carrying the new access times", () => {
    const { state } = runAll(caseState(), [
      ["blocker", "off", DEVICE_PATH],
      ["acquire", DEVICE_PATH, "--out", IMAGE_PATH],
    ]);
    expect(imageHash("sha256", state.evidence?.images[IMAGE_PATH] as DiskImage)).not.toBe(
      formSha256(),
    );
  });
});
