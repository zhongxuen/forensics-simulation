import { describe, expect, it } from "vitest";
import {
  formatInstant,
  formatOffset,
  isKnownZone,
  ZONE_TABLE,
  zonedParts,
  zoneOffsetMinutes,
} from "@/sim";
import { formatInstant as vendoredFormatInstant } from "@/sim/core/clock";

// The engine may not use Intl (its output would depend on the machine's time-zone database), but
// this test may: it's how the committed offset table is checked against the real rules.

const HOUR = 3_600_000;

/** Local time minus UTC in minutes, as Intl says. */
function intlOffsetMinutes(zone: string, ms: number): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
    .formatToParts(ms)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(name ?? "");
  if (!match) throw new Error(`unexpected zone name ${name}`);
  const [, sign, hours = "0", minutes = "0"] = match;
  const total = Number(hours) * 60 + Number(minutes);
  return sign === "-" ? -total : total;
}

/** "2026-04-11 20:40:12": the wall clock, as Intl renders it. */
function intlWallClock(zone: string, ms: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

describe("the offset table", () => {
  const zones = Object.entries(ZONE_TABLE);

  it("knows UTC and the zone the cases use, and nothing it can't format", () => {
    expect(isKnownZone("Europe/London")).toBe(true);
    expect(isKnownZone("UTC")).toBe(true);
    expect(isKnownZone("Europe/Paris")).toBe(false);
    expect(isKnownZone("toString")).toBe(false);
  });

  it.each(zones)("%s: periods start at the table's start and run in order", (_, entry) => {
    expect(entry.periods[0]?.from).toBe(entry.covers.from);
    for (let i = 1; i < entry.periods.length; i++) {
      expect(entry.periods[i]!.from).toBeGreaterThan(entry.periods[i - 1]!.from);
      expect(entry.periods[i]!.from).toBeLessThan(entry.covers.to);
    }
  });

  it.each(zones)("%s: every period agrees with Intl at its edges", (zone, entry) => {
    entry.periods.forEach((period, i) => {
      const end = entry.periods[i + 1]?.from ?? entry.covers.to;
      for (const ms of [
        period.from,
        period.from + 1,
        Math.floor((period.from + end) / 2),
        end - 1,
      ]) {
        expect(zoneOffsetMinutes(zone, ms), `${zone} at ${new Date(ms).toISOString()}`).toBe(
          intlOffsetMinutes(zone, ms),
        );
      }
    });
  });

  it.each(zones)(
    "%s: agrees with Intl every hour it covers, offset and wall clock",
    (zone, entry) => {
      let checked = 0;
      for (let ms = entry.covers.from; ms < entry.covers.to; ms += HOUR) {
        const at = new Date(ms).toISOString();
        const ours = zoneOffsetMinutes(zone, ms);
        const theirs = intlOffsetMinutes(zone, ms);
        if (ours !== theirs)
          expect.fail(`${zone} at ${at}: table says ${ours}, Intl says ${theirs}`);
        const shown = formatInstant(ms, { zone });
        const wall = intlWallClock(zone, ms);
        if (!shown.startsWith(`${wall} `)) expect.fail(`${zone} at ${at}: ${shown}, Intl ${wall}`);
        checked++;
      }
      expect(checked).toBeGreaterThan(8000);
    },
  );

  it("refuses dates and zones it doesn't cover, loudly", () => {
    expect(() => zoneOffsetMinutes("Europe/London", Date.UTC(2025, 11, 31, 23))).toThrow(
      /no entry/,
    );
    expect(() => zoneOffsetMinutes("Europe/London", Date.UTC(2027, 0, 1))).toThrow(/no entry/);
    expect(() => zoneOffsetMinutes("Europe/Paris", Date.UTC(2026, 3, 11))).toThrow(
      /Unknown time zone/,
    );
  });
});

describe("formatInstant", () => {
  const evening = Date.parse("2026-04-11T19:40:12.345Z");

  it("renders UTC by default, exactly like the vendored clock", () => {
    expect(formatInstant(evening)).toBe("2026-04-11T19:40:12Z");
    expect(formatInstant(evening, { zone: "UTC" })).toBe("2026-04-11T19:40:12Z");
    expect(formatInstant(evening)).toBe(vendoredFormatInstant(evening));
  });

  it("renders local time with its offset: British Summer Time in April", () => {
    expect(formatInstant(evening, { zone: "Europe/London" })).toBe("2026-04-11 20:40:12 +01:00");
  });

  it("renders GMT before the clocks go forward", () => {
    expect(formatInstant(Date.parse("2026-03-02T09:00:00Z"), { zone: "Europe/London" })).toBe(
      "2026-03-02 09:00:00 +00:00",
    );
  });

  it("changes offset at exactly 01:00 UTC on the switch days", () => {
    const zone = "Europe/London";
    const spring = Date.UTC(2026, 2, 29, 1);
    expect(formatInstant(spring - 1000, { zone })).toBe("2026-03-29 00:59:59 +00:00");
    expect(formatInstant(spring, { zone })).toBe("2026-03-29 02:00:00 +01:00");
    const autumn = Date.UTC(2026, 9, 25, 1);
    expect(formatInstant(autumn - 1000, { zone })).toBe("2026-10-25 01:59:59 +01:00");
    expect(formatInstant(autumn, { zone })).toBe("2026-10-25 01:00:00 +00:00");
  });

  it("crosses midnight into the next local day", () => {
    expect(zonedParts(Date.parse("2026-04-11T23:30:00Z"), "Europe/London")).toMatchObject({
      year: 2026,
      month: 4,
      day: 12,
      hour: 0,
      minute: 30,
      offsetMinutes: 60,
    });
  });

  it("formats offsets with or without the colon", () => {
    expect(formatOffset(60)).toBe("+01:00");
    expect(formatOffset(0, "")).toBe("+0000");
    expect(formatOffset(-330)).toBe("-05:30");
  });
});
