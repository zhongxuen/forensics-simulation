import { describe, expect, it } from "vitest";
import { KNOWN_EVENT_IDS, LOG_SOURCES, renderLog } from "@/sim";
import type { LogRecord } from "@/sim/types";
import { FIXTURE_LOGS } from "./helpers/evidence-fixture";

// One golden rendering per event id and per line-shaped source, in UTC, plus a few in local time.
// After an intentional format change, delete tests/unit/fixtures/evidence-logs/, rerun, and review
// the new files before committing them.
const GOLDEN_DIR = "./fixtures/evidence-logs";

const name = (record: LogRecord) =>
  record.eventId === undefined ? record.source : `${record.source}-${record.eventId}`;

describe("renderLog goldens", () => {
  it("has a fixture record for every known event id and every source", () => {
    for (const [source, ids] of Object.entries(KNOWN_EVENT_IDS)) {
      for (const id of ids ?? []) {
        expect(
          FIXTURE_LOGS.some((r) => r.source === source && r.eventId === id),
          `${source} ${id}`,
        ).toBe(true);
      }
    }
    for (const source of LOG_SOURCES) {
      expect(
        FIXTURE_LOGS.some((r) => r.source === source),
        source,
      ).toBe(true);
    }
    expect(KNOWN_EVENT_IDS.security).toEqual([4624, 4625, 4634, 4672, 4688, 4720, 4732]);
  });

  it.each(FIXTURE_LOGS.map((record) => [name(record), record] as const))(
    "%s",
    async (fileName, record) => {
      await expect(`${renderLog(record).join("\n")}\n`).toMatchFileSnapshot(
        `${GOLDEN_DIR}/${fileName}.txt`,
      );
    },
  );

  const localSamples = FIXTURE_LOGS.filter(
    (r) => r.eventId === 4624 || r.source === "web-access" || r.source === "firewall",
  );
  it.each(localSamples.map((record) => [name(record), record] as const))(
    "%s in local time",
    async (fileName, record) => {
      await expect(
        `${renderLog(record, { zone: "Europe/London" }).join("\n")}\n`,
      ).toMatchFileSnapshot(`${GOLDEN_DIR}/${fileName}.local.txt`);
    },
  );
});

describe("renderLog", () => {
  const logon = FIXTURE_LOGS.find((r) => r.eventId === 4624)!;

  it("prints an event header, then its fields in the documented order", () => {
    const lines = renderLog(logon);
    expect(lines.slice(0, 4)).toEqual([
      "EventID      4624  An account was successfully logged on.",
      "TimeCreated  2026-04-11T19:40:12Z",
      "Computer     qf-lt-07",
      "Keywords     Audit Success",
    ]);
    const fieldNames = lines.slice(4).map((line) => line.trim().split(/\s+/)[0]);
    expect(fieldNames.slice(0, 5)).toEqual([
      "SubjectUserName",
      "SubjectDomainName",
      "TargetUserName",
      "TargetDomainName",
      "LogonType",
    ]);
  });

  it("only changes the displayed time for a local zone, never the record", () => {
    const utc = renderLog(logon);
    const local = renderLog(logon, { zone: "Europe/London" });
    expect(local[1]).toBe("TimeCreated  2026-04-11 20:40:12 +01:00");
    expect(local.filter((_, i) => i !== 1)).toEqual(utc.filter((_, i) => i !== 1));
  });

  it("prints Apache's combined format for web access, with the zone's offset", () => {
    const record = FIXTURE_LOGS.find((r) => r.source === "web-access")!;
    expect(renderLog(record, { zone: "Europe/London" })).toEqual([
      '10.60.0.21 - - [11/Apr/2026:20:39:58 +0100] "GET /dispatch/login HTTP/1.1" 200 5120 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"',
    ]);
    expect(renderLog({ ...record, fields: { ...record.fields, bytes: "0" } })[0]).toContain(
      '" 200 - "',
    );
  });

  it("quotes key=value values that hold spaces", () => {
    const record = FIXTURE_LOGS.find((r) => r.source === "firewall")!;
    expect(renderLog(record)[0]).toBe(
      '2026-04-11T19:41:30Z qf-fw-01 action=allow proto=TCP src=10.60.0.21 spt=51234 dst=203.0.113.80 dpt=443 bytes=1843200 rule=office-out note="large upload"',
    );
  });

  it("still prints an event id it has no name for", () => {
    const lines = renderLog({ ...logon, eventId: 4660, fields: { ObjectName: "inv-0412.pdf" } });
    expect(lines[0]).toBe("EventID      4660  Event.");
    expect(lines).toContain("  ObjectName  inv-0412.pdf");
  });

  it("is line-based, so the shell can pipe it", () => {
    for (const record of FIXTURE_LOGS) {
      for (const line of renderLog(record)) expect(line).not.toMatch(/[\r\n]/);
    }
  });
});
