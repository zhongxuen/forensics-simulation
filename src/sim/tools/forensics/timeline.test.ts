import { describe, expect, it } from "vitest";
import { createInitialState } from "../../core/scenario";
import type { SimState } from "../../core/types";
import * as build from "../../evidence/builder";
import { attachEvidence } from "../../evidence/session";
import { buildTimeline } from "../../evidence/timeline";
import {
  bareState,
  CASE_NOW,
  CASE_SCENARIO,
  CASE_SEED,
  caseEvidence,
  caseState,
  errorCodes,
  eventTypes,
  refs,
  runAll,
  runCase,
  text,
} from "./__fixtures__/evidence";
import { parseTime, parseWindow, timelineTime } from "./timeline";

/**
 * A server's memory and logs beside the laptop's drive: the break-in minute, seen from four
 * sources. The drive's own clock was in Europe/London; everything else keeps UTC.
 */
function serverEvidence() {
  return build
    .evidence("case-t", { seed: CASE_SEED, host: "qf-srv-01" })
    .disk(
      build
        .disk("qf-lt-07")
        .file("C:\\Users\\dana\\Documents\\inv-0413.pdf", {
          record: 51,
          content: "%PDF-1.4",
          at: "2026-04-10T16:41:00Z",
          times: { m: "2026-04-11T19:41:02Z", c: "2026-04-11T19:41:02Z" },
        })
        .deleted("C:\\Users\\dana\\Documents\\inv-0413.pdf"),
    )
    .memory(
      build
        .memory("qf-srv-01", { capturedAt: "2026-04-11T21:00:00Z" })
        .process("rdpclip.exe", { pid: 4120, createdAt: "2026-04-11T19:40:15Z", user: "dana" })
        .connection("203.0.113.47:443", { createdAt: "2026-04-11T19:40:20Z" }),
    )
    .log(
      "security",
      "2026-04-11T19:40:12Z",
      { TargetUserName: "dana", LogonType: "10", IpAddress: "203.0.113.47" },
      { eventId: 4624, seq: 57 },
    )
    .log("dns", "2026-04-11T19:40:42Z", { client: "10.60.1.10", query: "cdn-sync.example" })
    .log("security", "2026-04-11T19:40:43Z", { TargetUserName: "dana" }, { eventId: 4634 })
    .zone("disk", "Europe/London")
    .build();
}

const serverState = (): SimState =>
  attachEvidence(createInitialState(CASE_SCENARIO, CASE_SEED), serverEvidence(), {
    now: Date.UTC(2026, 3, 12, 8, 5, 0),
  });

const run = (state: SimState, ...args: string[]) => runCase(state, "timeline", ...args);

/** The timeline rows: lines that carry a ref and start with a time. */
const rows = (out: string) => out.split("\n").filter((line) => /^ {2}\d{4}-/.test(line));

