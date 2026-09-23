import type { Baseline } from "./types";

/**
 * `office-laptop-v1`: the everyday Windows-like laptop on a small company's desk. Quillfen
 * Freight's yard office and bookkeeper's laptops are both built from it.
 *
 * Small on purpose: a beginner should be able to read the whole of `C:\Users\<name>\Documents`
 * and still know where they are. Everything in it is invented (docs/plan/99-reference.md).
 */
export const officeLaptop: Baseline = {
  id: "office-laptop-v1",
  kind: "windows-laptop",
  summary: "A Windows-like office laptop: one staff account, documents, a browser and mail.",
  imaged: true,
  device: { model: "Pellmoor 256 GB solid-state drive", serialPrefix: "PM" },
  // 512-byte sectors. The image is a container, not a sector dump (src/sim/evidence/image.ts),
  // so these numbers describe the device on the evidence bag, not the size of the JSON.
  sectors: 500_118_192,
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
    { path: "C:\\", kind: "dir", owner: "SYSTEM", agedDays: 420 },
    { path: "C:\\Windows", kind: "dir", owner: "SYSTEM", agedDays: 420 },
    { path: "C:\\Windows\\System32", kind: "dir", owner: "SYSTEM", agedDays: 420 },
    {
      path: "C:\\Windows\\System32\\drivers\\etc\\hosts",
      owner: "SYSTEM",
      agedDays: 420,
      content:
        "# Local name lookups are checked here before the network is asked.\n127.0.0.1 localhost\n",
    },
    { path: "C:\\Users", kind: "dir", owner: "SYSTEM", agedDays: 420 },
    { path: "C:\\Users\\Public", kind: "dir", owner: "SYSTEM", agedDays: 420 },
    { path: "C:\\Users\\Public\\Downloads", kind: "dir", owner: "SYSTEM", agedDays: 420 },
    { path: "C:\\Program Files", kind: "dir", owner: "SYSTEM", agedDays: 420 },
    { path: "C:\\ProgramData", kind: "dir", owner: "SYSTEM", agedDays: 420 },
    {
      path: "C:\\ProgramData\\Quillfen\\yard-handbook.txt",
      owner: "SYSTEM",
      agedDays: 190,
      content: [
        "Quillfen Freight - yard handbook (extract)",
        "",
        "1. Every pallet gets a docket before it leaves the gate.",
        "2. The office laptop stays in the office. If you need it in the yard, sign it out.",
        "3. If a screen asks for a password twice, stop and tell the office.",
        "",
      ].join("\n"),
    },
  ],
  homeFiles: [
    { path: "~", kind: "dir", agedDays: 300 },
    { path: "Desktop", kind: "dir", agedDays: 300 },
    { path: "Documents", kind: "dir", agedDays: 300 },
    { path: "Downloads", kind: "dir", agedDays: 300 },
    { path: "AppData", kind: "dir", agedDays: 300 },
    { path: "AppData\\Local", kind: "dir", agedDays: 300 },
    { path: "AppData\\Local\\Web", kind: "dir", agedDays: 300 },
    {
      path: "AppData\\Local\\Web\\history.log",
      agedDays: 30,
      content: "# One line per page opened: local time, then the address.\n",
    },
    {
      path: "Documents\\reading-list.txt",
      agedDays: 44,
      content: "Pallet wrap suppliers\nTrailer inspection dates\nNight gate rota\n",
    },
  ],
  processes: [
    {
      name: "System",
      path: "C:\\Windows\\System32\\ntoskrnl.exe",
      cmdline: "",
      user: "SYSTEM",
      threads: 96,
      startedMinutesBefore: 300,
    },
    {
      name: "services.exe",
      path: "C:\\Windows\\System32\\services.exe",
      user: "SYSTEM",
      parent: "System",
      threads: 8,
      startedMinutesBefore: 299,
    },
    {
      name: "lsass.exe",
      path: "C:\\Windows\\System32\\lsass.exe",
      user: "SYSTEM",
      parent: "services.exe",
      threads: 12,
      startedMinutesBefore: 299,
    },
    {
      name: "svchost.exe",
      path: "C:\\Windows\\System32\\svchost.exe",
      cmdline: "C:\\Windows\\System32\\svchost.exe -k netsvcs",
      user: "SYSTEM",
      parent: "services.exe",
      threads: 22,
      startedMinutesBefore: 298,
    },
    {
      name: "explorer.exe",
      path: "C:\\Windows\\explorer.exe",
      parent: "userinit.exe",
      threads: 46,
      startedMinutesBefore: 240,
    },
  ],
  network: { subnet: "10.60.0", firstHost: 20 },
};
