import type { FsEntrySpec, ScenarioSpec } from "@/sim/types";

/**
 * The tiny practice machines behind a lesson's `<MiniTerminal scenario="…">`
 * (md-files/09-learning-center.md, "Interactive MDX components"). Each is a real engine scenario,
 * run by the real terminal, so a lesson never teaches something the app's terminal doesn't do.
 *
 * They're all on the Range, Candlewright's practice lab (md-files/story-bible.md, "World facts":
 * range.candlewright.example, 192.168.60.0/24), and small on purpose: a handful of files or
 * computers, enough for one idea. A lesson picks one by id; the lesson tests fail on an id that
 * isn't here. `ir-ws-practice` is this game's own: the analyst workstation, for the forensics
 * lessons. The Range machines came with the vendored pipeline.
 */

export interface MiniTerminalScenario {
  /** Stable id, used by `<MiniTerminal scenario="…">`. Also the engine scenario's id. */
  readonly id: string;
  /** What's on this machine, for authors choosing one. */
  readonly description: string;
  /** Shown in the terminal's header, instead of user@host. */
  readonly title: string;
  readonly seed: number;
  readonly scenario: ScenarioSpec;
}

const RANGE = "192.168.60.0/24";
const linux = { family: "linux", name: "Linux", version: "6.8" } as const;
const ssh = { port: 22, protocol: "tcp", name: "ssh", product: "sshd", version: "9.6" } as const;

/** A practice computer on the Range with these files, where `recruit` is signed in. */
function workstation(
  id: string,
  entries: readonly FsEntrySpec[],
  users: NonNullable<ScenarioSpec["network"]["hosts"][number]["users"]> = [
    { name: "recruit", uid: 1000 },
  ],
): ScenarioSpec {
  return {
    id,
    startTime: "2026-03-02T09:00:00Z",
    network: {
      subnets: [{ cidr: RANGE, name: "The Range" }],
      hosts: [
        {
          id: "range-ws-01",
          hostname: "range-ws-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.10", subnet: RANGE }],
          os: linux,
          users,
          fs: { entries },
        },
      ],
    },
    session: { host: "range-ws-01", user: "recruit" },
  };
}

const HOME: MiniTerminalScenario = {
  id: "range-home",
  title: "recruit@range-ws-01 (practice)",
  description: "A home folder with a few notes, a folder, and one hidden file.",
  seed: 9101,
  scenario: workstation("range-home", [
    {
      path: "/home/recruit/welcome.txt",
      content:
        "Welcome to the Range! This is a practice computer.\nNothing you type here can break anything real.\n",
    },
    {
      path: "/home/recruit/todo.txt",
      content: "1. Say hello to the team\n2. Learn three commands\n3. Have a cup of tea\n",
    },
    {
      path: "/home/recruit/notes/day-one.txt",
      content: "Noor says: every question deserves an answer. Ask anything.\n",
    },
    {
      path: "/home/recruit/.secret-snack",
      content: "You found a hidden file! Its name starts with a dot, so a plain ls skips it.\n",
    },
  ]),
};

const PERMISSIONS: MiniTerminalScenario = {
  id: "range-permissions",
  title: "recruit@range-ws-01 (practice)",
  description:
    "Files with different locks: one anyone can read, one only you can read, one you can't open.",
  seed: 9102,
  scenario: workstation(
    "range-permissions",
    [
      {
        path: "/home/recruit/shopping-list.txt",
        content: "bread, milk, more coffee for Theo\n",
        mode: "644",
      },
      {
        path: "/home/recruit/diary.txt",
        content: "Day one. Nobody else can read this, because only I have the key.\n",
        mode: "600",
      },
      {
        path: "/home/recruit/practice-password.txt",
        content: "practice-password: tea-and-toast-42\n",
        mode: "644",
      },
      { path: "/home/kit/plans.txt", owner: "kit", mode: "600", content: "Kit's private plans.\n" },
      {
        path: "/srv/team/rota.txt",
        owner: "kit",
        group: "team",
        mode: "640",
        content: "Monday: Noor. Tuesday: Idris. Wednesday: Kit.\n",
      },
    ],
    [
      { name: "recruit", uid: 1000, groups: ["team"] },
      { name: "kit", uid: 1001, groups: ["team"] },
    ],
  ),
};

const LOGS: MiniTerminalScenario = {
  id: "range-logs",
  title: "recruit@range-ws-01 (practice)",
  description: "A sign-in log with a few failed attempts, readable by you.",
  seed: 9103,
  scenario: workstation(
    "range-logs",
    [
      {
        path: "/var/log/auth.log",
        group: "adm",
        mode: "640",
        content: [
          "2026-03-02T08:30:10Z INFO sshd[901]: Accepted password for recruit from 192.168.60.10 port 50122",
          "2026-03-02T08:41:03Z WARN sshd[944]: Failed password for kit from 192.168.60.21 port 40011",
          "2026-03-02T08:41:09Z INFO sshd[944]: Accepted password for kit from 192.168.60.21 port 40011",
          "2026-03-02T02:14:07Z WARN sshd[977]: Failed password for admin from 192.168.60.66 port 51515",
          "2026-03-02T02:14:09Z WARN sshd[977]: Failed password for admin from 192.168.60.66 port 51516",
          "2026-03-02T02:14:12Z WARN sshd[977]: Failed password for admin from 192.168.60.66 port 51517",
          "",
        ].join("\n"),
      },
      {
        path: "/var/log/syslog",
        content:
          "2026-03-02T08:00:01Z INFO cron[311]: daily practice reset finished\n2026-03-02T08:45:40Z WARN disk[88]: /tmp is 60% full\n",
      },
    ],
    [{ name: "recruit", uid: 1000, groups: ["adm"] }],
  ),
};

