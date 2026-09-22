import type { FsEntrySpec, ScenarioSpec } from "@/sim/types";

/**
 * The tiny practice machines behind a lesson's `<MiniTerminal scenario="…">`
 * (md-files/09-learning-center.md, "Interactive MDX components"). Each is a real engine scenario,
 * run by the real terminal, so a lesson never teaches something the app's terminal doesn't do.
 *
 * They're all on the Range, Candlewright's practice lab (md-files/story-bible.md, "World facts":
 * range.candlewright.example, 192.168.60.0/24), and small on purpose: a handful of files or
 * computers, enough for one idea. A lesson picks one by id; the lesson tests fail on an id that
 * isn't here.
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

export const MINI_TERMINALS: readonly MiniTerminalScenario[] = [
  HOME,
  PERMISSIONS,
  LOGS,
  NETWORK,
  WEB,
];

export const MINI_TERMINAL_IDS: readonly string[] = MINI_TERMINALS.map((mini) => mini.id);

/** The practice machine with this id, or undefined. */
export function getMiniTerminal(id: string): MiniTerminalScenario | undefined {
  return MINI_TERMINALS.find((mini) => mini.id === id);
}
