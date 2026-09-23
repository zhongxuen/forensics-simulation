import type { Baseline } from "./types";

/**
 * `office-server-v1`: the one Windows-like server a small company runs. At Quillfen Freight that
 * is `qf-srv-01`, the dispatch server, which also answers remote desktop from outside — the door
 * the Hollow Latch find open.
 *
 * It keeps a web log and a dispatch database folder, so a case can tell a story in the logs as
 * well as on the disk. Everything in it is invented (docs/plan/99-reference.md).
 */
export const officeServer: Baseline = {
  id: "office-server-v1",
  kind: "windows-server",
  summary: "A Windows-like dispatch server: shared folders, a web log and remote desktop.",
  imaged: true,
  device: { model: "Pellmoor 1 TB server drive", serialPrefix: "PS" },
  sectors: 1_953_525_168,
  clusterSize: 4096,
  partitions: [
    { label: "System reserved", startSector: 2048 },
    { label: "Windows", startSector: 1_050_624 },
  ],
  accounts: [
    { name: "Administrator", groups: ["Administrators"] },
    { name: "dispatch-svc", groups: ["Users"] },
  ],
  adminGroup: "Administrators",
  shell: "cmd.exe",
  programFolder: "C:\\ProgramData\\Dispatch\\temp",
  files: [
    { path: "C:\\", kind: "dir", owner: "SYSTEM", agedDays: 900 },
    { path: "C:\\Windows", kind: "dir", owner: "SYSTEM", agedDays: 900 },
    { path: "C:\\Windows\\System32", kind: "dir", owner: "SYSTEM", agedDays: 900 },
    { path: "C:\\Users", kind: "dir", owner: "SYSTEM", agedDays: 900 },
    { path: "C:\\ProgramData", kind: "dir", owner: "SYSTEM", agedDays: 900 },
    { path: "C:\\ProgramData\\Dispatch", kind: "dir", owner: "SYSTEM", agedDays: 640 },
    { path: "C:\\ProgramData\\Dispatch\\temp", kind: "dir", owner: "SYSTEM", agedDays: 640 },
    {
      path: "C:\\ProgramData\\Dispatch\\dispatch.conf",
      owner: "SYSTEM",
      agedDays: 610,
      content: [
        "# Dispatch service settings. Changes need a restart.",
        "listen = 0.0.0.0:8443",
        "runs_as = dispatch-svc",
        "log_folder = C:\\inetpub\\logs",
        "keep_logs_days = 90",
        "",
      ].join("\n"),
    },
    { path: "C:\\Shares", kind: "dir", owner: "SYSTEM", agedDays: 880 },
    { path: "C:\\Shares\\Dockets", kind: "dir", owner: "SYSTEM", agedDays: 880 },
    {
      path: "C:\\Shares\\Dockets\\readme.txt",
      owner: "SYSTEM",
      agedDays: 500,
      content: "Dockets are filed by week. The office keeps the paper copies for two years.\n",
    },
    { path: "C:\\inetpub", kind: "dir", owner: "SYSTEM", agedDays: 900 },
    { path: "C:\\inetpub\\logs", kind: "dir", owner: "SYSTEM", agedDays: 900 },
  ],
  homeFiles: [
    { path: "~", kind: "dir", agedDays: 700 },
    { path: "Documents", kind: "dir", agedDays: 700 },
    { path: "Downloads", kind: "dir", agedDays: 700 },
  ],
  processes: [
    {
      name: "System",
      path: "C:\\Windows\\System32\\ntoskrnl.exe",
      cmdline: "",
      user: "SYSTEM",
      threads: 128,
      startedMinutesBefore: 20_000,
    },
    {
      name: "services.exe",
      path: "C:\\Windows\\System32\\services.exe",
      user: "SYSTEM",
      parent: "System",
      threads: 9,
      startedMinutesBefore: 19_999,
    },
    {
      name: "lsass.exe",
      path: "C:\\Windows\\System32\\lsass.exe",
      user: "SYSTEM",
      parent: "services.exe",
      threads: 18,
      startedMinutesBefore: 19_999,
    },
    {
      name: "svchost.exe",
      path: "C:\\Windows\\System32\\svchost.exe",
      cmdline: "C:\\Windows\\System32\\svchost.exe -k termsvcs",
      user: "NETWORK SERVICE",
      parent: "services.exe",
      threads: 26,
      startedMinutesBefore: 19_998,
    },
    {
      name: "dispatch-svc.exe",
      path: "C:\\Program Files\\Dispatch\\dispatch-svc.exe",
      cmdline: '"C:\\Program Files\\Dispatch\\dispatch-svc.exe" --service',
      user: "dispatch-svc",
      parent: "services.exe",
      threads: 14,
      startedMinutesBefore: 19_990,
    },
  ],
  network: { subnet: "10.60.1", firstHost: 10 },
};
