import { describe, expect, it } from "vitest";
import { stripAnsi } from "../../core/ansi";
import { fieldValue, parseTime } from "./logq";
import { BURST, carveEvidence, carveState, runLine } from "./__fixtures__/carve-logs";
import { bareState, caseState, errorCodes, eventTypes, refs, text } from "./__fixtures__/evidence";

const TOTAL = carveEvidence().logs.length;

describe("logq", () => {
  it("prints matching records in their own shape, with the record's ref on every line", () => {
    const result = runLine(
      carveState(),
      "logq --source security --id 4625 --to 2026-04-11T19:02:00Z",
    );
    const out = text(result);
    expect(out).toContain(
      `logq (simulated) · 2 of ${TOTAL} records · security, event 4625 · times in UTC`,
    );
    expect(out).toContain("EventID      4625  An account failed to log on.");
    expect(out).toContain("TimeCreated  2026-04-11T08:14:55Z");
    expect(out).toContain("2 records. Narrow them with --where");
    const recordLines = result.output.filter((line) => line.ref);
    expect(recordLines).toHaveLength(26); // two records of thirteen lines each
    expect(new Set(refs(result))).toEqual(new Set(["log:security/1", "log:security/3"]));
    // Nothing but record lines carries a ref.
    for (const line of result.output.filter((l) => !l.ref)) {
      expect(line.text).not.toMatch(/^(EventID|TimeCreated|  IpAddress)/);
    }
  });

  it("shows the failed-logon burst in one --count-by", () => {
    const result = runLine(carveState(), "logq --source security --id 4625 --count-by IpAddress");
    const out = text(result);
    expect(out).toMatch(/10\.60\.0\.21 +40 +2026-04-11T19:02:00Z +2026-04-11T19:06:33Z/);
    expect(out).toMatch(/10\.60\.0\.27 +1 +2026-04-11T08:14:55Z/);
    expect(out.indexOf("10.60.0.21")).toBeLessThan(out.indexOf("10.60.0.27"));
    expect(out).toContain("2 different values across 41 records.");
    expect(out).toContain(
      "To read them: logq --source security --id 4625 --where IpAddress=10.60.0.21",
    );
    expect(refs(result)).toEqual([]); // a count is not one piece of evidence
    expect(result.events[0]).toEqual({
      type: "logs.queried",
      matched: 41,
      total: TOTAL,
      source: "security",
      eventId: 4625,
      countBy: "IpAddress",
    });
  });

  it("counts by a record's own properties, and says when a field isn't there", () => {
    expect(text(runLine(carveState(), "logq --count-by source"))).toMatch(/security +43/);
    expect(text(runLine(carveState(), "logq --count-by id"))).toMatch(/4625 +41/);
    const missing = text(runLine(carveState(), "logq --source dns --count-by IpAddress"));
    expect(missing).toMatch(/\(none\) +1/);
    expect(missing).toContain("None of these records has a field called IpAddress.");
  });

  it("keeps records matching every --where, ignoring capitals", () => {
    const result = runLine(
      carveState(),
      "logq --where ipaddress=10.60.0.21 --where TargetUserName=DISPATCH",
    );
    expect(new Set(refs(result))).toEqual(
      new Set([
        "log:security/5",
        "log:security/10",
        "log:security/15",
        "log:security/20",
        "log:security/25",
        "log:security/30",
        "log:security/35",
        "log:security/40",
        "log:security/43",
      ]),
    );
    expect(result.events[0]).toMatchObject({
      where: "ipaddress=10.60.0.21 and TargetUserName=DISPATCH",
    });
  });

  it("keeps a time window, and shows each source's local time with --zone local", () => {
    const utc = runLine(carveState(), "logq --from 2026-04-11T19:06:30Z --to 2026-04-11T19:07:52Z");
    expect(new Set(refs(utc))).toEqual(
      new Set(["log:security/42", "log:security/43", "log:dns/1"]),
    );
    expect(text(utc)).toContain("2026-04-11T19:07:52Z qf-srv-01 query A cdn-sync.example");

    const local = runLine(carveState(), "logq --source security --id 4624 --zone local");
    expect(text(local)).toContain("TimeCreated  2026-04-11 09:15:20 +01:00");
    expect(text(local)).toContain("times as each source showed them");
    // The dns source has no zone of its own, so it stays in UTC.
    expect(text(runLine(carveState(), "logq --source dns --zone local"))).toContain("19:07:52Z");
  });

  it("orders records by time, whatever their source", () => {
    const result = runLine(
      carveState(),
      "logq --from 2026-04-11T19:01:00Z --to 2026-04-11T19:02:00Z",
    );
    expect([...new Set(refs(result))]).toEqual(["log:firewall/1", "log:security/3"]);
  });

  it("explains an empty result, and evidence with no logs at all", () => {
    const none = runLine(carveState(), "logq --id 4720");
    expect(text(none)).toContain("No records matched.");
    expect(text(none)).toContain("logq --count-by id");
    expect(none.exitCode).toBe(0);
    const noLogs = runLine(caseState(), "logq");
    expect(text(noLogs)).toContain("This case's evidence has no log records.");
  });

  it("reports every usage problem", () => {
    const codes = (line: string) => errorCodes(runLine(carveState(), line));
    expect(codes("logq --source mail")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("logq --id four")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("logq --from yesterday")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("logq --to 2026-04-31")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("logq --from 2026-04-12 --to 2026-04-11")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("logq --where IpAddress")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("logq --where")).toEqual(["MISSING_ARGUMENT"]);
    expect(codes("logq --zone mars")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("logq --count-by 'two_words'")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("logq security")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("logq --level 4")).toEqual(["BAD_FLAG"]);
    expect(errorCodes(runLine(bareState(), "logq"))).toEqual(["EVIDENCE_NOT_LOADED"]);
  });
});