describe("timeline", () => {
  it("prints every moment in the evidence, in the model's order, each with its ref", () => {
    const result = run(serverState());
    const out = text(result);
    expect(out).toContain("timeline (simulated) · 4 sources · 11 moments");
    expect(out).toContain("Time (UTC)           | Source   | Kind          | Host      | Summary");
    const expected = buildTimeline(serverEvidence()).map((entry) => entry.ref);
    expect(refs(result)).toEqual(expected);
    expect(rows(out)).toHaveLength(expected.length);
    expect(out).toContain(
      "  2026-04-11T19:40:12Z | security | 4624          | qf-srv-01 | An account was successfully logged on. TargetUserName=dana LogonType=10 IpAddress=203.0.113.47  [log:security/57]",
    );
    expect(out).toContain(
      "  2026-04-11T19:41:02Z | disk     | M.C.          | qf-lt-07  | C:\\Users\\dana\\Documents\\inv-0413.pdf (deleted)  [disk:qf-lt-07:mft/51]",
    );
    expect(result.exitCode).toBe(0);
  });

  it("explains MACB letters when a file is on screen, and how to pin a moment", () => {
    const out = text(run(serverState()));
    expect(out).toContain("M modified, A accessed, C changed");
    expect(out).toContain("Pin a moment with: pin <line number>");
    const noDisk = text(run(serverState(), "--source", "security"));
    expect(noDisk).not.toContain("M modified");
  });

  it("gives the same output every time", () => {
    expect(text(run(serverState()))).toBe(text(run(serverState())));
  });

  describe("--around", () => {
    it("shows everything within five minutes either side of a ref's moment", () => {
      const out = text(run(caseState(), "--around", "disk:qf-lt-07:mft/51"));
      expect(out).toContain(
        "Everything within 5 minutes either side of disk:qf-lt-07:mft/51, M... at 2026-04-11T19:41:02Z.",
      );
      // 19:36:02 to 19:46:02: the invoice's change, its deletion a minute later, and the sync log
      // written three minutes after that.
      expect(rows(out).map((line) => line.split(" | ")[0]?.trim())).toEqual([
        "2026-04-11T19:41:02Z",
        "2026-04-11T19:42:03Z",
        "2026-04-11T19:44:12Z",
      ]);
    });

    it("names a file's other moments, so you can look there instead", () => {
      const out = text(run(caseState(), "--around", "disk:qf-lt-07:mft/51"));
      expect(out).toContain(
        "It has other moments too (.A.B 2026-04-10T16:41:00Z, ..C. 2026-04-11T19:42:03Z).",
      );
    });

    it("narrows with --window, and includes the moments at both edges", () => {
      const state = serverState();
      const around = (window: string) =>
        refs(run(state, "--around", "log:security/57", "--window", window)).slice(1);
      // The first ref is the "Everything within ..." line itself.
      expect(refs(run(state, "--around", "log:security/57"))[0]).toBe("log:security/57");
      expect(around("3s")).toEqual(["log:security/57", "mem:qf-srv-01-mem:pid/4120"]);
      expect(around("8s")).toEqual([
        "log:security/57",
        "mem:qf-srv-01-mem:pid/4120",
        "mem:qf-srv-01-mem:conn/0",
      ]);
      expect(around("30s")).toEqual([
        "log:security/57",
        "mem:qf-srv-01-mem:pid/4120",
        "mem:qf-srv-01-mem:conn/0",
        "log:dns/1",
      ]);
      expect(around("1m")).toHaveLength(6);
    });

    it("centres on a process start or a connection", () => {
      const out = text(
        run(serverState(), "--around", "mem:qf-srv-01-mem:conn/0", "--window", "5s"),
      );
      expect(out).toContain("mem:qf-srv-01-mem:conn/0, connection at 2026-04-11T19:40:20Z");
      expect(rows(out)).toHaveLength(2);
    });

    it("takes a time as well as a ref", () => {
      const out = text(run(serverState(), "--around", "2026-04-11T19:40:43Z", "--window", "1s"));
      expect(out).toContain("Everything within 1 second either side of 2026-04-11T19:40:43Z.");
      expect(rows(out)).toHaveLength(2);
    });

    it("combines with --source", () => {
      const result = run(
        serverState(),
        "--around",
        "log:security/57",
        "--window",
        "1m",
        "--source",
        "security,disk",
      );
      expect(refs(result).slice(1)).toEqual([
        "log:security/57",
        "log:security/58",
        "disk:qf-lt-07:mft/51",
      ]);
    });

    it("says what to try when nothing falls inside the window", () => {
      const out = text(run(caseState(), "--around", "2026-04-11T12:00Z", "--window", "1s"));
      expect(out).toContain("0 moments");
      expect(out).toContain("Nothing happened in that stretch of time on these sources.");
      expect(out).toContain("Try a wider --window, such as 30m.");
    });

    it("refuses a ref that isn't one, points at nothing, or has no time", () => {
      const state = caseState();
      const bad = run(state, "--around", "record-51");
      expect(errorCodes(bad)).toEqual(["BAD_ARGUMENT"]);
      expect(text(bad)).toContain("--around takes a ref, such as disk:qf-lt-07:mft/51");

      const nothing = run(state, "--around", "disk:qf-lt-07:mft/999");
      expect(errorCodes(nothing)).toEqual(["BAD_ARGUMENT"]);
      expect(text(nothing)).toContain("Nothing in this case's evidence has that ref.");

      const carve = run(state, "--around", "disk:qf-lt-07:carve/0");
      expect(errorCodes(carve)).toEqual(["BAD_ARGUMENT"]);
      expect(text(carve)).toContain("A carved object has no time of its own");
    });

    it("notes that --window means nothing without --around", () => {
      expect(text(run(caseState(), "--window", "5m"))).toContain(
        "--window only matters with --around, so it was left out.",
      );
    });
  });

  describe("zones", () => {
    it("prints UTC by default, and says which sources kept local time", () => {
      const out = text(run(serverState()));
      expect(out).toContain(
        "These times are UTC. These sources showed local time on their own machines:",
      );
      expect(out).toContain("    disk  Europe/London (UTC+01:00)");
      expect(out).toContain("Pass --zone local to see each one as its own machine did.");
    });

    it("prints each source in its own zone with --zone local, and warns the clocks differ", () => {
      const out = text(run(serverState(), "--zone", "local"));
      expect(out).toContain("Time (each source's own zone)");
      expect(out).toMatch(/ {2}2026-04-11 20:41:02 \+01:00 +\| disk /);
      expect(out).toMatch(/ {2}2026-04-11 19:40:12 \+00:00 +\| security /);
      expect(out).toContain("compare the offsets, not the hours");
      // The order is still by the real moment: the sign-in comes before the file change.
      const times = rows(out).map((line) => line.split(" | ")[1]?.trim());
      expect(times.indexOf("security")).toBeLessThan(times.lastIndexOf("disk"));
    });

    it("names every offset in use, and keeps dates the zone table doesn't cover in UTC", () => {
      const set = build
        .evidence("case-t")
        .disk(
          build
            .disk("qf-lt-07")
            .file("C:\\Windows\\win.ini", { at: "2025-02-14T06:33:59Z" })
            .file("C:\\Users\\dana\\winter.txt", { at: "2026-02-10T09:00:00Z" })
            .file("C:\\Users\\dana\\summer.txt", { at: "2026-04-11T19:41:02Z" }),
        )
        .zone("disk", "Europe/London")
        .build();
      const state = attachEvidence(createInitialState(CASE_SCENARIO, CASE_SEED), set);
      const utc = text(run(state));
      expect(utc).toContain("    disk  Europe/London (UTC+00:00 or UTC+01:00, by date)");

      const local = text(run(state, "--zone", "local"));
      expect(local).toMatch(/ {2}2025-02-14T06:33:59Z +\| disk .*win\.ini/);
      expect(local).toMatch(/ {2}2026-02-10 09:00:00 \+00:00 +\| disk .*winter\.txt/);
      expect(local).toMatch(/ {2}2026-04-11 20:41:02 \+01:00 +\| disk .*summer\.txt/);
      expect(local).toContain("so they stay in UTC: those are the times ending in Z.");
    });

    it("says nothing about zones when every source keeps UTC", () => {
      const out = text(run(serverState(), "--source", "memory,security"));
      expect(out).not.toContain("local time");
    });

    it("renders local time for the moment itself, across the change to summer time", () => {
      expect(timelineTime(Date.UTC(2026, 2, 29, 0, 30), "Europe/London")).toBe(
        "2026-03-29 00:30:00 +00:00",
      );
      expect(timelineTime(Date.UTC(2026, 2, 29, 1, 30), "Europe/London")).toBe(
        "2026-03-29 02:30:00 +01:00",
      );
      expect(timelineTime(Date.UTC(2026, 3, 11, 19, 40, 12), "UTC")).toBe(
        "2026-04-11 19:40:12 +00:00",
      );
      expect(timelineTime(Date.UTC(2026, 3, 11, 19, 40, 12), undefined)).toBe(
        "2026-04-11T19:40:12Z",
      );
    });
  });

  describe("--from, --to and --source", () => {
    it("keeps the moments between two times, both ends included", () => {
      const result = run(
        serverState(),
        "--from",
        "2026-04-11T19:40:15Z",
        "--to",
        "2026-04-11T19:40:42Z",
      );
      expect(refs(result)).toEqual([
        "mem:qf-srv-01-mem:pid/4120",
        "mem:qf-srv-01-mem:conn/0",
        "log:dns/1",
      ]);
    });

    it("reads a time with an offset as local, and one without as UTC, and says so", () => {
      const local = run(serverState(), "--from", "2026-04-11T20:41+01:00");
      expect(refs(local)).toEqual(["disk:qf-lt-07:mft/51"]);
      expect(text(local)).not.toContain("was read as UTC");
      const bare = text(run(serverState(), "--from", "2026-04-11T19:41"));
      expect(bare).toContain("--from 2026-04-11T19:41 has no zone, so it was read as UTC.");
    });

    it("filters by source, one or several", () => {
      expect(
        new Set(refs(run(serverState(), "--source", "memory")).map((r) => r.split(":")[0])),
      ).toEqual(new Set(["mem"]));
      const result = run(serverState(), "--source", "dns,disk");
      expect(text(result)).toContain("2 sources · 7 moments");
    });

    it("refuses times, sources, windows and zones it can't read, and says what fits", () => {
      const state = serverState();
      const cases: [string[], string][] = [
        [["--from", "yesterday"], "Write a time like 2026-04-11T19:40"],
        [["--from", "2026-02-30"], "Write a time like"],
        [["--to", "2026-04-11T25:00Z"], "Write a time like"],
        [["--from", "2026-04-12", "--to", "2026-04-11"], "--to is earlier than --from"],
        [["--source", "disk,registry"], "The sources are: disk, memory, security"],
        [["--around", "log:security/57", "--window", "five"], "A window is a number and a unit"],
        [["--around", "log:security/57", "--window", "2d"], "A window is a number and a unit"],
        [["--around", "log:security/57", "--window", "25h"], "A window runs from 1s to 24h"],
        [["--around", "log:security/57", "--window", "0s"], "A window runs from 1s to 24h"],
      ];
      for (const [args, explain] of cases) {
        const result = run(state, ...args);
        expect(errorCodes(result), args.join(" ")).toEqual(["BAD_ARGUMENT"]);
        expect(text(result), args.join(" ")).toContain(explain);
        expect(text(result)).toContain("Try 'timeline --help' for more information.");
        expect(result.exitCode).toBe(2);
      }
      expect(errorCodes(run(state, "--zone", "mars"))).toEqual(["BAD_ARGUMENT"]);
      expect(errorCodes(run(state, "qf-lt-07"))).toEqual(["BAD_ARGUMENT"]);
      expect(errorCodes(run(state, "--deep"))).toEqual(["BAD_FLAG"]);
      expect(errorCodes(run(state, "--around"))).toEqual(["MISSING_ARGUMENT"]);
    });
  });

  it("says so when no evidence is attached", () => {
    expect(errorCodes(run(bareState()))).toEqual(["EVIDENCE_NOT_LOADED"]);
  });

  it("says what will be there when the evidence has no times at all", () => {
    const empty = attachEvidence(
      createInitialState(CASE_SCENARIO, CASE_SEED),
      build.evidence("case-t").build(),
    );
    expect(text(run(empty))).toContain("This evidence has");
  });

  it("lets pin put a timeline moment on the case board", () => {
    const { results } = runAll(serverState(), [
      ["timeline", "--around", "log:security/57", "--window", "3s"],
      ["pin"],
    ]);
    expect(results[1]?.events.filter((event) => event.type !== "command.run")).toEqual([
      expect.objectContaining({ type: "board.pinned", ref: "mem:qf-srv-01-mem:pid/4120" }),
    ]);
  });

  it("reads the working copy once there is one, and changes nothing", () => {
    const { state, results } = runAll(caseState(), [
      [
        "acquire",
        "/dev/evidence/qf-lt-07",
        "--out",
        "/home/examiner/cases/case-01/images/qf-lt-07.img",
      ],
      ["timeline"],
    ]);
    expect(results[0]?.exitCode).toBe(0);
    const result = results[1];
    expect(eventTypes(result ?? run(state))).toEqual(["command.run"]);
    expect(refs(result ?? run(state))).toEqual(buildTimeline(caseEvidence()).map((e) => e.ref));
  });

  it("reads the original through its write-blocker, and warns when the blocker is off", () => {
    const blocked = run(caseState());
    expect(eventTypes(blocked)).toEqual(["evidence.readOriginal", "command.run"]);
    expect(text(blocked)).not.toContain("Careful");

    const open = run(caseState({ blocker: false }));
    expect(eventTypes(open)).toEqual(["evidence.readOriginal", "command.run"]);
    const out = text(open);
    expect(out).toContain("Careful: the write-blocker is off for /dev/evidence/qf-lt-07");
    // Every live file's access time is now the examiner's own read.
    expect(out).toContain(`${new Date(CASE_NOW).toISOString().replace(".000Z", "Z")} | disk `);
  });

  it("has a man page naming the real tools it stands in for", () => {
    const out = text(runCase(caseState(), "man", "timeline"));
    expect(out).toContain("REAL-WORLD EQUIVALENT");
    expect(out).toContain("log2timeline");
    expect(out).toContain("Timesketch");
  });
});

