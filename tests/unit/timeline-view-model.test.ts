import { describe, expect, it } from "vitest";
import {
  applyFilter,
  changeTrack,
  density,
  describeKind,
  entryKey,
  INITIAL_VIEW,
  nearestTo,
  onTrack,
  sourcesIn,
  stepFrom,
  ticksFor,
  timelineViewReducer,
  viewportFor,
  withinWindow,
  zoneTracks,
  zoomStep,
} from "@/features/timeline";
import type { EvidenceSet, TimelineEntry, TimelineSource } from "@/sim/types";

/**
 * The Timeline view's pure parts (docs/plan/09-timeline.md §The view): moving between moments,
 * what lights up, the filters, zoom and the axis, the zone banner, and the reducer both views
 * share.
 */

const T0 = Date.UTC(2026, 3, 11, 19, 40, 0);
const s = (seconds: number) => T0 + seconds * 1000;

function entry(source: TimelineSource, at: number, n: number, kind = "4624"): TimelineEntry {
  const ref = (
    source === "disk" ? `disk:qf-lt-03:mft/${n}` : `log:${source}/${n}`
  ) as TimelineEntry["ref"];
  return { at, source, kind, summary: `moment ${n}`, ref, host: "qf-lt-03" };
}

// In buildTimeline's order: by time, then source.
const ENTRIES: TimelineEntry[] = [
  entry("disk", s(0), 1, "MACB"),
  entry("security", s(5), 1),
  entry("disk", s(20), 2, "M.C."),
  entry("security", s(30), 2),
  entry("dns", s(31), 1, "query"),
  entry("security", s(90), 3),
  entry("disk", s(600), 3, ".A.."),
];

const key = (e: TimelineEntry | undefined) => (e ? entryKey(e) : undefined);

function set(zones: EvidenceSet["zones"]): EvidenceSet {
  return { caseId: "t", seed: 1, disks: [], memory: [], logs: [], zones, handover: [] };
}

describe("moving between moments", () => {
  const security = onTrack(ENTRIES, "security");

  it("steps along a track and stops at either end", () => {
    expect(key(stepFrom(security, key(security[0]), 1))).toBe(key(security[1]));
    expect(key(stepFrom(security, key(security[2]), 1))).toBe(key(security[2]));
    expect(key(stepFrom(security, key(security[1]), -10))).toBe(key(security[0]));
    expect(key(stepFrom(security, key(security[0]), 10))).toBe(key(security[2]));
  });

  it("starts at the first going forward and the last going back, with no cursor", () => {
    expect(key(stepFrom(security, undefined, 1))).toBe(key(security[0]));
    expect(key(stepFrom(security, undefined, -1))).toBe(key(security[2]));
    expect(stepFrom([], undefined, 1)).toBeUndefined();
  });

  it("changes track to the nearest moment in time, skipping empty tracks", () => {
    const tracks = sourcesIn(ENTRIES);
    expect(tracks).toEqual(["disk", "security", "dns"]);
    // From the disk entry at 20s, down: the security entry at 30s is nearer than the one at 5s.
    expect(key(changeTrack(ENTRIES, tracks, "disk", 1, s(20)))).toBe(key(ENTRIES[3]));
    // From dns at 31s, up: security at 30s.
    expect(key(changeTrack(ENTRIES, tracks, "dns", -1, s(31)))).toBe(key(ENTRIES[3]));
    // Past the top or bottom: nowhere to go.
    expect(changeTrack(ENTRIES, tracks, "disk", -1, s(0))).toBeUndefined();
    expect(changeTrack(ENTRIES, tracks, "dns", 1, s(31))).toBeUndefined();
    // A track list with a hidden source in the middle skips over it.
    expect(key(changeTrack(ENTRIES, ["disk", "dns"], "disk", 1, s(0)))).toBe(key(ENTRIES[4]));
  });

  it("breaks a tie in time towards the earlier moment", () => {
    const list = [entry("security", s(0), 1), entry("security", s(10), 2)];
    expect(key(nearestTo(list, s(5)))).toBe(key(list[0]));
    expect(key(nearestTo(list, s(6)))).toBe(key(list[1]));
  });

  it("keys a moment by its ref and instant, so a file's MACB moments stay apart", () => {
    const a = entry("disk", s(0), 9, "M...");
    const b = entry("disk", s(1), 9, ".A..");
    expect(a.ref).toBe(b.ref);
    expect(entryKey(a)).not.toBe(entryKey(b));
  });
});

describe("lighting up and filtering", () => {
  it("lights up every moment within the window, on every track", () => {
    const chosen = ENTRIES[3]!; // security at 30s
    expect(withinWindow(ENTRIES, chosen, 10_000).map(key)).toEqual(
      [ENTRIES[2], ENTRIES[3], ENTRIES[4]].map(key),
    );
    // A minute either side reaches back to 0s and on to 90s: all but the last.
    expect(withinWindow(ENTRIES, chosen, 60_000)).toEqual(ENTRIES.slice(0, 6));
  });

  it("filters by source and by range, keeping the order", () => {
    expect(applyFilter(ENTRIES, { hidden: ["disk"] }).map((e) => e.source)).toEqual([
      "security",
      "security",
      "dns",
      "security",
    ]);
    expect(applyFilter(ENTRIES, { hidden: [], range: { from: s(5), to: s(31) } })).toEqual(
      ENTRIES.slice(1, 5),
    );
  });
});

