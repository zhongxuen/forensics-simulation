import type { CaseSpec, Instant, StoryAction } from "@/sim/types";
import { PRACTICE_NOTE } from "../mini-terminals";

/**
 * The stories behind the lessons' practice evidence (docs/plan/13-learning-center.md: "a
 * `<MiniTerminal>` on the real engine with a tiny generated evidence set, never a fake").
 *
 * Each is a ground-truth story, the same shape as a case's, and the case generator
 * (`src/sim/evidence/generate`) plays it into the drive a lesson examines. `pnpm evidence:build`
 * writes the result next to this file as `<id>.evidence.json`, and `pnpm evidence:check` fails when
 * the committed file is not what the story builds today. Nobody writes the evidence by hand, so
 * every time, deleted file and carved object a lesson shows is one the story really left behind.
 *
 * Every story happens on Candlewright's own training kit, from the training cupboard: two practice
 * laptops, `train-lt-01` and `train-lt-02`, and a memory stick labelled TRAIN-07. No client's
 * evidence is used to teach, and no case is spoiled.
 */

/** "2026-09-14T08:10:00Z" as an instant. Only UTC times, written in full, are accepted. */
function at(iso: string): Instant {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(iso)) {
    throw new RangeError(`practice stories: write times as 2026-09-14T08:10:00Z, not "${iso}".`);
  }
  return Date.parse(iso);
}

const TRAINEE = { kind: "user", account: "trainee" } as const;
const ANALYST = { kind: "analyst" } as const;
const DOCS = "C:\\Users\\trainee\\Documents";

const LAPTOP = {
  id: "train-lt-01",
  kind: "windows-laptop",
  baseline: "training-laptop-v1",
  zone: "Europe/London",
  accounts: ["trainee"],
  device: { model: "Pellmoor 128 GB solid-state drive", serial: "PM-TRN-0001" },
} as const;

const WORKSTATION = {
  id: "ir-ws-01",
  kind: "linux-workstation",
  baseline: "analyst-workstation-v1",
  zone: "Europe/London",
} as const;

/** A one-page handout, as a real (if tiny) PDF: a header, one object, a trailer and the end marker. */
export const HANDOUT_PDF = [
  "%PDF-1.4",
  "1 0 obj << /Title (Carving practice handout) /Author (Candlewright training) >> endobj",
  "2 0 obj << /Length 58 >> stream",
  "Carved files have no name and no times. Say where you found them.",
  "endstream endobj",
  "trailer << /Root 1 0 R >>",
  "%%EOF",
  "",
].join("\n");

/**
 * TRAIN-07: the memory stick the Foundations lessons examine. The training team wrote the practice
 * note on the practice laptop, copied it to the stick, and Theo handed the stick over the next
 * morning with its hashes on the form.
 */
const TRAIN_07: CaseSpec = {
  id: "train-07",
  seed: 9301,
  machines: [LAPTOP, WORKSTATION],
  story: [
    {
      at: at("2026-09-20T16:40:00Z"),
      actor: TRAINEE,
      on: "train-lt-01",
      do: "create-file",
      path: `${DOCS}\\note.txt`,
      content: PRACTICE_NOTE,
    },
    {
      at: at("2026-09-20T16:44:00Z"),
      actor: TRAINEE,
      on: "train-lt-01",
      do: "usb-insert",
      device: "train-07",
      model: "Wrenfold 8 GB memory stick",
      serial: "WF-TRAIN-0007",
    },
    {
      at: at("2026-09-20T16:45:00Z"),
      actor: TRAINEE,
      on: "train-lt-01",
      do: "copy-to-usb",
      path: `${DOCS}\\note.txt`,
      device: "train-07",
    },
    {
      at: at("2026-09-21T09:05:00Z"),
      actor: ANALYST,
      on: "ir-ws-01",
      do: "hand-over",
      item: "train-07",
      by: "Theo Ashgrove",
    },
  ],
  evidence: { disks: ["train-07"], logs: [], memory: [] },
};

/**
 * TRAIN-LT-01: the practice laptop's own drive, for the Disk lessons. A week of a trainee's
 * Documents folder: a file written once, a file written, changed and then read, a draft deleted
 * and left alone, a note deleted and then written over, and a handout PDF deleted, which a carver
 * finds in the free space.
 */
