import type { Baseline } from "./types";

/**
 * `training-laptop-v1`: a laptop from Candlewright's own training cupboard, `train-lt-01`, which the
 * Learning Center's practice terminals examine (src/content/practice/stories.ts). It belongs to
 * Candlewright, so a lesson can take it apart without touching any client's evidence.
 *
 * Smaller than the office laptop on purpose: a lesson's listing has to fit in a practice terminal,
 * so there is one account's worth of folders and nothing else to read around.
 */
export const trainingLaptop: Baseline = {
  id: "training-laptop-v1",
  kind: "windows-laptop",
  summary: "Candlewright's practice laptop: one trainee account and almost nothing else.",
  imaged: true,
  device: { model: "Pellmoor 128 GB solid-state drive", serialPrefix: "PM" },
  sectors: 250_069_680,
  clusterSize: 4096,
  partitions: [
    { label: "System reserved", startSector: 2048 },
    { label: "Windows", startSector: 1_050_624 },
  ],
  accounts: [{ name: "Administrator", groups: ["Administrators"] }],
  adminGroup: "Administrators",
  shell: "explorer.exe",
  programFolder: "C:\\Users\\Public\\Downloads",
  files: [
    { path: "C:\\", kind: "dir", owner: "SYSTEM", agedDays: 200 },
    { path: "C:\\Windows", kind: "dir", owner: "SYSTEM", agedDays: 200 },
    { path: "C:\\Windows\\Temp", kind: "dir", owner: "SYSTEM", agedDays: 200 },
    { path: "C:\\Users", kind: "dir", owner: "SYSTEM", agedDays: 200 },
    { path: "C:\\Users\\Public", kind: "dir", owner: "SYSTEM", agedDays: 200 },
    { path: "C:\\Users\\Public\\Downloads", kind: "dir", owner: "SYSTEM", agedDays: 200 },
  ],
  homeFiles: [
    { path: "~", kind: "dir", agedDays: 60 },
    { path: "Documents", kind: "dir", agedDays: 60 },
  ],
  processes: [
    {
      name: "System",
      path: "C:\\Windows\\System32\\ntoskrnl.exe",
      cmdline: "",
      user: "SYSTEM",
      threads: 80,
      startedMinutesBefore: 120,
    },
    {
      name: "explorer.exe",
      path: "C:\\Windows\\explorer.exe",
      threads: 30,
      startedMinutesBefore: 100,
    },
  ],
  network: { subnet: "10.20.0", firstHost: 40 },
};