describe("zoom and the axis", () => {
  it("steps through whole range, hours, minutes and seconds, and stops at the ends", () => {
    expect(zoomStep("all", 1)).toBe("hours");
    expect(zoomStep("minutes", 1)).toBe("seconds");
    expect(zoomStep("seconds", 1)).toBe("seconds");
    expect(zoomStep("all", -1)).toBe("all");
  });

  it("fits the whole range with room either side, and centres a fixed level", () => {
    const whole = viewportFor("all", { from: s(0), to: s(600) }, s(300));
    expect(whole.from).toBeLessThan(s(0));
    expect(whole.to).toBeGreaterThan(s(600));
    expect(viewportFor("seconds", { from: s(0), to: s(600) }, s(100))).toEqual({
      from: s(85),
      to: s(115),
    });
    // A single instant still gets a stretch to draw across.
    const one = viewportFor("all", { from: s(0), to: s(0) }, s(0));
    expect(one.to - one.from).toBe(60_000);
  });

  it("puts ticks on round UTC times, labelled for the span", () => {
    const minutes = ticksFor({ from: s(0), to: s(600) }, 6);
    expect(minutes.map((tick) => tick.label)).toEqual(["19:40", "19:45", "19:50"]);
    const seconds = ticksFor({ from: s(-1), to: s(31) }, 4);
    expect(seconds.map((tick) => tick.label)).toEqual([
      "19:40:00",
      "19:40:10",
      "19:40:20",
      "19:40:30",
    ]);
  });

  it("counts moments into bins for the overview strip", () => {
    expect(density(ENTRIES, { from: s(0), to: s(600) }, 3)).toEqual([6, 0, 1]);
    expect(density(ENTRIES, { from: s(0), to: s(0) }, 3)).toEqual([0, 0, 0]);
  });
});

describe("the zone banner", () => {
  it("shows when a source kept local time and another UTC", () => {
    const zones = zoneTracks(set({ disk: "Europe/London" }), ENTRIES, ["disk", "security"]);
    expect(zones.mixed).toBe(true);
    // April is British Summer Time.
    expect(zones.zoned).toEqual([{ source: "disk", zone: "Europe/London", offsets: "UTC+01:00" }]);
    expect(zones.utc).toEqual(["security"]);
  });

  it("stays away when every source uses the same zone", () => {
    expect(zoneTracks(set({}), ENTRIES, ["disk", "security"]).mixed).toBe(false);
    expect(zoneTracks(set({ disk: "Europe/London" }), ENTRIES, ["disk"]).mixed).toBe(false);
  });

  it("names both offsets when the moments span a clock change", () => {
    const winter = entry("disk", Date.UTC(2026, 0, 10, 12), 7, "M...");
    const zones = zoneTracks(set({ disk: "Europe/London" }), [winter, ...ENTRIES], ["disk"]);
    expect(zones.zoned[0]?.offsets).toBe("UTC+00:00 or UTC+01:00, by date");
  });
});

describe("words", () => {
  it("says what a kind means", () => {
    expect(describeKind(entry("disk", 0, 1, "M.C."))).toBe(
      "The file was modified and changed (the record itself) at this moment.",
    );
    expect(describeKind(entry("security", 0, 1, "4624"))).toBe(
      "The event id the Security log gave it.",
    );
    expect(
      describeKind({ ...entry("security", 0, 1), source: "memory", kind: "process-start" }),
    ).toBe("A program started.");
  });
});

describe("the view's reducer", () => {
  it("moves the cursor without choosing, and choosing moves the cursor too", () => {
    const moved = timelineViewReducer(INITIAL_VIEW, { type: "move", key: "a" });
    expect(moved).toMatchObject({ cursor: "a" });
    expect(moved.selected).toBeUndefined();
    const chosen = timelineViewReducer(moved, { type: "select", key: "b" });
    expect(chosen).toMatchObject({ cursor: "b", selected: "b" });
    const cleared = timelineViewReducer(chosen, { type: "clearSelection" });
    expect(cleared.selected).toBeUndefined();
    expect(cleared.cursor).toBe("b");
  });

  it("keeps a range the right way round, and drops it when cleared", () => {
    const ranged = timelineViewReducer(INITIAL_VIEW, {
      type: "setRange",
      range: { from: s(10), to: s(0) },
    });
    expect(ranged.range).toEqual({ from: s(0), to: s(10) });
    expect(timelineViewReducer(ranged, { type: "setRange", range: undefined }).range).toBe(
      undefined,
    );
  });

  it("switches sources off and on, and shows one on request", () => {
    const off = timelineViewReducer(INITIAL_VIEW, { type: "toggleSource", source: "dns" });
    expect(off.hidden).toEqual(["dns"]);
    expect(timelineViewReducer(off, { type: "showSource", source: "dns" }).hidden).toEqual([]);
    expect(timelineViewReducer(off, { type: "toggleSource", source: "dns" }).hidden).toEqual([]);
  });

  it("keeps the selection when switching between tracks and table", () => {
    const chosen = timelineViewReducer(INITIAL_VIEW, { type: "select", key: "x" });
    const table = timelineViewReducer(chosen, { type: "setMode", mode: "table" });
    expect(table).toMatchObject({ mode: "table", selected: "x", cursor: "x" });
  });
});
