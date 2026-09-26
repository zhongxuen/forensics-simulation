import { z } from "zod";
import { CAST_IDS } from "../cast";
import { ContentIdSchema, uniqueIds } from "../schemas/ids";

/**
 * The case schema (docs/plan/03-case-format-and-generator.md §Case YAML).
 *
 * A case is one YAML file in `src/content/cases`. It holds the **ground-truth story** — who did
 * what, on which machine, at which instant — and everything the game wraps around it: the client's
 * letter, the briefing, objectives with three hints each, the report questions and the debrief.
 * Nobody writes evidence: `src/sim/evidence/generate` plays the story and produces the disk, the
 * memory and the logs, so the evidence can never disagree with the story.
 *
 * It follows `../hacker-simulation/src/content/schemas/mission.ts` field for field wherever the
 * two mean the same thing (`briefing`, `objectives` with `why` and `success`, three-tier `hints`,
 * `concepts`, `debrief` with `ethicsNote` and `defensiveTakeaway`, playful names for bonuses and
 * secrets), so anyone who has written a mission can write a case. Two differences, both forced:
 *
 * - `story` is the ground truth, not the character lines. The lines a character says during play
 *   are `beats`, with the same `on` / `speaker` / `text` shape a mission's `story` has.
 * - A case has `machines`, `evidence` and `report` instead of a mission's `scenario`.
 *
 * What this file checks: the shape of every field, the beginner rules (3 to 6 main objectives, 2 to
 * 4 learning goals, three hints each, a first tier that names no command), the ethics fields, and
 * the world rules (reserved addresses, `.example` domains, cast ids). What it leaves to others:
 * whether the story actually generates (`generate`, run by the case loader), whether the accepted
 * evidence resolves (the build), and whether the case can be played to the end (the solvability
 * test). Every object is strict, so `hnits:` fails with "Did you mean "hints"?" instead of being
 * quietly ignored.
 */

// ---------------------------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------------------------

/** Main (non-optional) objectives per case: small steps, frequent wins. */
export const MAIN_OBJECTIVES_MIN = 3;
export const MAIN_OBJECTIVES_MAX = 6;

/** "You'll learn…" bullets, mirrored one-for-one by the debrief's whatYouLearned. */
export const LEARNING_GOALS_MIN = 2;
export const LEARNING_GOALS_MAX = 4;

/** A case is one sitting. Longer than this and it wants splitting in two. */
export const CASE_MINUTES_MAX = 60;

/** A seed is a 32-bit unsigned whole number, like the engine's RNG uses. */
export const CASE_SEED_MAX = 4_294_967_295;

/**
 * Case ids are lowercase words joined by hyphens, like every other content id. A leading
 * underscore marks a **fixture**: a case that exists to exercise the pipeline and is never offered
 * to a player (`_fixture.yaml`).
 */
export const CASE_ID_PATTERN = /^_?[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A machine or device id, which also becomes its disk image's id, so refs can be split on ":". */
export const MACHINE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

/** The log sources evidence can come from (`src/sim/evidence/types.ts`). */
export const CASE_LOG_SOURCES = [
  "security",
  "sysmon-lite",
  "web-access",
  "firewall",
  "dns",
  "vpn",
] as const;

// ---------------------------------------------------------------------------------------------
// Messages written for authors
// ---------------------------------------------------------------------------------------------

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** Edit distance where swapping two neighbouring letters counts as one edit. */
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number) => rows[i]?.[j] ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      const row = rows[i];
      if (row) row[j] = best;
    }
  }
  return at(a.length, b.length);
}

/** The known name closest to `name`, if it's close enough to be a likely typo. */
function closestName(name: string, known: readonly string[]): string | undefined {
  const lower = name.toLowerCase();
  let best: { name: string; distance: number } | undefined;
  for (const candidate of known) {
    const distance = editDistance(lower, candidate.toLowerCase());
    if (distance < (best?.distance ?? Number.POSITIVE_INFINITY)) {
      best = { name: candidate, distance };
    }
  }
  const allowed = lower.length <= 4 ? 1 : 2;
  return best && best.distance <= allowed ? best.name : undefined;
}

function unknownFieldMessage(key: string, known: readonly string[]): string {
  const suggestion = closestName(key, known);
  return suggestion
    ? `Unknown field "${key}". Did you mean "${suggestion}"?`
    : `Unknown field "${key}". The fields allowed here are: ${known.join(", ")}.`;
}

const EXPECTED: Readonly<Record<string, string>> = {
  string: "text",
  number: "a number",
  int: "a whole number",
  boolean: "true or false",
  array: "a list",
  object: "a group of fields",
  record: "a group of fields",
};

function describeValue(input: unknown): string {
  if (input === null) return "an empty value";
  if (Array.isArray(input)) return "a list";
  if (typeof input === "string") {
    return `the text "${input.length > 40 ? `${input.slice(0, 40)}…` : input}"`;
  }
  if (typeof input === "number") return `the number ${input}`;
  if (typeof input === "boolean") return `${input}`;
  if (typeof input === "object") return "a group of fields";
  return typeof input;
}

/** Plain-English messages for the problems every field can have. */
export const authorErrorMap: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type": {
      if (issue.input === undefined) return "Missing: add this field.";
      const quoteHint =
        issue.expected === "string" && typeof issue.input !== "object"
          ? " Put it in quotes so YAML keeps it as text."
          : "";
      return `Should be ${EXPECTED[issue.expected] ?? issue.expected}, not ${describeValue(issue.input)}.${quoteHint}`;
    }
    case "too_small": {
      const minimum = Number(issue.minimum);
      if (issue.origin === "array") {
        return issue.exact
          ? `Should have exactly ${plural(minimum, "item")}.`
          : `Add at least ${plural(minimum, "item")}.`;
      }
      if (issue.origin === "string") {
        return minimum <= 1 ? "Can't be empty." : `Write at least ${minimum} characters.`;
      }
      return issue.inclusive === false
        ? `Should be more than ${minimum}.`
        : `Should be ${minimum} or more.`;
    }
    case "too_big": {
      const maximum = Number(issue.maximum);
      if (issue.origin === "array") return `Keep it to ${plural(maximum, "item")} or fewer.`;
      if (issue.origin === "string") return `Keep it to ${maximum} characters or fewer.`;
      return issue.inclusive === false
        ? `Should be less than ${maximum}.`
        : `Should be ${maximum} or less.`;
    }
    case "invalid_value": {
      const options = issue.values.map(String).join(", ");
      return issue.input === undefined
        ? `Missing: add one of: ${options}.`
        : `"${String(issue.input)}" isn't allowed here. Use one of: ${options}.`;
    }
    default:
      return undefined;
  }
};

