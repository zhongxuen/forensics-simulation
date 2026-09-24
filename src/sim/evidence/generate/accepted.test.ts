import { describe, expect, it } from "vitest";
import { resolveRef } from "../refs";
import type { EvidenceSet } from "../types";
import { EvidencePatternError, requireAcceptedEvidence, resolveAcceptedEvidence } from "./accepted";
import { at, play, SERVER } from "./__fixtures__/case";
import type { StoryAction } from "./types";

/**
 * `acceptedEvidence` patterns (docs/plan/03-case-format-and-generator.md §Case YAML). A report
 * question names the evidence an answer has to point at by what it *is* — the invoice's record,
 * the remote sign-in — and the build turns that into the refs it matches today. Everything here
 * runs against evidence a real story produced, because a pattern that only matches a hand-made
 * fixture proves nothing.
 */

const START = at("2026-04-11T19:40:12Z");
const INVOICE = "C:\\Users\\dana\\Documents\\inv-0412.txt";

const STORY: StoryAction[] = [
  {
    at: START,
    actor: { kind: "attacker" },
    on: "qf-lt-07",
    do: "logon",
    account: "dana",
    type: "remote",
    from: "10.60.0.21",
  },
  {
    at: START + 30_000,
    actor: { kind: "attacker" },
    on: "qf-lt-07",
    do: "create-file",
    path: INVOICE,
    content: "Invoice 0412\n",
  },
  {
    at: START + 60_000,
    actor: { kind: "attacker" },
    on: "qf-lt-07",
    do: "delete-file",
    path: INVOICE,
  },
  {
    at: START + 90_000,
    actor: { kind: "attacker" },
    on: "qf-lt-07",
    do: "run-process",
    name: "dispatch-sync.exe",
    cmdline: "dispatch-sync.exe --host cdn-sync.example",
  },
  {
    at: START + 120_000,
    actor: { kind: "attacker" },
    on: "qf-lt-07",
    do: "connect",
    remote: "203.0.113.47:443",
  },
  {
    at: START + 150_000,
    actor: { kind: "attacker" },
    on: "qf-lt-07",
    do: "inject",
    into: "svchost.exe",
    preview: "cdn-sync.example",
  },
  { at: START + 180_000, actor: { kind: "analyst" }, on: "qf-lt-07", do: "capture-memory" },
];

const evidence: EvidenceSet = play(STORY, { memory: ["qf-lt-07"] }).evidence;
const matches = (pattern: string) => resolveAcceptedEvidence(evidence, pattern);

