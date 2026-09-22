import type { FsEntrySpec, ScenarioSpec } from "@/sim/types";

/**
 * A practice machine with no objectives: an engine scenario plus what the sandbox page shows
 * beside it.
 */
export interface SandboxMachine {
  /** Stable id: also the engine scenario's id. */
  readonly id: string;
  /** Shown above the terminal. */
  readonly title: string;
  /** One line a beginner can read in five seconds. */
  readonly description: string;
  /** A few commands worth trying first, shown next to the terminal. */
  readonly tryThis: readonly { readonly command: string; readonly why: string }[];
  readonly seed: number;
  readonly scenario: ScenarioSpec;
}

const README = `Welcome to ir-ws-01, your analyst workstation.

This is the computer you'll examine evidence from. In a case, the
evidence arrives here as read-only images. For now it's a practice
copy: nothing can break, and Reset machine puts everything back.

Some things to try:
  ls              list what's in this folder
  cat notes.txt   read a file
  cd cases        go into the cases folder
  ls -a           find the hidden files
  help            see every command
`;

const FILES: readonly FsEntrySpec[] = [
  { path: "/etc/motd", content: "Welcome to ir-ws-01. Candlewright Security, blue team.\n" },
  { path: "/home/examiner/README.txt", content: README },
  {
    path: "/home/examiner/notes.txt",
    content:
      "First week on the blue team\n- Look around with ls and cd\n- Read files with cat, head and tail\n- Search inside files with grep\n- Ask Noor anything\n",
  },
  {
    path: "/home/examiner/cases/README.txt",
    content:
      "Each case gets its own folder here, with the signed letter first.\nNo letter, no examination. - Theo\n",
  },
  {
    path: "/home/examiner/.bashrc",
    content: "# Settings for your shell. Lines starting with # are comments.\nalias ll='ls -l'\n",
  },
  { path: "/home/examiner/logs", target: "/var/log" },
  {
    path: "/var/log/syslog",
    content:
      "2026-09-21T08:00:01Z INFO cron[311]: nightly workstation check finished\n2026-09-21T08:30:12Z INFO systemd[1]: Started session 3 of user examiner\n2026-09-21T09:12:40Z WARN disk[88]: /home is 60% full\n",
  },
  {
    path: "/var/log/auth.log",
    content:
      "2026-09-21T08:30:10Z INFO login[901]: examiner logged in on tty1\n2026-09-21T08:41:03Z WARN sudo[944]: examiner: 1 incorrect password attempt\n2026-09-21T08:41:09Z INFO sudo[944]: examiner: command allowed\n",
    group: "adm",
    mode: "640",
  },
];

/**
 * The analyst workstation from docs/plan/99-reference.md, "New world facts": `ir-ws-01` in the
 * Candlewright blue-team room (`candlewright.example`, `10.20.0.0/24`), with the player's account
 * `examiner`. Cases add evidence to it; the sandbox runs it bare.
 */
export const WORKSTATION: SandboxMachine = {
  id: "sandbox-workstation",
  title: "Analyst workstation",
  description: "Your own Linux workstation, with folders and files to explore.",
  tryThis: [
    { command: "ls", why: "See what's in your home folder" },
    { command: "cat README.txt", why: "Read the welcome note" },
    { command: "grep examiner logs/auth.log", why: "Find every line that mentions you" },
    { command: "ls -la", why: "Find hidden files and their permissions" },
  ],
  seed: 2001,
  scenario: {
    id: "sandbox-workstation",
    network: {
      subnets: [{ cidr: "10.20.0.0/24", name: "Candlewright blue-team room" }],
      hosts: [
        {
          id: "ir-ws-01",
          hostname: "ir-ws-01.candlewright.example",
          interfaces: [{ ip: "10.20.0.11", subnet: "10.20.0.0/24" }],
          os: { family: "linux", name: "Linux", version: "6.8" },
          services: [],
          users: [{ name: "examiner", uid: 1000, groups: ["adm"] }],
          fs: { entries: FILES },
        },
      ],
    },
    session: { host: "ir-ws-01", user: "examiner" },
  },
};