/** Params for a schema whose missing value deserves more than "Missing: add this field". */
const required = (what: string) => ({
  error: (issue: { readonly input?: unknown }) =>
    issue.input === undefined ? `Missing: add ${what}.` : undefined,
});

/** A strict group of fields: unknown keys fail, with a "did you mean" for typos. */
function strict<T extends z.core.$ZodLooseShape>(shape: T, what: string) {
  const known = Object.keys(shape);
  return z.strictObject(shape, {
    error: (issue) => {
      if (issue.code === "unrecognized_keys") {
        return issue.keys.map((key) => unknownFieldMessage(key, known)).join(" ");
      }
      if (issue.code === "invalid_type") {
        return issue.input === undefined
          ? `Missing: add ${what}.`
          : `Should be ${what}, written as a group of \`name: value\` lines, not ${describeValue(issue.input)}.`;
      }
      return undefined;
    },
  });
}

/** Required, non-blank text. `what` finishes "Missing: add …". */
function text(what: string) {
  return z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? `Missing: add ${what}.`
          : `Should be text (${what}), not ${describeValue(issue.input)}.`,
    })
    .trim()
    .min(1, `Can't be empty: add ${what}.`);
}

/** Like `text`, on a single line. */
const oneLine = (what: string) =>
  text(what).refine((value) => !/[\r\n]/.test(value), "Keep it to one line.");

// ---------------------------------------------------------------------------------------------
// The world rules (docs/plan/99-reference.md)
// ---------------------------------------------------------------------------------------------

/**
 * Address ranges that can never be a real machine on the internet. The same list the engine keeps
 * in `src/sim/net/ip.ts`, written out again because `src/content` may not import the engine's
 * runtime; `tests/content` checks the two agree.
 */
export const RESERVED_RANGES: readonly (readonly [string, number])[] = [
  ["10.0.0.0", 8],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
];

/** Domains reserved so a name can never point at a real organisation (RFC 2606, RFC 6761). */
export const RESERVED_DOMAINS = [
  "example",
  "example.com",
  "example.net",
  "example.org",
  "test",
  "invalid",
  "localhost",
  "internal",
  "local",
  "home.arpa",
];

const IPV4 = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;