describe("parseTime", () => {
  it("reads UTC by default, an explicit offset, and a whole day", () => {
    expect(parseTime("2026-04-11T19:40:00Z", false)).toBe(Date.UTC(2026, 3, 11, 19, 40));
    expect(parseTime("2026-04-11 19:40", false)).toBe(Date.UTC(2026, 3, 11, 19, 40));
    expect(parseTime("2026-04-11T20:40+01:00", false)).toBe(Date.UTC(2026, 3, 11, 19, 40));
    expect(parseTime("2026-04-11T14:40-0500", false)).toBe(Date.UTC(2026, 3, 11, 19, 40));
    expect(parseTime("2026-04-11", false)).toBe(Date.UTC(2026, 3, 11));
    expect(parseTime("2026-04-11", true)).toBe(Date.UTC(2026, 3, 12) - 1);
    expect(parseTime("2028-02-29", false)).toBe(Date.UTC(2028, 1, 29));
  });

  it("refuses what isn't a time", () => {
    for (const bad of ["2026-02-29", "2026-13-01", "2026-04-11T24:00", "11/04/2026", ""]) {
      expect(parseTime(bad, false), bad).toBeUndefined();
    }
  });
});

describe("fieldValue", () => {
  it("finds a field in any capitals, then the record's own source, host and id", () => {
    const record = carveEvidence().logs.find((log) => log.eventId === 4624);
    expect(record && fieldValue(record, "targetusername")).toBe("dana");
    expect(record && fieldValue(record, "id")).toBe("4624");
    expect(record && fieldValue(record, "host")).toBe("qf-srv-01");
    expect(record && fieldValue(record, "source")).toBe("security");
    expect(record && fieldValue(record, "nothing")).toBeUndefined();
  });
});

describe("logq through a pipe", () => {
  const PIPE = `logq --source security --id 4625 | grep ${BURST.from}`;

  it("keeps each record's ref on the lines grep lets through", () => {
    const result = runLine(carveState(), PIPE);
    const lines = result.output.filter((line) => stripAnsi(line.text).includes(BURST.from));
    expect(lines).toHaveLength(BURST.count);
    expect(lines.every((line) => line.ref !== undefined)).toBe(true);
    expect(lines[0]?.ref).toBe("log:security/3");
    expect(lines[BURST.count - 1]?.ref).toBe("log:security/42");
  });

  it("lets pin point at what grep printed, not at logq's whole output", () => {
    const piped = runLine(carveState(), PIPE);
    const pinned = runLine(piped.state, "pin 1 -m 'first_guess'");
    expect(pinned.exitCode).toBe(0);
    expect(pinned.events[0]).toMatchObject({
      type: "board.pinned",
      ref: "log:security/3",
      line: `IpAddress         ${BURST.from}`,
      note: "first guess",
    });
    expect(text(pinned)).toContain(`from  ${PIPE}, line 1`);
    // With no line number, pin takes the last line that has a ref: the fortieth attempt.
    expect(runLine(piped.state, "pin").events[0]).toMatchObject({ ref: "log:security/42" });
  });

  it("keeps refs through head and tail too", () => {
    const result = runLine(carveState(), "logq --source firewall | head -n 3");
    expect(refs(result)).toEqual(["log:firewall/1"]);
    const last = runLine(carveState(), `${PIPE} | tail -n 2`);
    expect(refs(last)).toEqual(["log:security/41", "log:security/42"]);
  });

  it("drops refs once a line is changed or counted", () => {
    const counted = runLine(carveState(), `${PIPE} -c`);
    expect(text(counted)).toBe("40");
    expect(refs(counted)).toEqual([]);
    expect(errorCodes(runLine(counted.state, "pin"))).toEqual(["NOTHING_TO_PIN"]);
  });

  it("leaves pin's memory alone for a pipe that ran no evidence tool", () => {
    const logged = runLine(carveState(), "logq --source dns");
    const unrelated = runLine(
      logged.state,
      "cat /home/examiner/cases/case-01/handover.txt | grep Theo",
    );
    expect(runLine(unrelated.state, "pin").events[0]).toMatchObject({ ref: "log:dns/1" });
  });

  it("still emits logs.queried from inside a pipe", () => {
    expect(eventTypes(runLine(carveState(), PIPE))).toContain("logs.queried");
  });
});