describe("resolveAcceptedEvidence", () => {
  it("finds a file record by part of its path", () => {
    const [ref, ...rest] = matches("disk:qf-lt-07:mft/*inv-0412*");
    expect(rest).toEqual([]);
    const found = resolveRef(evidence, ref ?? "");
    expect(found?.kind === "file" && found.file.path).toBe(INVOICE);
  });

  it("finds a file record by its number, and nothing by a number that isn't one", () => {
    const record = matches("disk:qf-lt-07:mft/*inv-0412*")[0]?.split("/").pop();
    expect(matches(`disk:qf-lt-07:mft/${record}`)).toHaveLength(1);
    expect(matches("disk:qf-lt-07:mft/99999")).toEqual([]);
  });

  it("finds what a deleted file left in unallocated space", () => {
    expect(matches("disk:qf-lt-07:carve/*")).toEqual(["disk:qf-lt-07:carve/0"]);
    expect(matches("disk:qf-lt-07:carve/0")).toEqual(["disk:qf-lt-07:carve/0"]);
  });

  it("names what the carver finds by its type, whether it is whole, and what it says", () => {
    // Two PDFs deleted; the second partly written over, so the carver finds its start and no end.
    const whole = "C:\\Users\\dana\\Documents\\inv-0407.pdf";
    const long = "C:\\Users\\dana\\Documents\\inv-0410.pdf";
    const rows = Array.from({ length: 320 }, (_, i) => `run ${String(i).padStart(3, "0")} 38.00`);
    const write = (path: string, content: string, offset: number): StoryAction => ({
      at: START + offset,
      actor: { kind: "attacker" },
      on: "qf-lt-07",
      do: "create-file",
      path,
      content,
    });
    const remove = (path: string, offset: number): StoryAction => ({
      at: START + offset,
      actor: { kind: "attacker" },
      on: "qf-lt-07",
      do: "delete-file",
      path,
    });
    const carved = play([
      write(whole, "%PDF-1.4\nInvoice 0407\n%%EOF\n", 0),
      write(long, `%PDF-1.4\nStatement 0410\n${rows.join("\n")}\n%%EOF\n`, 1000),
      remove(whole, 2000),
      remove(long, 3000),
      {
        at: START + 4000,
        actor: { kind: "attacker" },
        on: "qf-lt-07",
        do: "overwrite-clusters",
        path: long,
        by: "C:\\Users\\dana\\Documents\\price-lists.zip",
        keep: 1,
      },
    ]).evidence;
    const find = (pattern: string) => resolveAcceptedEvidence(carved, pattern);

    expect(find("disk:qf-lt-07:carve/pdf")).toHaveLength(2);
    const [complete] = find("disk:qf-lt-07:carve/complete pdf");
    const [partial] = find("disk:qf-lt-07:carve/partial pdf");
    expect(complete).toBe("disk:qf-lt-07:carve/0");
    expect(partial).toMatch(/^disk:qf-lt-07:carve\/[1-9]\d*$/);
    expect(find("disk:qf-lt-07:carve/*Statement 0410*")).toEqual([partial]);
    expect(find("disk:qf-lt-07:carve/*Invoice 0999*")).toEqual([]);
    expect(find("disk:qf-lt-07:carve/zip")).toEqual([]);
  });

  it("picks log records out by their fields", () => {
    const [ref] = matches("log:security/where eventId=4624 and IpAddress=10.60.0.21");
    const found = resolveRef(evidence, ref ?? "");
    expect(found?.kind === "log" && found.record.fields.TargetUserName).toBe("dana");

    expect(matches("log:sysmon-lite/where TargetFilename=*inv-0412*").length).toBeGreaterThan(0);
    expect(matches("log:security/where eventId=4624 and IpAddress=10.0.0.9")).toEqual([]);
  });

  it("matches log fields whatever case the field name is written in", () => {
    expect(matches("log:security/where eventid=4624")).toEqual(
      matches("log:security/where EventID=4624"),
    );
  });

  it("finds a process by name, path or command line", () => {
    const byName = matches("mem:qf-lt-07-mem:pid/dispatch-sync.exe");
    expect(byName).toHaveLength(1);
    expect(matches("mem:qf-lt-07-mem:pid/*cdn-sync.example*")).toEqual(byName);
    expect(matches("mem:*:pid/dispatch-sync.exe")).toEqual(byName);
  });

  it("finds a connection by either address, and a region by what backs it", () => {
    expect(matches("mem:qf-lt-07-mem:conn/*203.0.113.*")).toHaveLength(1);
    expect(matches("mem:qf-lt-07-mem:vad/PAGE_EXECUTE_READWRITE")).toHaveLength(1);
  });

  it("finds a memory image by the host it was taken from", () => {
    expect(matches("mem:qf-lt-07:pid/dispatch-sync.exe")).toHaveLength(1);
  });

  it("refuses something that isn't a pattern at all", () => {
    expect(() => matches("the invoice")).toThrow(EvidencePatternError);
    expect(() => matches("log:mystery/where eventId=1")).toThrow(/isn't a log source/);
    expect(() => matches("log:security/where eventId")).toThrow(/isn't a condition/);
  });
});

describe("requireAcceptedEvidence", () => {
  it("gathers every pattern's matches, with nothing repeated", () => {
    const refs = requireAcceptedEvidence(evidence, [
      "disk:qf-lt-07:mft/*inv-0412*",
      "disk:qf-lt-07:mft/*inv-0412*",
      "log:sysmon-lite/where eventId=23",
    ]);
    expect(refs).toHaveLength(2);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("stops the build when a pattern matches nothing, naming it and where it is", () => {
    expect(() =>
      requireAcceptedEvidence(
        evidence,
        ["disk:qf-lt-07:mft/*inv-9999*"],
        "report.questions[when-deleted].acceptedEvidence",
      ),
    ).toThrow(/report\.questions\[when-deleted\][\s\S]*matches nothing/);
  });

  it("doesn't match evidence from another case's machines", () => {
    const other = play(
      [{ at: START, actor: { kind: "system" }, on: "qf-srv-01", do: "web-request", path: "/" }],
      {
        machines: [SERVER],
      },
    ).evidence;
    expect(resolveAcceptedEvidence(other, "disk:qf-lt-07:mft/*")).toEqual([]);
  });
});