const TRAIN_LT_01_STORY: readonly StoryAction[] = [
  {
    at: at("2026-09-14T08:05:00Z"),
    actor: TRAINEE,
    on: "train-lt-01",
    do: "logon",
    account: "trainee",
    type: "interactive",
  },
  {
    at: at("2026-09-14T08:10:00Z"),
    actor: TRAINEE,
    on: "train-lt-01",
    do: "create-file",
    path: `${DOCS}\\rota.txt`,
    content: "Practice rota\nMon: Noor\nTue: Idris\nWed: Kit\n",
  },
  {
    at: at("2026-09-15T10:00:00Z"),
    actor: TRAINEE,
    on: "train-lt-01",
    do: "create-file",
    path: `${DOCS}\\plan.txt`,
    content: "Training plan, week 38\n1. Order of volatility\n",
  },
  {
    at: at("2026-09-16T11:00:00Z"),
    actor: TRAINEE,
    on: "train-lt-01",
    do: "create-file",
    path: `${DOCS}\\letter-draft.txt`,
    content: "Theo, TRAIN-07 is back in cabinet 2. Kit\n",
  },
  {
    at: at("2026-09-16T11:30:00Z"),
    actor: TRAINEE,
    on: "train-lt-01",
    do: "delete-file",
    path: `${DOCS}\\letter-draft.txt`,
  },
  {
    at: at("2026-09-16T12:00:00Z"),
    actor: TRAINEE,
    on: "train-lt-01",
    do: "create-file",
    path: `${DOCS}\\old-note.txt`,
    content: "Blocker on before anything else.\n",
  },
  {
    at: at("2026-09-16T12:05:00Z"),
    actor: TRAINEE,
    on: "train-lt-01",
    do: "delete-file",
    path: `${DOCS}\\old-note.txt`,
  },
  {
    at: at("2026-09-17T07:00:00Z"),
    actor: { kind: "system" },
    on: "train-lt-01",
    do: "overwrite-clusters",
    path: `${DOCS}\\old-note.txt`,
    by: "C:\\Windows\\Temp\\update.log",
    content: "update started 07:00\nupdate finished 07:02\n",
  },
  {
    at: at("2026-09-17T14:20:00Z"),
    actor: TRAINEE,
    on: "train-lt-01",
    do: "modify-file",
    path: `${DOCS}\\plan.txt`,
    append: "2. Chain of custody\n",
  },
  {
    at: at("2026-09-18T09:00:00Z"),
    actor: TRAINEE,
    on: "train-lt-01",
    do: "read-file",
    path: `${DOCS}\\plan.txt`,
  },
  {
    at: at("2026-09-18T10:00:00Z"),
    actor: TRAINEE,
    on: "train-lt-01",
    do: "create-file",
    path: `${DOCS}\\handout.pdf`,
    content: HANDOUT_PDF,
  },
  {
    at: at("2026-09-18T10:30:00Z"),
    actor: TRAINEE,
    on: "train-lt-01",
    do: "delete-file",
    path: `${DOCS}\\handout.pdf`,
  },
  {
    at: at("2026-09-21T09:05:00Z"),
    actor: ANALYST,
    on: "ir-ws-01",
    do: "hand-over",
    item: "train-lt-01",
    by: "Theo Ashgrove",
  },
];

const TRAIN_LT_01: CaseSpec = {
  id: "train-lt-01",
  seed: 9302,
  machines: [LAPTOP, WORKSTATION],
  story: TRAIN_LT_01_STORY,
  evidence: {
    disks: ["train-lt-01"],
    logs: [],
    memory: [],
    zones: { disk: "Europe/London" },
  },
};

/**
 * TRAIN-LT-02: Candlewright's second practice laptop, for the Memory and the Logs and timelines
 * lessons. On the morning of 2026-09-22 Kit ran the team's hunt drill on it from a practice machine
 * on the Range (192.168.60.66): a burst of sign-in guesses, a remote sign-in that worked, a practice
 * account added to Administrators, and a harmless practice beacon named `svchost.exe`, started from
 * the wrong folder by the wrong parent, taken out of the active process list, with a region of
 * writable, runnable memory inside it and a check-in every minute. The laptop's own rota app is a
 * .NET program whose runtime compiler leaves a region of the same kind, which is the one to tell
 * apart. Idris captured the memory before anyone switched the laptop off.
 */
const TRAIN_LT_02_MACHINE = {
  ...LAPTOP,
  id: "train-lt-02",
  device: { model: "Pellmoor 128 GB solid-state drive", serial: "PM-TRN-0002" },
} as const;

/** The practice machine on the Range the drill came from (md-files/story-bible.md: 192.168.60.0/24). */
export const DRILL_ADDRESS = "192.168.60.66";

/** The practice beacon's process id, fixed so the lessons can name it. */
export const DRILL_BEACON_PID = 6120;

/** Bytes a runtime compiler leaves: the middle of machine instructions, with no file header. */
const JIT_BYTES =
  "\u0055\u0048\u0008\u0053\u0056\u0057\u0041\u0054\u0041\u0055\u0048\u0003\u0065\u0010";

/** Bytes a whole program copied into memory starts with: MZ, the first two letters of every Windows program file. */
const PROGRAM_BYTES =
  "MZ\u0000\u0003\u0000\u0000\u0000\u0004\u0000practice beacon, Candlewright drill";

/** The drill's sign-in guesses: three account names, four tries each, two seconds apart. */
const GUESSES: readonly StoryAction[] = ["admin", "administrator", "trainee"].flatMap(
  (account, a) =>
    [0, 1, 2, 3].map((i): StoryAction => ({
      at: at("2026-09-22T09:14:00Z") + (a * 4 + i) * 2_000,
      actor: { kind: "attacker" },
      on: "train-lt-02",
      do: "failed-logon",
      account,
      type: "network",
      from: DRILL_ADDRESS,
    })),
);

