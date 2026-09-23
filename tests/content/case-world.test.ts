import { describe, expect, it } from "vitest";
import { CAST_IDS } from "@/content/cast";
import { caseCopy } from "@/content/cases/copy";
import { isFictionalHostname, isReservedAddress } from "@/content/cases/schema";
import { findBannedWords } from "@/content/voice";
import { isFictionalHostname as engineHostname } from "@/sim/net/names";
import { isReservedIp, parseIpv4 } from "@/sim/net/ip";
import { builtCases, catalog } from "./support";

/**
 * Group 7 of docs/plan/03-case-format-and-generator.md §Tests: **the world rules**.
 *
 * Everything in a case is made up on purpose, and stays made up: only reserved addresses and
 * `.example` names, only speakers from the cast, and none of the words the voice rules ban
 * (docs/plan/99-reference.md). The schema refuses most of it as a file is written; this is the
 * sweep across whole cases, including the places a name can hide — a file's content, a letter, a
 * command line in the story.
 */
describe.each(catalog.all.map((entry) => [entry.id, entry] as const))("%s", (id, entry) => {
  it("only ever names reserved addresses", () => {
    const text = JSON.stringify(entry);
    for (const [address] of text.matchAll(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g)) {
      expect(isReservedAddress(address), `${id} names ${address}`).toBe(true);
    }
  });

  it("names no domain that could be somebody's", () => {
    // A file name and a host name look the same written down, so this looks for the other end:
    // names under a real public suffix. Only `.example` is allowed, and the schema already refuses
    // anything else where it knows a field holds a name; this is the sweep over everything else.
    const text = JSON.stringify(entry);
    const real = /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|dev|co\.uk|gov|edu)\b/gi;
    for (const [name] of text.matchAll(real)) {
      expect(isFictionalHostname(name), `${id} names ${name}`).toBe(true);
    }
  });

  it("only ever puts words in the mouth of somebody in the cast", () => {
    for (const beat of entry.beats) {
      expect(CAST_IDS, `${id} has a line from ${beat.speaker}`).toContain(beat.speaker);
    }
  });

  it("uses none of the words the voice rules ban", () => {
    for (const { path, text } of caseCopy(entry)) {
      const banned = findBannedWords(text);
      expect(banned, `${id} ${path}: ${banned.join(", ")}`).toEqual([]);
    }
  });

  it("says who signed, and what that lets the player examine", () => {
    expect(entry.client.signedBy.trim().length, `${id} has nobody signing for it`).toBeGreaterThan(
      0,
    );
    expect(entry.briefing.authorization.trim().length).toBeGreaterThan(0);
    expect(entry.debrief.ethicsNote.trim().length).toBeGreaterThan(0);
    expect(entry.debrief.defensiveTakeaway.trim().length).toBeGreaterThan(0);
  });
});

describe("the generated evidence", () => {
  it.each(builtCases.map((built) => [built.case.id, built] as const))(
    "%s names nothing real either",
    (id, built) => {
      const text = JSON.stringify({
        disks: built.evidence.disks.map((disk) => ({ ...disk, unallocatedB64: "" })),
        logs: built.evidence.logs,
        memory: built.evidence.memory,
        handover: built.evidence.handover,
      });
      for (const [address] of text.matchAll(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g)) {
        expect(isReservedAddress(address), `${id}'s evidence names ${address}`).toBe(true);
      }
    },
  );
});

describe("the world rules themselves", () => {
  it("agree with the engine about which addresses are reserved", () => {
    const addresses = [
      "10.60.0.21",
      "192.168.1.1",
      "172.16.4.9",
      "172.32.4.9",
      "127.0.0.1",
      "192.0.2.5",
      "198.51.100.7",
      "203.0.113.47",
      "8.8.8.8",
      "1.1.1.1",
      "300.1.1.1",
    ];
    for (const address of addresses) {
      const engine = parseIpv4(address) !== undefined && isReservedIp(parseIpv4(address) ?? 0);
      expect(isReservedAddress(address), address).toBe(engine);
    }
  });

  it("agree with the engine about which names can only be made up", () => {
    for (const name of [
      "quillfen.example",
      "cdn-sync.example",
      "localhost",
      "qf-lt-07",
      "example.com",
      "a-real-company.co.uk",
      "google.com",
    ]) {
      expect(isFictionalHostname(name), name).toBe(engineHostname(name));
    }
  });
});