const NETWORK: MiniTerminalScenario = {
  id: "range-network",
  title: "recruit@range-ws-01 (practice)",
  description: "Three practice computers on the Range: yours, a web server, and a file server.",
  seed: 9104,
  scenario: {
    id: "range-network",
    startTime: "2026-03-02T09:00:00Z",
    network: {
      subnets: [{ cidr: RANGE, name: "The Range" }],
      hosts: [
        {
          id: "range-ws-01",
          hostname: "range-ws-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.10", subnet: RANGE }],
          os: linux,
          users: [{ name: "recruit", uid: 1000 }],
          fs: {
            entries: [
              {
                path: "/home/recruit/scope.txt",
                content:
                  "Practice scope: every computer in 192.168.60.0/24, the Range.\nSigned: Theo Ashgrove, team lead\n",
              },
            ],
          },
        },
        {
          id: "range-web-01",
          hostname: "range-web-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.20", subnet: RANGE }],
          os: linux,
          services: [
            ssh,
            {
              port: 80,
              protocol: "tcp",
              name: "http",
              product: "httpd",
              version: "2.4.58",
              http: { pages: { "/": { status: 200, title: "Range intranet" } } },
            },
          ],
        },
        {
          id: "range-files-01",
          hostname: "range-files-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.30", subnet: RANGE }],
          os: linux,
          services: [
            ssh,
            { port: 445, protocol: "tcp", name: "fileshare", product: "shared", version: "4.19" },
          ],
        },
      ],
    },
    session: { host: "range-ws-01", user: "recruit" },
  },
};

const WEB: MiniTerminalScenario = {
  id: "range-web",
  title: "recruit@range-ws-01 (practice)",
  description: "A practice website with a home page, a sign-in page, and a page that isn't there.",
  seed: 9105,
  scenario: {
    id: "range-web",
    startTime: "2026-03-02T09:00:00Z",
    network: {
      subnets: [{ cidr: RANGE, name: "The Range" }],
      hosts: [
        {
          id: "range-ws-01",
          hostname: "range-ws-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.10", subnet: RANGE }],
          os: linux,
          users: [{ name: "recruit", uid: 1000 }],
          fs: {},
        },
        {
          id: "range-shop-01",
          hostname: "range-shop-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.25", subnet: RANGE }],
          os: linux,
          services: [
            {
              port: 80,
              protocol: "tcp",
              name: "http",
              product: "httpd",
              version: "2.4.58",
              http: {
                headers: { "X-Powered-By": "PageForge/3.1" },
                pages: {
                  "/": {
                    status: 200,
                    title: "Practice cake shop",
                    body: "<html><head><title>Practice cake shop</title></head><body><h1>Cakes!</h1><!-- TODO: remove the test page at /test before launch --></body></html>",
                  },
                  "/login": {
                    status: 200,
                    title: "Sign in",
                    headers: { "Set-Cookie": "session=practice-4f2a; HttpOnly; Secure" },
                  },
                  "/admin": { status: 401, title: "Sign in required" },
                },
              },
            },
          ],
        },
      ],
    },
    session: { host: "range-ws-01", user: "recruit" },
  },
};

/**
 * The analyst workstation `ir-ws-01` (docs/plan/99-reference.md, "New world facts") with a practice
 * examination laid out in the home folder, for the Foundations lessons (docs/plan/13-learning-center.md).
 * The evidence is a USB stick from Candlewright's own training cupboard, so no client's case is
 * spoiled. `copy-a` is exact and `copy-b` differs by one character; the SHA-256 values in
 * `handover.txt` and `hashes.txt` are the real hashes of those files (tests/unit/lesson-content.test.ts
 * recomputes them).
 *
 * TODO(04): once `acquire` and `hashsum` exist, the Foundations lessons image a practice device and
 * verify it here instead of reading recorded hashes.
 */
export const PRACTICE_NOTE = [
  "Practice note on TRAIN-07",
  "Written 2026-09-20 at 16:40 by the training team.",
  "If you can read this, the copy worked.",
  "",
].join("\n");

/** The same note with one character changed: 16:40 became 16:46. */
export const PRACTICE_NOTE_CHANGED = PRACTICE_NOTE.replace("16:40", "16:46");

