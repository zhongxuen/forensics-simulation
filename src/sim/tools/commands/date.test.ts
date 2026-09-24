import { describe, expect, it } from "vitest";
import { errorCodes, fixtureState, run, text } from "../../__fixtures__/harness";

/**
 * Every `date +FORMAT` code, on the fixture's in-world clock (Monday 2 March 2026, 09:01:00 UTC).
 * Time is the thing an investigation is built on, so each code a player might copy out of a man
 * page or a lesson gets checked here, beside the vendored basics in system.test.ts.
 */
describe("date +FORMAT", () => {
  const format = (code: string) => text(run(fixtureState(), "date", `+${code}`));

  it("prints each date code", () => {
    expect(format("%Y|%m|%d|%e")).toBe("2026|03|02| 2");
    expect(format("%A %a %B %b")).toBe("Monday Mon March Mar");
    expect(format("%F")).toBe("2026-03-02");
  });

  it("prints each time code, in UTC", () => {
    expect(format("%H:%M:%S")).toBe("09:01:00");
    expect(format("%T %Z %z")).toBe("09:01:00 UTC +0000");
    expect(format("%s")).toBe(String(Date.UTC(2026, 2, 2, 9, 1, 0) / 1000));
  });

  it("prints tabs, newlines and a literal %, and leaves unknown codes as written", () => {
    expect(format("a%tb")).toBe("a\tb");
    expect(format("a%nb")).toBe("a\nb");
    expect(format("100%%")).toBe("100%");
    expect(format("%Q")).toBe("%Q");
  });

  it("prints the email format with -R, and treats UTC flags as the default", () => {
    expect(text(run(fixtureState(), "date", "-R"))).toBe("Mon, 02 Mar 2026 09:01:00 +0000");
    expect(text(run(fixtureState(), "date", "-u"))).toBe(text(run(fixtureState(), "date")));
  });

  it("refuses a second format, and an option it doesn't know", () => {
    expect(errorCodes(run(fixtureState(), "date", "+%Y", "+%m"))).not.toEqual([]);
    expect(errorCodes(run(fixtureState(), "date", "--nope"))).not.toEqual([]);
  });
});
