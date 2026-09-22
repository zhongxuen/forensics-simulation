import { formatInstant } from "../../core/clock";
import { stdout, success } from "../../core/output";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { DAYS, extraArgument, longTime, MONTHS, usage } from "./shared";

const NAME = "date";

const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const two = (n: number) => String(n).padStart(2, "0");

/** `date +FORMAT`: the common % codes. Anything unknown is printed as written. */
function strftime(format: string, ms: number): string {
  const d = new Date(ms);
  const codes: Record<string, () => string> = {
    Y: () => String(d.getUTCFullYear()),
    m: () => two(d.getUTCMonth() + 1),
    d: () => two(d.getUTCDate()),
    e: () => String(d.getUTCDate()).padStart(2, " "),
    H: () => two(d.getUTCHours()),
    M: () => two(d.getUTCMinutes()),
    S: () => two(d.getUTCSeconds()),
    A: () => FULL_DAYS[d.getUTCDay()] ?? "",
    a: () => DAYS[d.getUTCDay()] ?? "",
    B: () => FULL_MONTHS[d.getUTCMonth()] ?? "",
    b: () => MONTHS[d.getUTCMonth()] ?? "",
    Z: () => "UTC",
    z: () => "+0000",
    s: () => String(Math.floor(ms / 1000)),
    F: () => `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`,
    T: () => `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`,
    n: () => "\n",
    t: () => "\t",
    "%": () => "%",
  };
  return format.replace(/%(.)/g, (whole, code: string) => codes[code]?.() ?? whole);
}

export const date: Tool = {
  name: NAME,
  category: "system",
  help: {
    oneLiner: "show the computer's current date and time.",
    usage: ["date [options] [+format]"],
    description: [
      "date prints the date and time as this computer sees it. Practice machines run on in-world time: the story's date, moving on a second with every command you type.",
      "Give it a format starting with + to choose the layout: `date +%Y-%m-%d` prints something like 2026-03-02. %H:%M:%S is the time, %A the day's name.",
    ],
    options: [
      {
        flags: "-u, --utc",
        text: "Use UTC, the world's reference time zone (this computer already does).",
      },
      { flags: "-I, --iso-8601", text: "The international date format: 2026-03-02." },
      {
        flags: "+<format>",
        text: "Your own layout, with codes like %Y (year), %m (month), %d (day).",
      },
    ],
    examples: [
      { command: "date", text: "The date and time now." },
      { command: "date +%H:%M", text: "Only the hours and minutes." },
    ],
    concept: [
      "Investigations are built on time. Lining up log entries from different computers only works if their clocks agree, which is why real networks keep every clock in sync and record times in UTC.",
      "A computer whose clock is off makes its logs misleading, and some attackers change clocks on purpose to confuse a timeline.",
    ],
  },

  run(args, state, ctx) {
    const formats = args.filter((arg) => arg.startsWith("+"));
    const parsed = parseArgs(
      args.filter((arg) => !arg.startsWith("+")),
      [
        { names: ["-u", "--utc", "--universal"], key: "utc" },
        { names: ["-I", "--iso-8601"], key: "iso" },
        { names: ["-R", "--rfc-email"], key: "rfc" },
      ],
    );
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const [extra] = [...parsed.value.positionals, ...formats.slice(1)];
    if (extra !== undefined) return extraArgument(NAME, extra, state);
    const format = formats[0];
    if (format !== undefined) return success(state, [stdout(strftime(format.slice(1), ctx.now))]);
    if (hasSwitch(parsed.value, "iso"))
      return success(state, [stdout(formatInstant(ctx.now).slice(0, 10))]);
    if (hasSwitch(parsed.value, "rfc")) {
      return success(state, [stdout(strftime("%a, %d %b %Y %H:%M:%S +0000", ctx.now))]);
    }
    return success(state, [stdout(longTime(ctx.now))]);
  },
};