describe("parseTime", () => {
  it("reads dates, times, Z and offsets, and marks a time with no zone", () => {
    expect(parseTime("2026-04-11")).toEqual({ at: Date.UTC(2026, 3, 11), zoned: false });
    expect(parseTime("2026-04-11T19:40")).toEqual({
      at: Date.UTC(2026, 3, 11, 19, 40),
      zoned: false,
    });
    expect(parseTime("2026-04-11 19:40:12")).toEqual({
      at: Date.UTC(2026, 3, 11, 19, 40, 12),
      zoned: false,
    });
    expect(parseTime("2026-04-11T19:40:12Z")).toEqual({
      at: Date.UTC(2026, 3, 11, 19, 40, 12),
      zoned: true,
    });
    expect(parseTime("2026-04-11T20:40:12+01:00")?.at).toBe(Date.UTC(2026, 3, 11, 19, 40, 12));
    expect(parseTime("2026-04-11T14:40-05:00")?.at).toBe(Date.UTC(2026, 3, 11, 19, 40));
  });

  it("refuses what isn't a time", () => {
    for (const text of [
      "",
      "19:40",
      "2026-4-11",
      "2026-04-31",
      "2026-13-01",
      "2026-04-11T24:00",
      "2026-04-11T19:40+15:00",
    ]) {
      expect(parseTime(text), text).toBeUndefined();
    }
  });
});

describe("parseWindow", () => {
  it("reads seconds, minutes and hours", () => {
    expect(parseWindow("30s")).toBe(30_000);
    expect(parseWindow("5m")).toBe(300_000);
    expect(parseWindow("2H")).toBe(7_200_000);
    expect(parseWindow("5")).toBeUndefined();
    expect(parseWindow("1.5m")).toBeUndefined();
  });
});
