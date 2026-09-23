import type { Baseline } from "./types";

/**
 * `analyst-workstation-v1`: Candlewright's own machine, `ir-ws-01`, where the examiner works.
 *
 * It is **never evidence** (`imaged: false`), which is the whole point of it: a case's `hand-over`
 * and `capture-memory` actions happen *on* the workstation, and listing it in `evidence.disks` is
 * refused with a message saying so. A Linux-like machine has no Windows-style disk image here, and
 * the workstation the player actually types at is the vendored POSIX filesystem in
 * `src/content/sandbox/workstation.ts` (docs/plan/00-overview.md §4, rows 3 and 16).
 */
export const analystWorkstation: Baseline = {
  id: "analyst-workstation-v1",
  kind: "linux-workstation",
  summary: "Candlewright's examining workstation. Never evidence: it receives and images evidence.",
  imaged: false,
  device: { model: "Candlewright examining workstation", serialPrefix: "CW" },
  sectors: 0,
  clusterSize: 4096,
  partitions: [],
  accounts: [{ name: "examiner", groups: ["analysts"], home: "/home/examiner" }],
  adminGroup: "analysts",
  shell: "bash",
  programFolder: "/home/examiner/cases",
  files: [],
  homeFiles: [],
  processes: [
    {
      name: "systemd",
      path: "/usr/lib/systemd/systemd",
      user: "root",
      threads: 1,
      startedMinutesBefore: 4_000,
    },
    {
      name: "bash",
      path: "/usr/bin/bash",
      user: "examiner",
      parent: "systemd",
      threads: 1,
      startedMinutesBefore: 90,
    },
  ],
  network: { subnet: "10.20.0", firstHost: 11 },
};