function toNumber(ip: string): number | undefined {
  const parts = ip.split(".");
  if (parts.length !== 4) return undefined;
  let value = 0;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return undefined;
    const octet = Number(part);
    if (octet > 255) return undefined;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/** True when every part of the story may safely use this address. */
export function isReservedAddress(ip: string): boolean {
  const value = toNumber(ip);
  if (value === undefined) return false;
  return RESERVED_RANGES.some(([base, prefix]) => {
    const start = toNumber(base);
    if (start === undefined) return false;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (value & mask) >>> 0 === start;
  });
}

/** True for a name that can only ever be made up: `quillfen.example`, `localhost`. */
export function isFictionalHostname(name: string): boolean {
  const lower = name.toLowerCase().replace(/\.$/, "");
  if (lower === "") return false;
  if (!lower.includes(".")) return true;
  return RESERVED_DOMAINS.some((domain) => lower === domain || lower.endsWith(`.${domain}`));
}

/** The host part of a URL, or of a bare name: "https://x.example/a" → "x.example". */
export function hostOfUrl(url: string): string {
  const withoutScheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return (withoutScheme.split(/[/?#]/)[0] ?? withoutScheme).split(":")[0] ?? "";
}

/** Every address in `value` that isn't in a reserved range. */
export function unreservedAddresses(value: string): string[] {
  return [...value.matchAll(IPV4)].map((match) => match[0]).filter((ip) => !isReservedAddress(ip));
}

// ---------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * An instant, from a time written with an explicit zone: `2026-04-11T19:42:03Z` or
 * `2026-04-11 20:42:03+01:00`. A time without one would mean something different on every machine
 * that read the file, so it is refused.
 */
export function parseCaseTime(value: string): number | undefined {
  if (!ISO_WITH_ZONE.test(value.trim())) return undefined;
  const ms = Date.parse(value.trim().replace(" ", "T"));
  return Number.isFinite(ms) ? ms : undefined;
}

const TimeSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? "Missing: add the time, with its zone, like 2026-04-11T19:42:03Z."
        : 'Write the time in quotes, with its zone, like "2026-04-11T19:42:03Z".',
  })
  .refine(
    (value) => parseCaseTime(value) !== undefined,
    "Write the time with an explicit zone, like 2026-04-11T19:42:03Z or 2026-04-11 20:42:03+01:00. Without one it would mean a different moment on every machine.",
  );

/** The same, turned into milliseconds since the Unix epoch, which is what the generator takes. */
const InstantSchema = TimeSchema.transform((value) => parseCaseTime(value) as number);

// ---------------------------------------------------------------------------------------------
// Story actions
// ---------------------------------------------------------------------------------------------

/**
 * `user:dana`, `attacker`, `system` or `analyst`. Who is doing the thing — which is not always who
 * the account says: the whole of Case 2 turns on the attacker using the bookkeeper's account.
 */
const ActorSchema = z
  .string(required("who did it: user:<account>, attacker, system or analyst"))
  .refine(
    (value) => /^user:[^\s:]+$/.test(value) || ["attacker", "system", "analyst"].includes(value),
    "Write the actor as user:<account> (like user:dana), or as attacker, system or analyst.",
  )
  .transform((value) => {
    if (value.startsWith("user:")) {
      return { kind: "user", account: value.slice("user:".length) } as const;
    }
    if (value === "attacker") return { kind: "attacker" } as const;
    if (value === "system") return { kind: "system" } as const;
    return { kind: "analyst" } as const;
  });

const machineRef = (what: string) =>
  z
    .string(required(what))
    .regex(
      MACHINE_ID_PATTERN,
      "Use lowercase letters, digits, dots, dashes and underscores, like `qf-lt-07`.",
    );

const WindowsPathSchema = text("the path").regex(
  /^[A-Za-z]:\\/,
  "Use a full Windows path, starting with a drive letter, like C:\\Users\\dana\\Documents\\inv-0412.pdf.",
);

const AddressSchema = text("the address").refine(
  (value) => isReservedAddress(value.split(":")[0] ?? value),
  "Only reserved addresses may appear in a case: 10.x, 172.16-31.x, 192.168.x, 127.x, or the documentation ranges 192.0.2.x, 198.51.100.x and 203.0.113.x (RFC 5737).",
);

const UrlSchema = text("the address of the page").refine(
  (value) => isFictionalHostname(hostOfUrl(value)),
  "Only made-up names may appear in a case. Use a name under `.example`, like https://updates.example/.",
);

const HostnameSchema = text("the name").refine(
  isFictionalHostname,
  "Only made-up names may appear in a case. Use a name under `.example`, like `cdn-sync.example`.",
);

const LOGON_TYPES = ["interactive", "network", "service", "unlock", "remote"] as const;
const LogonTypeSchema = z.enum(
  LOGON_TYPES,
  required(`how they signed in, one of: ${LOGON_TYPES.join(", ")}`),
);

const accountName = (what: string) => text(what).max(64, "Keep an account name short.");

/** The fields every action has, before its own are added. */
const actionBase = {
  id: z.optional(ContentIdSchema),
  at: InstantSchema,
  actor: ActorSchema,
  on: machineRef("the machine it happened on"),
  note: z.optional(oneLine("a note to yourself, never shown to a player")),
};

const action = <K extends string, T extends z.core.$ZodLooseShape>(kind: K, shape: T) =>
  strict({ ...actionBase, do: z.literal(kind), ...shape }, `a ${kind} action`);

const firewallShape = {
  dst: AddressSchema,
  dpt: text("the port it was headed for"),
  src: z.optional(AddressSchema),
  spt: z.optional(text("the port it came from")),
  proto: z.optional(z.enum(["tcp", "udp"])),
  bytes: z.optional(text("how many bytes went through")),
  rule: z.optional(text("which rule decided")),
};

const ACTION_SCHEMAS = {
  logon: action("logon", {
    account: accountName("the account that signed in"),
    type: LogonTypeSchema,
    from: z.optional(AddressSchema),
    workstation: z.optional(text("the machine name it came from")),
    elevated: z.optional(z.boolean()),
  }),
  logoff: action("logoff", { account: accountName("the account that signed out") }),
  "failed-logon": action("failed-logon", {
    account: accountName("the account that was tried"),
    type: LogonTypeSchema,
    from: z.optional(AddressSchema),
    reason: z.optional(oneLine("why it was refused, in the log's words")),
  }),
  "create-account": action("create-account", {
    account: accountName("the account that was made"),
    by: z.optional(accountName("the account that made it")),
  }),
  "add-to-group": action("add-to-group", {
    account: accountName("the account that was added"),
    group: text("the group it was added to"),
    by: z.optional(accountName("the account that added it")),
  }),
  "create-file": action("create-file", {
    path: WindowsPathSchema,
    content: z.optional(z.string()),
    owner: z.optional(accountName("the account the file belongs to")),
  }),
  "modify-file": action("modify-file", {
    path: WindowsPathSchema,
    content: z.optional(z.string()),
    append: z.optional(z.string()),
  }),
  "read-file": action("read-file", { path: WindowsPathSchema }),
  "delete-file": action("delete-file", { path: WindowsPathSchema }),
  "overwrite-clusters": action("overwrite-clusters", {
    path: WindowsPathSchema,
    by: z.optional(WindowsPathSchema),
    content: z.optional(z.string()),
    keep: z.optional(z.int().min(1)),
  }),
  "usb-insert": action("usb-insert", {
    device: machineRef("an id for the drive, like `qf-usb-01`"),
    letter: z.optional(z.string().regex(/^[D-Za-z]$/, "Use one drive letter, D to Z.")),
    model: z.optional(text("what the drive says on it")),
    serial: z.optional(text("its serial number")),
  }),
  "copy-to-usb": action("copy-to-usb", {
    path: WindowsPathSchema,
    device: z.optional(machineRef("which drive it went to")),
    to: z.optional(WindowsPathSchema),
  }),
  browse: action("browse", {
    url: UrlSchema,
    account: z.optional(accountName("whose browser it was")),
  }),
  download: action("download", {
    url: UrlSchema,
    path: WindowsPathSchema,
    content: z.optional(z.string()),
  }),
  "run-process": action("run-process", {
    name: text("the program's name, like `dispatch-sync.exe`"),
    path: z.optional(WindowsPathSchema),
    parent: z.optional(text("the name of the program that started it")),
    cmdline: z.optional(text("the whole command line")),
    user: z.optional(accountName("the account it runs as")),
    pid: z.optional(z.int().min(1)),
    threads: z.optional(z.int().min(1)),
    unlinked: z.optional(z.boolean()),
  }),
  inject: action("inject", {
    into: text("the process it wrote into: a name or a pid"),
    protection: z.optional(
      z.enum(["PAGE_EXECUTE_READWRITE", "PAGE_EXECUTE_READ", "PAGE_READWRITE"]),
    ),
    preview: z.optional(z.string()),
    size: z.optional(z.int().min(1)),
  }),
  connect: action("connect", {
    remote: AddressSchema,
    proto: z.optional(z.enum(["TCPv4", "UDPv4"])),
    local: z.optional(AddressSchema),
    process: z.optional(text("the process that opened it: a name or a pid")),
    state: z.optional(z.enum(["ESTABLISHED", "LISTENING", "CLOSE_WAIT", "SYN_SENT"])),
    every: z.optional(z.int().min(1).max(86_400)),
    times: z.optional(z.int().min(1).max(60)),
  }),
  "firewall-allow": action("firewall-allow", firewallShape),
  "firewall-block": action("firewall-block", firewallShape),
  "dns-query": action("dns-query", {
    query: HostnameSchema,
    type: z.optional(z.enum(["A", "AAAA", "CNAME", "TXT", "MX", "PTR"])),
    answer: z.optional(AddressSchema),
    client: z.optional(AddressSchema),
  }),
  "web-request": action("web-request", {
    path: text("the page that was asked for"),
    method: z.optional(z.enum(["GET", "POST", "PUT", "DELETE", "HEAD"])),
    status: z.optional(text("the answer's status, like `200`")),
    clientIp: z.optional(AddressSchema),
    userAgent: z.optional(text("what the caller said it was")),
    bytes: z.optional(text("how big the answer was")),
    referer: z.optional(UrlSchema),
    user: z.optional(accountName("the account it was signed in as")),
  }),
  "clock-skew": action("clock-skew", {
    minutes: z.int(required("how many minutes the clock is out by, ahead as a positive number")),
  }),
  "capture-memory": action("capture-memory", {
    id: z.optional(machineRef("an id for the capture")),
  }),
  "hand-over": action("hand-over", {
    item: z.optional(machineRef("what was handed over")),
    by: text("who handed it over"),
    hashes: z.optional(z.boolean()),
  }),
} as const;

/** The same schemas as a tuple, which is what a discriminated union takes. */
const ACTION_OPTIONS = [
  ACTION_SCHEMAS.logon,
  ACTION_SCHEMAS.logoff,
  ACTION_SCHEMAS["failed-logon"],
  ACTION_SCHEMAS["create-account"],
  ACTION_SCHEMAS["add-to-group"],
  ACTION_SCHEMAS["create-file"],
  ACTION_SCHEMAS["modify-file"],
  ACTION_SCHEMAS["read-file"],
  ACTION_SCHEMAS["delete-file"],
  ACTION_SCHEMAS["overwrite-clusters"],
  ACTION_SCHEMAS["usb-insert"],
  ACTION_SCHEMAS["copy-to-usb"],
  ACTION_SCHEMAS.browse,
  ACTION_SCHEMAS.download,
  ACTION_SCHEMAS["run-process"],
  ACTION_SCHEMAS.inject,
  ACTION_SCHEMAS.connect,
  ACTION_SCHEMAS["firewall-allow"],
  ACTION_SCHEMAS["firewall-block"],
  ACTION_SCHEMAS["dns-query"],
  ACTION_SCHEMAS["web-request"],
  ACTION_SCHEMAS["clock-skew"],
  ACTION_SCHEMAS["capture-memory"],
  ACTION_SCHEMAS["hand-over"],
] as const;

export const STORY_ACTION_KINDS = Object.keys(ACTION_SCHEMAS).sort();

/**
 * One story action. Fields may be written at the top level or grouped under `with:`, because both
 * read well depending on the action, so they are merged before the action's own schema sees them.
 */
const StoryActionSchema = z.preprocess(
  (input) => {
    if (!isRecord(input) || !isRecord(input.with)) return input;
    const { with: grouped, ...rest } = input;
    return { ...rest, ...grouped };
  },
  z.discriminatedUnion("do", ACTION_OPTIONS, {
    error: (issue) => {
      if (issue.input === undefined) return "Missing: add a story action.";
      if (issue.code === "invalid_union") {
        const kind = isRecord(issue.input) ? issue.input.do : undefined;
        if (kind === undefined) {
          return `Start the action with do: one of ${STORY_ACTION_KINDS.join(", ")}.`;
        }
        const suggestion = closestName(String(kind), STORY_ACTION_KINDS);
        return `"${String(kind)}" isn't something a story can do.${suggestion ? ` Did you mean "${suggestion}"?` : ""} The actions are: ${STORY_ACTION_KINDS.join(", ")}.`;
      }
      if (issue.code === "invalid_type") {
        return `An action is a group of fields starting with at, actor, on and do, not ${describeValue(issue.input)}.`;
      }
      return undefined;
    },
  }),
);

export type StoryActionInput = z.input<typeof StoryActionSchema>;
export type CaseStoryAction = z.output<typeof StoryActionSchema>;

// ---------------------------------------------------------------------------------------------
// Machines, noise and what is handed over
// ---------------------------------------------------------------------------------------------

const MachineSchema = strict(
  {
    id: machineRef("the machine's name, like `qf-lt-07`"),
    kind: z.enum(
      ["windows-laptop", "windows-server", "linux-workstation"],
      required("what kind of machine it is"),
    ),
    baseline: text("the clean machine it is built from, like `office-laptop-v1`"),
    zone: text("the machine's own time zone, like `Europe/London`"),
    ip: z.optional(AddressSchema),
    accounts: z.optional(z.array(accountName("an account on the machine"))),
    device: z.optional(
      strict(
        {
          model: z.optional(text("what the drive says on it")),
          serial: z.optional(text("its serial number")),
        },
        "the drive's details for the evidence bag",
      ),
    ),
  },
  "a machine (id, kind, baseline, zone)",
);

const NoiseSchema = strict(
  {
    profile: z.enum(
      ["office-day", "quiet-night", "server-idle"],
      required("which kind of ordinary day to put around the story"),
    ),
    density: z.enum(["none", "low", "medium", "high"], required("how much of it there is")),
    /** Whether it carries on through Saturday and Sunday. On unless a case says otherwise. */
    weekends: z.optional(z.boolean()),
  },
  "the background activity (profile, density)",
);

const EvidenceSchema = strict(
  {
    disks: z.array(machineRef("a machine or drive whose disk was imaged")).default([]),
    logs: z.array(z.enum(CASE_LOG_SOURCES)).default([]),
    memory: z.array(machineRef("a machine whose memory was captured")).default([]),
    zones: z.optional(
      z.partialRecord(
        z.enum([...CASE_LOG_SOURCES, "disk"]),
        text("the zone that source shows its times in"),
      ),
    ),
  },
  "what the client handed over (disks, logs, memory)",
);

/** The two files every case folder already has, which a document may not replace. */
export const CASE_FOLDER_FILES = ["letter.txt", "handover.txt"] as const;

const DocumentSchema = strict(
  {
    file: z
      .string(required("the file name it has in the case folder, like `door-log.txt`"))
      .regex(
        /^[a-z0-9][a-z0-9-]*\.txt$/,
        "Use a lowercase .txt file name with hyphens, like `door-log.txt`.",
      )
      .refine(
        (file) => !(CASE_FOLDER_FILES as readonly string[]).includes(file),
        `Every case folder already has ${CASE_FOLDER_FILES.join(" and ")}. Pick another name.`,
      ),
    content: text("what the document says"),
  },
  "a document (file, content)",
);

// ---------------------------------------------------------------------------------------------
// Beats, objectives, hints
// ---------------------------------------------------------------------------------------------

const SpeakerSchema = z.enum(CAST_IDS, {
  error: (issue) =>
    issue.input === undefined
      ? `Missing: add the speaker, one of: ${CAST_IDS.join(", ")}.`
      : `"${String(issue.input)}" isn't in the cast. Use one of: ${CAST_IDS.join(", ")} (docs/plan/99-reference.md).`,
});

const BeatTriggerSchema = z.union(
  [
    z.literal("start"),
    z.literal("complete"),
    strict({ objective: ContentIdSchema }, "the objective that plays this beat"),
    strict({ question: ContentIdSchema }, "the report question that plays this beat"),
  ],
  {
    error: () =>
      "Say when the line plays: start, complete, { objective: <id> } or { question: <id> }.",
  },
);

/** A character line shown during play. The same shape a mission's story beats have. */
const BeatSchema = strict(
  { on: BeatTriggerSchema, speaker: SpeakerSchema, text: text("what the character says") },
  "a beat (on, speaker, text)",
);

const CommandRunCheckSchema = strict(
  {
    kind: z.literal("commandRun"),
    pattern: z
      .string()
      .min(1)
      .refine((pattern) => {
        try {
          new RegExp(pattern);
          return true;
        } catch {
          return false;
        }
      }, "This isn't a regular expression JavaScript can read. Check the brackets and backslashes."),
    anyExitCode: z.optional(z.boolean()),
  },
  "a command check",
);

const PinnedCheckSchema = strict(
  {
    kind: z.literal("pinned"),
    /** An evidence pattern, the same shape a report question's acceptedEvidence uses. */
    evidence: text("the evidence that has to be on the board, as a pattern"),
  },
  "a pinned-evidence check",
);

const ReportedCheckSchema = strict(
  { kind: z.literal("reported"), question: ContentIdSchema },
  "a report check",
);

const AnswerCheckSchema = strict(
  {
    kind: z.literal("answer"),
    accept: z.array(text("an accepted answer")).min(1, "Add at least one accepted answer."),
    choices: z.optional(z.array(text("a choice")).min(2, "Give the learner at least two choices.")),
  },
  "an answer check",
);

/**
 * The rules a `custody` check can ask about. Each is a pure check on the order of the run's chain
 * of custody (`src/features/cases/custody`), which is built from the engine's events: something a
 * `commandRun` pattern can't see, because it's about what came *before* what.
 *
 * - `hashed-before-analysing`: a hash was taken (and, if checked, matched) before anything opened
 *   the evidence — no original read, examination, recovery or pin came first.
 */
export const CUSTODY_RULES = ["hashed-before-analysing"] as const;
export type CustodyRule = (typeof CUSTODY_RULES)[number];

const CustodyCheckSchema = strict(
  {
    kind: z.literal("custody"),
    rule: z.enum(CUSTODY_RULES, required(`the rule, one of: ${CUSTODY_RULES.join(", ")}`)),
  },
  "a custody check",
);

export interface CheckGroup {
  kind: "all" | "any";
  of: ObjectiveCheck[];
}

export type ObjectiveCheck =
  | z.output<typeof CommandRunCheckSchema>
  | z.output<typeof PinnedCheckSchema>
  | z.output<typeof ReportedCheckSchema>
  | z.output<typeof AnswerCheckSchema>
  | z.output<typeof CustodyCheckSchema>
  | CheckGroup;

export interface CheckGroupInput {
  kind: "all" | "any";
  of: ObjectiveCheckInput[];
}

export type ObjectiveCheckInput =
  | z.input<typeof CommandRunCheckSchema>
  | z.input<typeof PinnedCheckSchema>
  | z.input<typeof ReportedCheckSchema>
  | z.input<typeof AnswerCheckSchema>
  | z.input<typeof CustodyCheckSchema>
  | CheckGroupInput;

export const OBJECTIVE_CHECK_KINDS = [
  "commandRun",
  "pinned",
  "reported",
  "answer",
  "custody",
  "all",
  "any",
] as const;

export const ObjectiveCheckSchema: z.ZodType<ObjectiveCheck, ObjectiveCheckInput> = z.lazy(() =>
  z.discriminatedUnion(
    "kind",
    [
      CommandRunCheckSchema,
      PinnedCheckSchema,
      ReportedCheckSchema,
      AnswerCheckSchema,
      CustodyCheckSchema,
      CheckGroupSchema,
    ],
    {
      error: (issue) => {
        if (issue.input === undefined) return "Missing: add a check that says when this is done.";
        if (issue.code === "invalid_union") {
          const kind = isRecord(issue.input) ? issue.input.kind : undefined;
          return kind === undefined
            ? `Start the check with kind: one of ${OBJECTIVE_CHECK_KINDS.join(", ")}.`
            : `"${String(kind)}" isn't a kind of check. Use one of: ${OBJECTIVE_CHECK_KINDS.join(", ")}.`;
        }
        return undefined;
      },
    },
  ),
);

const CheckGroupSchema = strict(
  {
    kind: z.enum(["all", "any"]),
    of: z.array(ObjectiveCheckSchema).min(1, "Put at least one check inside."),
  },
  "a group of checks",
);

/** One step of the case. `optional` is a bonus; `hidden` a secret, which is always optional. */
const ObjectiveSchema = strict(
  {
    id: ContentIdSchema,
    name: z.optional(
      oneLine("a playful name, 1 to 3 words")
        .max(30, "Keep the name to 30 characters or fewer.")
        .refine(
          (name) => name.split(/\s+/).length <= 3,
          "Keep the name to 1 to 3 words, like Curious Cat.",
        ),
    ),
    description: text("what to do, starting with a verb"),
    why: text("one line on why this step matters"),
    success: text("the celebration line shown when it's done"),
    check: ObjectiveCheckSchema,
    optional: z.optional(z.boolean()),
    hidden: z.boolean().default(false),
  },
  "an objective",
)
  .superRefine((objective, ctx) => {
    if (objective.hidden && objective.optional === false) {
      ctx.addIssue({
        code: "custom",
        path: ["optional"],
        message: "Hidden objectives are always optional. Remove optional: false.",
      });
    }
    const bonus = objective.hidden || objective.optional === true;
    if (bonus && objective.name === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: `Missing: add a playful name, 1 to 3 words, like "Curious Cat". Every ${objective.hidden ? "secret" : "bonus objective"} has one.`,
      });
    }
    if (!bonus && objective.name !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message:
          "Only bonus objectives and secrets have a name. Remove it, or mark the objective optional.",
      });
    }
  })
  .transform(({ optional, ...objective }) => ({
    ...objective,
    optional: objective.hidden || optional === true,
  }));