/** SHA-256 of PRACTICE_NOTE and PRACTICE_NOTE_CHANGED, as recorded in the practice files. */
export const PRACTICE_NOTE_SHA256 =
  "5be6f7083ca52026d09c505362abc446e8d64a06d80705dfdd62ef88e151cbaa";
export const PRACTICE_NOTE_CHANGED_SHA256 =
  "ba0c71fa42ba7533389d2e7cc01fd24e9ce3efe65297ff7180ac684448341ad2";

const PRACTICE: MiniTerminalScenario = {
  id: "ir-ws-practice",
  title: "examiner@ir-ws-01 (practice)",
  description:
    "Your analyst workstation with a practice examination: a signed letter, a custody log, recorded hashes and two copies of one note.",
  seed: 9201,
  scenario: {
    id: "ir-ws-practice",
    startTime: "2026-09-22T09:00:00Z",
    network: {
      subnets: [{ cidr: "10.20.0.0/24", name: "Candlewright blue-team room" }],
      hosts: [
        {
          id: "ir-ws-01",
          hostname: "ir-ws-01.candlewright.example",
          interfaces: [{ ip: "10.20.0.11", subnet: "10.20.0.0/24" }],
          os: linux,
          users: [{ name: "examiner", uid: 1000, groups: ["adm"] }],
          fs: {
            entries: [
              {
                path: "/home/examiner/letter.txt",
                content: [
                  "Letter of authorisation (practice)",
                  "",
                  "Candlewright Security may examine one USB stick, label TRAIN-07,",
                  "from the training cupboard. Nothing else.",
                  "",
                  "Questions the examination should answer:",
                  "  1. What is on the stick?",
                  "  2. When was the note on it written?",
                  "",
                  "Signed: Theo Ashgrove, team lead, 2026-09-21",
                  "",
                ].join("\n"),
              },
              {
                path: "/home/examiner/collection-plan.txt",
                content: [
                  "Collection plan for a machine that is still switched on",
                  "Most volatile first. Stop when the letter's questions are answered.",
                  "",
                  "1. network connections and who is logged in   gone in seconds",
                  "2. memory, and the programs running in it     gone at power-off",
                  "3. temporary files                            gone at restart",
                  "4. the disk                                   stays, but every use changes it",
                  "5. logs kept on other machines                stay until rotated away",
                  "6. backups and archives                       stay for months",
                  "",
                ].join("\n"),
              },
              {
                path: "/home/examiner/handover.txt",
                content: [
                  "Handover form: USB stick TRAIN-07 (practice)",
                  "Handed over by: Theo Ashgrove, 2026-09-21 09:05 UTC",
                  "Received by:    Idris Fenwick",
                  "Seal:           bag 0412, intact",
                  `SHA-256 of the note, taken before handover: ${PRACTICE_NOTE_SHA256}`,
                  "",
                ].join("\n"),
              },
              {
                path: "/home/examiner/custody-log.txt",
                content: [
                  "Custody log: USB stick TRAIN-07 (practice). Times in UTC.",
                  "2026-09-21 09:02  Theo Ashgrove        took TRAIN-07 from the training cupboard, sealed it in bag 0412",
                  "2026-09-21 09:05  Theo Ashgrove        handed bag 0412 to Idris Fenwick, seal intact",
                  "2026-09-21 09:20  Idris Fenwick        opened bag 0412, write-blocker on, copied the note to copy-a",
                  "2026-09-21 09:31  Idris Fenwick        recorded the SHA-256 of copy-a in hashes.txt",
                  "2026-09-21 09:33  Idris Fenwick        sealed TRAIN-07 in bag 0413, locked it in cabinet 2",
                  "2026-09-22 08:47  Kit Nakashima-Reyes  copied the note to copy-b for a demonstration",
                  "",
                ].join("\n"),
              },
              {
                path: "/home/examiner/hashes.txt",
                content: [
                  "SHA-256 of each copy, worked out on this workstation",
                  `${PRACTICE_NOTE_SHA256}  copies/copy-a/note.txt`,
                  `${PRACTICE_NOTE_CHANGED_SHA256}  copies/copy-b/note.txt`,
                  "",
                ].join("\n"),
              },
              {
                path: "/home/examiner/copies/copy-a/note.txt",
                content: PRACTICE_NOTE,
                mode: "444",
              },
              {
                path: "/home/examiner/copies/copy-b/note.txt",
                content: PRACTICE_NOTE_CHANGED,
                mode: "444",
              },
            ],
          },
        },
      ],
    },
    session: { host: "ir-ws-01", user: "examiner" },
  },
};

export const MINI_TERMINALS: readonly MiniTerminalScenario[] = [
  HOME,
  PERMISSIONS,
  LOGS,
  NETWORK,
  WEB,
  PRACTICE,
];

export const MINI_TERMINAL_IDS: readonly string[] = MINI_TERMINALS.map((mini) => mini.id);

/** The practice machine with this id, or undefined. */
export function getMiniTerminal(id: string): MiniTerminalScenario | undefined {
  return MINI_TERMINALS.find((mini) => mini.id === id);
}