const TRAIN_LT_02_STORY: readonly StoryAction[] = [
  {
    at: at("2026-09-22T07:50:00Z"),
    actor: { kind: "system" },
    on: "train-lt-02",
    do: "run-process",
    name: "services.exe",
    path: "C:\\Windows\\System32\\services.exe",
    parent: "System",
    user: "SYSTEM",
    pid: 612,
    threads: 9,
  },
  {
    at: at("2026-09-22T07:50:05Z"),
    actor: { kind: "system" },
    on: "train-lt-02",
    do: "run-process",
    name: "svchost.exe",
    path: "C:\\Windows\\System32\\svchost.exe",
    cmdline: "C:\\Windows\\System32\\svchost.exe -k netsvcs",
    parent: "services.exe",
    user: "SYSTEM",
    pid: 884,
    threads: 22,
  },
  {
    at: at("2026-09-22T08:01:00Z"),
    actor: TRAINEE,
    on: "train-lt-02",
    do: "logon",
    account: "trainee",
    type: "interactive",
  },
  {
    at: at("2026-09-22T08:02:00Z"),
    actor: TRAINEE,
    on: "train-lt-02",
    do: "run-process",
    name: "rota-app.exe",
    path: "C:\\Program Files\\Candlewright\\rota-app.exe",
    cmdline: '"C:\\Program Files\\Candlewright\\rota-app.exe" --week 39',
    parent: "explorer.exe",
    user: "trainee",
    pid: 2240,
    threads: 12,
  },
  {
    at: at("2026-09-22T08:02:10Z"),
    actor: { kind: "system" },
    on: "train-lt-02",
    do: "inject",
    note: "Not an attack: the rota app's .NET runtime compiling its own code, which leaves memory of the same kind.",
    into: "rota-app.exe",
    preview: JIT_BYTES,
    size: 0x10000,
  },
  ...GUESSES,
  {
    at: at("2026-09-22T09:15:10Z"),
    actor: { kind: "attacker" },
    on: "train-lt-02",
    do: "logon",
    account: "trainee",
    type: "remote",
    from: DRILL_ADDRESS,
  },
  {
    at: at("2026-09-22T09:17:00Z"),
    actor: { kind: "attacker" },
    on: "train-lt-02",
    do: "create-account",
    account: "practice-svc",
    by: "trainee",
  },
  {
    at: at("2026-09-22T09:17:30Z"),
    actor: { kind: "attacker" },
    on: "train-lt-02",
    do: "add-to-group",
    account: "practice-svc",
    group: "Administrators",
    by: "trainee",
  },
  {
    at: at("2026-09-22T09:20:00Z"),
    actor: { kind: "attacker" },
    on: "train-lt-02",
    do: "run-process",
    name: "svchost.exe",
    path: "C:\\Users\\Public\\Downloads\\svchost.exe",
    cmdline: "C:\\Users\\Public\\Downloads\\svchost.exe -k drill",
    parent: "explorer.exe",
    user: "trainee",
    pid: DRILL_BEACON_PID,
    threads: 3,
    unlinked: true,
  },
  {
    at: at("2026-09-22T09:20:05Z"),
    actor: { kind: "attacker" },
    on: "train-lt-02",
    do: "inject",
    into: String(DRILL_BEACON_PID),
    preview: PROGRAM_BYTES,
  },
  {
    at: at("2026-09-22T09:21:00Z"),
    actor: { kind: "attacker" },
    on: "train-lt-02",
    do: "connect",
    process: String(DRILL_BEACON_PID),
    remote: `${DRILL_ADDRESS}:443`,
    every: 60,
    times: 8,
  },
  {
    at: at("2026-09-22T09:30:00Z"),
    actor: ANALYST,
    on: "train-lt-02",
    do: "capture-memory",
  },
  {
    at: at("2026-09-22T09:40:00Z"),
    actor: ANALYST,
    on: "ir-ws-01",
    do: "hand-over",
    item: "train-lt-02",
    by: "Idris Fenwick",
  },
];

const TRAIN_LT_02: CaseSpec = {
  id: "train-lt-02",
  seed: 9303,
  machines: [TRAIN_LT_02_MACHINE, WORKSTATION],
  story: TRAIN_LT_02_STORY,
  evidence: {
    disks: ["train-lt-02"],
    logs: ["security", "sysmon-lite"],
    memory: ["train-lt-02"],
    zones: { disk: "Europe/London", security: "Europe/London" },
  },
};

/** Every practice story, by id. The id is also the evidence file's name and a practice machine's `evidence`. */
export const PRACTICE_STORIES: readonly CaseSpec[] = [TRAIN_07, TRAIN_LT_01, TRAIN_LT_02];

export const PRACTICE_STORY_IDS: readonly string[] = PRACTICE_STORIES.map((story) => story.id);