export type Objective = z.output<typeof ObjectiveSchema>;

const HINT_TIERS_MESSAGE =
  "Write exactly three hints, in order: a nudge, then the idea, then a near-answer.";

/**
 * Three tiers per objective. The first must name no command: a beginner who is stuck needs to be
 * pointed at the *question*, not handed the answer, and the voice rules put every command in code
 * font, so a backtick in the first tier is a reliable sign it gives too much away.
 */
const HintTiersSchema = z
  .tuple(
    [
      text("the first hint: a nudge, naming no command"),
      text("the second hint: the idea"),
      text("the third hint: a near-answer"),
    ],
    {
      error: (issue) =>
        issue.code === "too_small" || issue.code === "too_big" || issue.code === "invalid_type"
          ? HINT_TIERS_MESSAGE
          : undefined,
    },
  )
  .superRefine((tiers, ctx) => {
    if (tiers[0].includes("`")) {
      ctx.addIssue({
        code: "custom",
        path: [0],
        message:
          "The first hint names a command (it has something in code font). Point at what to think about instead, and keep the command for the second or third hint.",
      });
    }
  });

// ---------------------------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------------------------

export const REPORT_ANSWER_TYPES = [
  "choice",
  "timestamp",
  "evidence-pick",
  "account",
  "host",
] as const;

