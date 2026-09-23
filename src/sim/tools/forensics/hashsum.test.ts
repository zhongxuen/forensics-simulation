import { describe, expect, it } from "vitest";
import {
  bareState,
  caseState,
  CASE_DIR,
  DEVICE_PATH,
  errorCodes,
  eventTypes,
  formSha256,
  IMAGE_PATH,
  runCase,
  text,
} from "./__fixtures__/evidence";

const acquired = () => runCase(caseState(), "acquire", DEVICE_PATH, "--out", IMAGE_PATH).state;

describe("hashsum", () => {
  it("hashes a working copy's image bytes, with sha256 by default", () => {
    const result = runCase(acquired(), "hashsum", IMAGE_PATH);
    expect(text(result)).toContain(`hashsum (simulated) · sha256 · ${IMAGE_PATH}`);
    expect(text(result)).toContain(formSha256());
    expect(text(result)).toContain("image bytes of qf-lt-07 · 2,048 sectors · 10 records");
    expect(result.exitCode).toBe(0);
  });

  it("takes md5 and sha1, and says what they are worth", () => {
    const md5 = runCase(acquired(), "hashsum", "-a", "md5", IMAGE_PATH);
    expect(text(md5)).toMatch(/^ {2}[0-9a-f]{32}$/m);
    expect(text(md5)).toContain("MD5 can be made to collide");
    const sha1 = runCase(acquired(), "hashsum", "--algorithm", "sha1", IMAGE_PATH);
    expect(text(sha1)).toMatch(/^ {2}[0-9a-f]{40}$/m);
  });

  it("hashes an ordinary file's content too", () => {
    const result = runCase(caseState(), "hashsum", `${CASE_DIR}/handover.txt`);
    expect(text(result)).toContain("file content · 53 bytes");
    expect(eventTypes(result)).toEqual(["evidence.hashed", "command.run"]);
  });

  it("says MATCH, and what that means, against the handover form", () => {
    const result = runCase(acquired(), "hashsum", "--verify", formSha256(), IMAGE_PATH);
    expect(text(result)).toContain("MATCH");
    expect(text(result)).toContain("the two are byte for byte the same");
    expect(result.events[0]).toMatchObject({ type: "evidence.hashed", verified: true });
  });

  it("says MISMATCH, shows both hashes, and names the usual cause", () => {
    const result = runCase(acquired(), "hashsum", "--verify", "0".repeat(64), IMAGE_PATH);
    expect(text(result)).toContain("MISMATCH");
    expect(text(result)).toContain(`expected  ${"0".repeat(64)}`);
    expect(text(result)).toContain("whether its write-blocker was on");
    expect(result.events[0]).toMatchObject({ type: "evidence.hashed", verified: false });
  });

  it("reads the original through the blocker, and records that it did", () => {
    const result = runCase(caseState(), "hashsum", DEVICE_PATH);
    expect(eventTypes(result)).toEqual(["evidence.readOriginal", "evidence.hashed", "command.run"]);
    expect(result.events[0]).toMatchObject({ blocker: true, tool: "hashsum" });
    expect(text(result)).toContain(formSha256());
  });

  it("reports an algorithm it doesn't have, a hash that isn't one, and the rest", () => {
    expect(errorCodes(runCase(caseState(), "hashsum"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(runCase(caseState(), "hashsum", "-a", "crc32", DEVICE_PATH))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(errorCodes(runCase(caseState(), "hashsum", "--verify", "beef", DEVICE_PATH))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(errorCodes(runCase(caseState(), "hashsum", DEVICE_PATH, "extra"))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(errorCodes(runCase(caseState(), "hashsum", "--deep", DEVICE_PATH))).toEqual([
      "BAD_FLAG",
    ]);
  });

  it("falls back to the filesystem's own error for a name that is neither", () => {
    expect(errorCodes(runCase(caseState(), "hashsum", "/home/examiner/nothing.txt"))).toEqual([
      "ENOENT",
    ]);
    expect(errorCodes(runCase(caseState(), "hashsum", "qf-lt-99"))).toEqual(["ENOENT"]);
  });

  it("says so when no evidence is attached", () => {
    expect(errorCodes(runCase(bareState(), "hashsum", DEVICE_PATH))).toEqual([
      "EVIDENCE_NOT_LOADED",
    ]);
  });
});