/**
 * One question the report asks, with the answer key beside it. The answers ship with the case on
 * purpose, the way a mission's do: nothing is recorded anywhere, so reading them only spoils your
 * own case. What keeps the exercise honest is `acceptedEvidence` — an answer has to point at the
 * evidence that supports it, which is the habit the whole game is teaching.
 */
const ReportQuestionSchema = strict(
  {
    id: ContentIdSchema,
    ask: text("the question, as the player reads it"),
    type: z.enum(
      REPORT_ANSWER_TYPES,
      required(`the kind of answer, one of: ${REPORT_ANSWER_TYPES.join(", ")}`),
    ),
    answer: text("the answer"),
    choices: z.optional(z.array(text("a choice")).min(2, "Give at least two choices.")),
    toleranceSeconds: z.optional(z.int().min(0).max(86_400)),
    acceptedEvidence: z
      .array(text("an evidence pattern"), required("the evidence an answer has to point at"))
      .min(1, "Add at least one evidence pattern: every answer points at evidence."),
    explain: text("what this answer means, without giving the next one away"),
    answerFrom: z.optional(ContentIdSchema),
    /**
     * For a choice question that is a **choice beat** (docs/plan/99-reference.md, rule 6): what a
     * character says when the player picks one of the other choices. It is the consequence,
     * shown on the debrief in place of "not yet", and Change your report offers the choice again.
     */
    feedback: z.optional(
      z
        .array(
          strict(
            {
              choice: text("the choice this answers, exactly as it is written in choices"),
              speaker: SpeakerSchema,
              text: text("what the character says about that choice"),
            },
            "feedback on a choice (choice, speaker, text)",
          ),
        )
        .min(1, "Add at least one piece of feedback, or leave feedback out."),
    ),
  },
  "a report question",
)
  .superRefine((question, ctx) => {
    const problem = (path: PropertyKey[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    if (question.type === "choice") {
      if (!question.choices) {
        problem(["choices"], "Missing: a choice question needs its choices.");
      } else if (!question.choices.includes(question.answer)) {
        problem(
          ["answer"],
          `"${question.answer}" isn't one of the choices. The answer has to be one of: ${question.choices.join(", ")}.`,
        );
      }
    } else if (question.choices) {
      problem(["choices"], `Only a choice question has choices. This one is a ${question.type}.`);
    }

    const seen = new Set<string>();
    question.feedback?.forEach((item, index) => {
      if (question.type !== "choice") {
        problem(
          ["feedback"],
          `Only a choice question has feedback. This one is a ${question.type}.`,
        );
      } else if (item.choice === question.answer) {
        problem(
          ["feedback", index, "choice"],
          "That is the answer. Feedback is for the other choices; the answer's own words are its explain.",
        );
      } else if (!question.choices?.includes(item.choice)) {
        problem(["feedback", index, "choice"], `"${item.choice}" isn't one of the choices.`);
      }
      if (seen.has(item.choice)) {
        problem(["feedback", index, "choice"], `Two pieces of feedback answer "${item.choice}".`);
      }
      seen.add(item.choice);
    });

    if (question.type === "timestamp") {
      if (parseCaseTime(question.answer) === undefined) {
        problem(["answer"], "Write the answer as a time with its zone, like 2026-04-11T19:42:03Z.");
      }
    } else if (question.toleranceSeconds !== undefined) {
      problem(
        ["toleranceSeconds"],
        `Only a timestamp question has a tolerance. This one is a ${question.type}.`,
      );
    }
  })
  .transform((question) => ({
    ...question,
    /** The answer as an instant, for timestamp questions. */
    ...(question.type === "timestamp"
      ? { answerAt: parseCaseTime(question.answer) as number }
      : {}),
  }));

export type ReportQuestion = z.output<typeof ReportQuestionSchema>;

// ---------------------------------------------------------------------------------------------
// The case
// ---------------------------------------------------------------------------------------------

const caseIdSchema = (what: string) =>
  z
    .string(required(what))
    .regex(CASE_ID_PATTERN, "Use lowercase letters, digits and single hyphens, like `case-01`.");

/**
 * What a case and the sandbox both hold their story to: every machine named once, every action on
 * a machine that exists, action ids unique, and every disk or memory capture handed over from a
 * machine (or a drive the story plugs in). Returns the story's action ids, for `answerFrom`.
 */
function checkWorld(
  entry: {
    readonly machines: readonly { readonly id: string }[];
    readonly story: readonly CaseStoryAction[];
    readonly evidence: { readonly disks: readonly string[]; readonly memory: readonly string[] };
  },
  problem: (path: PropertyKey[], message: string) => void,
): ReadonlySet<string> {
  const machineIds = new Set<string>();
  entry.machines.forEach((machine, index) => {
    if (machineIds.has(machine.id)) {
      problem(["machines", index, "id"], `Two machines are called "${machine.id}".`);
    }
    machineIds.add(machine.id);
  });

  const deviceIds = new Set(
    entry.story.filter((item) => item.do === "usb-insert").map((item) => item.device),
  );
  const actionIds = new Set<string>();
  entry.story.forEach((item, index) => {
    if (!machineIds.has(item.on)) {
      const suggestion = closestName(item.on, [...machineIds]);
      problem(
        ["story", index, "on"],
        `There's no machine called "${item.on}".${suggestion ? ` Did you mean "${suggestion}"?` : ""} The machines are: ${[...machineIds].join(", ")}.`,
      );
    }
    if (item.id !== undefined) {
      if (actionIds.has(item.id)) {
        problem(["story", index, "id"], `Two story actions have the id "${item.id}".`);
      }
      actionIds.add(item.id);
    }
  });

  for (const [field, ids] of [
    ["disks", entry.evidence.disks],
    ["memory", entry.evidence.memory],
  ] as const) {
    ids.forEach((id, index) => {
      if (machineIds.has(id) || deviceIds.has(id)) return;
      problem(
        ["evidence", field, index],
        `"${id}" isn't a machine in this case, or a drive the story plugs in. The machines are: ${[...machineIds].join(", ")}.`,
      );
    });
  }
  return actionIds;
}

export const CaseSchema = strict(
  {
    /** Stable and never reused. Matches the file name: `case-01` lives in `case-01.yaml`. */
    id: caseIdSchema("the id: the file name without .yaml, like `case-01`"),
    /** Bump when objectives or report questions change; saved runs key on it. */
    version: z.number(required("the version: 1 for a new case")).int().min(1),
    title: text("the case's name").max(80, "Keep the title to 80 characters or fewer."),
    client: strict(
      {
        org: text("the client: the organisation that asked for help"),
        signedBy: text("who signed the letter, with their job"),
        letter: text("the letter itself, which the player can read on the workstation"),
      },
      "the client (org, signedBy, letter)",
    ),
    estimatedMinutes: z
      .number(required("estimatedMinutes: about how long the case takes"))
      .int()
      .min(1)
      .max(CASE_MINUTES_MAX, `A case is one sitting: ${CASE_MINUTES_MAX} minutes or fewer.`),
    seed: z
      .number(required("the seed: any whole number. The same seed always builds the same evidence"))
      .int()
      .min(0)
      .max(CASE_SEED_MAX, `The seed is a whole number from 0 to ${CASE_SEED_MAX}.`),
    hook: oneLine("the hook: one line that makes a beginner want to open the case"),
    learningGoals: z
      .array(
        text("a learning goal"),
        required(
          `the learning goals: ${LEARNING_GOALS_MIN} to ${LEARNING_GOALS_MAX} plain-language lines`,
        ),
      )
      .min(
        LEARNING_GOALS_MIN,
        `Write ${LEARNING_GOALS_MIN} to ${LEARNING_GOALS_MAX} learning goals.`,
      )
      .max(
        LEARNING_GOALS_MAX,
        `Write ${LEARNING_GOALS_MIN} to ${LEARNING_GOALS_MAX} learning goals.`,
      ),
    /** Lesson ids for every idea the case needs. Checked against the lessons in CI. */
    concepts: uniqueIds(ContentIdSchema).default([]),
    briefing: strict(
      {
        scenario: text("the situation: what happened, and who asked for help"),
        role: text("who the player is in this case"),
        authorization: text("the authorization: who signed, and exactly what may be examined"),
      },
      "the briefing (scenario, role, authorization)",
    ),
    machines: z
      .array(MachineSchema, required("the machines the story happens on"))
      .min(1, "Add at least one machine."),
    story: z
      .array(StoryActionSchema, required("the story: what really happened, in order"))
      .min(1, "Add at least one story action."),
    noise: z.optional(NoiseSchema),
    evidence: EvidenceSchema,
    /**
     * Paperwork that arrived with the evidence besides the letter and the handover form — a
     * message from the client, a printout of the door log — which the player reads in the case
     * folder. Like the letter, these are realistic documents rather than game copy, and nothing
     * in them is evidence a report can cite: a time in one is what somebody wrote down.
     */
    documents: z.array(DocumentSchema).default([]),
    beats: z.array(BeatSchema).default([]),
    objectives: z
      .array(
        ObjectiveSchema,
        required(`the objectives: ${MAIN_OBJECTIVES_MIN} to ${MAIN_OBJECTIVES_MAX} main steps`),
      )
      .min(1, "Add the case's objectives."),
    hints: z.record(
      z.string(),
      HintTiersSchema,
      required("the hints: three for every objective except hidden ones, under its id"),
    ),
    report: strict(
      {
        questions: z
          .array(ReportQuestionSchema, required("the report questions"))
          .min(1, "Add at least one report question."),
      },
      "the report (questions)",
    ),
    debrief: strict(
      {
        summary: text("the summary: what the player worked out"),
        whatYouLearned: z
          .array(
            text("a line of what the player learned"),
            required("whatYouLearned: one line in the past tense for each learning goal"),
          )
          .min(LEARNING_GOALS_MIN)
          .max(LEARNING_GOALS_MAX),
        ethicsNote: text(
          "the ethics note: what this would mean in the real world, who it would affect, and what makes it right here",
        ),
        defensiveTakeaway: text("the defensive takeaway: what the client should change"),
        nextTease: oneLine("the next tease: a one-line hook for the next case"),
        furtherReading: uniqueIds(ContentIdSchema).default([]),
      },
      "the debrief (summary, whatYouLearned, ethicsNote, defensiveTakeaway, nextTease)",
    ),
    /** The playthrough that proves the case is solvable. Defaults to `playthroughs/<id>.yaml`. */
    playthrough: z.optional(oneLine("the playthrough file, like `playthroughs/case-01.yaml`")),
  },
  "a case",
).superRefine((entry, ctx) => {
  const problem = (path: PropertyKey[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });

  if (entry.debrief.whatYouLearned.length !== entry.learningGoals.length) {
    problem(
      ["debrief", "whatYouLearned"],
      `Write one line for each learning goal: there are ${plural(entry.learningGoals.length, "goal")} and ${plural(entry.debrief.whatYouLearned.length, "line")} here.`,
    );
  }

  const actionIds = checkWorld(entry, problem);

  const documentFiles = new Set<string>();
  entry.documents.forEach((document, index) => {
    if (documentFiles.has(document.file)) {
      problem(["documents", index, "file"], `Two documents are called "${document.file}".`);
    }
    documentFiles.add(document.file);
  });

  const objectiveIds = new Set<string>();
  entry.objectives.forEach((objective, index) => {
    if (objectiveIds.has(objective.id)) {
      problem(["objectives", index, "id"], `Two objectives have the id "${objective.id}".`);
    }
    objectiveIds.add(objective.id);
  });

  const main = entry.objectives.filter((objective) => !objective.optional).length;
  if (main < MAIN_OBJECTIVES_MIN || main > MAIN_OBJECTIVES_MAX) {
    problem(
      ["objectives"],
      `A case has ${MAIN_OBJECTIVES_MIN} to ${MAIN_OBJECTIVES_MAX} main objectives (not optional or hidden); this one has ${main}. Small steps, frequent wins.`,
    );
  }

  for (const key of Object.keys(entry.hints)) {
    if (!objectiveIds.has(key)) {
      const suggestion = closestName(key, [...objectiveIds]);
      problem(
        ["hints", key],
        `There's no objective with the id "${key}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
      );
    }
  }
  for (const objective of entry.objectives) {
    if (!objective.hidden && !Object.hasOwn(entry.hints, objective.id)) {
      problem(
        ["hints"],
        `Add three hints for the objective "${objective.id}". Every objective except hidden ones needs them.`,
      );
    }
  }

  const questionIds = new Set<string>();
  entry.report.questions.forEach((question, index) => {
    if (questionIds.has(question.id)) {
      problem(["report", "questions", index, "id"], `Two questions have the id "${question.id}".`);
    }
    questionIds.add(question.id);
    if (question.answerFrom !== undefined && !actionIds.has(question.answerFrom)) {
      problem(
        ["report", "questions", index, "answerFrom"],
        `No story action has the id "${question.answerFrom}". Give the action that decides this answer an id, so a test can check the two still agree.`,
      );
    }
  });

  entry.beats.forEach((beat, index) => {
    if (typeof beat.on !== "object") return;
    if ("objective" in beat.on && !objectiveIds.has(beat.on.objective)) {
      problem(
        ["beats", index, "on", "objective"],
        `There's no objective with the id "${beat.on.objective}".`,
      );
    }
    if ("question" in beat.on && !questionIds.has(beat.on.question)) {
      problem(
        ["beats", index, "on", "question"],
        `There's no report question with the id "${beat.on.question}".`,
      );
    }
  });

  checkObjectiveReferences(entry, questionIds, problem);
});

function checkObjectiveReferences(
  entry: { objectives: readonly Objective[] },
  questionIds: ReadonlySet<string>,
  problem: (path: PropertyKey[], message: string) => void,
): void {
  const walk = (check: ObjectiveCheck, path: PropertyKey[]): void => {
    if (check.kind === "all" || check.kind === "any") {
      check.of.forEach((inner, index) => walk(inner, [...path, "of", index]));
      return;
    }
    if (check.kind === "reported" && !questionIds.has(check.question)) {
      problem(path, `There's no report question with the id "${check.question}".`);
    }
  };
  entry.objectives.forEach((objective, index) => {
    walk(objective.check, ["objectives", index, "check"]);
  });
}

/** A case as written in its file. */
export type CaseInput = z.input<typeof CaseSchema>;

/** A case after validation, with defaults filled in and hidden objectives marked optional. */
export type Case = z.output<typeof CaseSchema>;

// ---------------------------------------------------------------------------------------------
// Parsing with readable problems
// ---------------------------------------------------------------------------------------------

/** Where a problem is, for an author: `objectives[find-deletion].why`, `story[3].path`. */
export function formatIssuePath(path: readonly PropertyKey[], data: unknown): string {
  let out = "";
  let node: unknown = data;
  for (const segment of path) {
    if (typeof segment === "number") {
      const item: unknown = Array.isArray(node) ? node[segment] : undefined;
      const id = isRecord(item) && typeof item.id === "string" && item.id !== "" ? item.id : null;
      out += id === null ? `[${segment + 1}]` : `[${id}]`;
      node = item;
    } else {
      const key = String(segment);
      out += out === "" ? key : `.${key}`;
      node = isRecord(node) && Object.hasOwn(node, key) ? node[key] : undefined;
    }
  }
  return out;
}

export type CaseParseResult =
  | { readonly success: true; readonly case: Case }
  | { readonly success: false; readonly problems: readonly string[] };

/** Validates case data (already read from YAML), listing every problem as `path: message`. */
export function parseCase(data: unknown): CaseParseResult {
  const result = CaseSchema.safeParse(data, { error: authorErrorMap });
  if (result.success) return { success: true, case: result.data };
  return {
    success: false,
    problems: result.error.issues.map((issue) => {
      const path = formatIssuePath(issue.path, data);
      return path === "" ? issue.message : `${path}: ${issue.message}`;
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// The sandbox
// ---------------------------------------------------------------------------------------------

/** The sandbox's file, beside the cases but not one of them: the case catalog skips it. */
export const SANDBOX_FILE = "sandbox.yaml";

/**
 * `sandbox.yaml` (docs/plan/15-quality-and-launch.md, part B): evidence with no goals. It is built
 * by the same generator from the same kind of story as a case, and held to the same rules about
 * machines and actions, but it has no client, objectives, report or debrief, because nobody is
 * asked anything. It is Candlewright's own practice kit, so no client's letter is needed.
 */
export const SandboxSchema = strict(
  {
    id: z.literal("sandbox", required("the id: sandbox")),
    title: text("the sandbox's name").max(80, "Keep the title to 80 characters or fewer."),
    /** The line above the terminal, which says there are no goals. */
    banner: oneLine("the banner: one line saying there are no goals"),
    /** What the evidence is, in a sentence or two, under the banner. */
    summary: text("what the evidence is, in a sentence or two"),
    seed: z
      .number(required("the seed: any whole number. The same seed always builds the same evidence"))
      .int()
      .min(0)
      .max(CASE_SEED_MAX, `The seed is a whole number from 0 to ${CASE_SEED_MAX}.`),
    /** A few commands worth trying on this evidence, shown beside the terminal. */
    tryThis: z
      .array(
        strict(
          {
            command: oneLine("the command, exactly as it would be typed"),
            why: oneLine("what it shows, in a few words"),
          },
          "a command to try (command, why)",
        ),
        required("tryThis: a few commands worth trying first"),
      )
      .min(3, "Suggest at least three commands.")
      .max(10, "Suggest ten commands or fewer: the cheat sheet has the rest."),
    machines: z
      .array(MachineSchema, required("the machines the story happens on"))
      .min(1, "Add at least one machine."),
    story: z
      .array(StoryActionSchema, required("the story: what happened, in order"))
      .min(1, "Add at least one story action."),
    noise: z.optional(NoiseSchema),
    evidence: EvidenceSchema,
  },
  "the sandbox",
).superRefine((entry, ctx) => {
  checkWorld(entry, (path, message) => ctx.addIssue({ code: "custom", path, message }));
});

export type Sandbox = z.output<typeof SandboxSchema>;

export type SandboxParseResult =
  | { readonly success: true; readonly sandbox: Sandbox }
  | { readonly success: false; readonly problems: readonly string[] };

/** Validates the sandbox's data (already read from YAML), listing every problem as `path: message`. */
export function parseSandbox(data: unknown): SandboxParseResult {
  const result = SandboxSchema.safeParse(data, { error: authorErrorMap });
  if (result.success) return { success: true, sandbox: result.data };
  return {
    success: false,
    problems: result.error.issues.map((issue) => {
      const path = formatIssuePath(issue.path, data);
      return path === "" ? issue.message : `${path}: ${issue.message}`;
    }),
  };
}
