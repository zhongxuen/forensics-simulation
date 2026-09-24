/**
 * The memory image the `mem` tests run against, on the same analyst workstation as the disk tools'
 * tests (`../../__fixtures__/evidence.ts`).
 *
 * Built with `build` (src/sim/evidence/builder.ts), never by hand. It is Quillfen Freight's
 * dispatch server `qf-srv-01` (docs/plan/99-reference.md §New world facts), captured the morning
 * after the break-in, and it holds one of each thing the memory tools teach
 * (docs/plan/08-memory-tools.md):
 *
 * - an **unlinked** process, running but missing from the active list, so `ps` misses it and
 *   `psscan` finds it;
 * - an **exited** process, whose record a scan still finds but whose command line is gone;
 * - an **`svchost.exe` whose parent is `explorer.exe`**, living in a user's folder, beside two
 *   real ones started by `services.exe`;
 * - a **beaconing** connection: the same remote address, one minute apart, four times;
 * - one **malicious** writable-and-executable region with no file behind it, starting `MZ`;
 * - one **harmless** such region, made by the .NET runtime compiler in the dispatch board app;
 * - and two regions malfind must leave out: executable but read-only, and writable-and-executable
 *   but backed by a file.
 *
 * Names: `dispatch-board.exe` and `taskhost-upd.exe` are made up for the fixture. Addresses are
 * Quillfen's own ranges and an RFC 5737 documentation address.
 */
import { createInitialState } from "../../../../core/scenario";
import type { SimState } from "../../../../core/types";
import * as build from "../../../../evidence/builder";
import { attachEvidence } from "../../../../evidence/session";
import type { EvidenceSet } from "../../../../evidence/types";
import { CASE_SCENARIO, CASE_SEED } from "../../__fixtures__/evidence";

export const MEM_IMAGE = "qf-srv-01-mem";

/** The pids the tests name. */
export const PIDS = {
  system: 4,
  services: 628,
  /** A real svchost.exe, started by services.exe. */
  svchost: 812,
  explorer: 2044,
  /** The .NET dispatch board: its runtime compiler makes the harmless region. */
  dispatchBoard: 2312,
  /** svchost.exe, started by explorer.exe from a user's folder: the one to look at. */
  fakeSvchost: 4120,
  /** Exited before the capture. */
  cmd: 3920,
  /** Unlinked from the active list. */
  hidden: 4188,
} as const;

/** The two regions malfind reports, and the two it must not. */
export const REGIONS = {
  injected: 0x00520000,
  jit: 0x02a10000,
  readOnlyCode: 0x7ff61000,
  backedRwx: 0x7ff72000,
} as const;

/** Where the beacon checks in. */
export const BEACON = "203.0.113.47:443";

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));

/** An .exe copied into memory whole: the `MZ` header, then text the attacker's tool carries. */
const INJECTED_PREVIEW = new Uint8Array([
  0x4d,
  0x5a,
  0x90,
  0x00,
  0x03,
  0x00,
  0x00,
  0x00,
  0x04,
  0x00,
  0x00,
  0x00,
  0xff,
  0xff,
  0x00,
  0x00,
  0xb8,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x40,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  ...ascii("relay cdn-sync.example:443 every 60s"),
  0x00,
  0x00,
  0x00,
  0x00,
]);

/** Compiled .NET method bodies: they start mid-code, one after another, with no file header. */
const JIT_PREVIEW = new Uint8Array([
  0x55, 0x48, 0x8b, 0xec, 0x48, 0x83, 0xec, 0x30, 0x48, 0x89, 0x4d, 0x10, 0x48, 0x8b, 0x45, 0x10,
  0xff, 0x50, 0x18, 0x48, 0x83, 0xc4, 0x30, 0x5d, 0xc3, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc,
  0x55, 0x48, 0x8b, 0xec, 0x48, 0x83, 0xec, 0x20, 0x33, 0xc0, 0x48, 0x89, 0x45, 0xf8, 0x8b, 0x4d,
  0x18, 0xe8, 0x2c, 0x01, 0x00, 0x00, 0x48, 0x83, 0xc4, 0x20, 0x5d, 0xc3, 0xcc, 0xcc, 0xcc, 0xcc,
]);

const DISPATCH = "QUILLFEN\\dispatch";

export function memoryEvidence(): EvidenceSet {
  const memory = build
    .memory("qf-srv-01", { capturedAt: "2026-04-12T08:40:00Z" })
    .process("System", {
      pid: PIDS.system,
      path: "C:\\Windows\\System32\\ntoskrnl.exe",
      cmdline: "",
      createdAt: "2026-04-09T05:58:12Z",
      threads: 142,
    })
    .process("smss.exe", { pid: 388, ppid: PIDS.system, createdAt: "2026-04-09T05:58:13Z" })
    .process("wininit.exe", { pid: 496, ppid: 388, createdAt: "2026-04-09T05:58:20Z" })
    .process("services.exe", { pid: PIDS.services, ppid: 496, createdAt: "2026-04-09T05:58:21Z" })
    .process("lsass.exe", { pid: 640, ppid: 496, createdAt: "2026-04-09T05:58:21Z" })
    .process("svchost.exe", {
      pid: PIDS.svchost,
      ppid: PIDS.services,
      cmdline: "C:\\Windows\\System32\\svchost.exe -k DcomLaunch -p",
      createdAt: "2026-04-09T05:58:25Z",
    })
    .region({
      base: REGIONS.readOnlyCode,
      size: 0x3000,
      protection: "PAGE_EXECUTE_READ",
      backedBy: "C:\\Windows\\System32\\svchost.exe",
      preview: "MZ",
    })
    .process("svchost.exe", {
      pid: 904,
      ppid: PIDS.services,
      cmdline: "C:\\Windows\\System32\\svchost.exe -k RPCSS -p",
      createdAt: "2026-04-09T05:58:26Z",
      user: "NT AUTHORITY\\NETWORK SERVICE",
    })
    .connection("0.0.0.0:0", {
      local: "0.0.0.0:135",
      state: "LISTENING",
      createdAt: "2026-04-09T05:58:27Z",
    })
    .region({
      base: REGIONS.backedRwx,
      size: 0x1000,
      protection: "PAGE_EXECUTE_READWRITE",
      backedBy: "C:\\Windows\\System32\\rpcss.dll",
      preview: "rpcss",
    })
    .process("explorer.exe", {
      pid: PIDS.explorer,
      ppid: 1988,
      path: "C:\\Windows\\explorer.exe",
      cmdline: "C:\\Windows\\explorer.exe",
      createdAt: "2026-04-11T07:02:40Z",
      user: DISPATCH,
      threads: 38,
    })
    .process("dispatch-board.exe", {
      pid: PIDS.dispatchBoard,
      ppid: PIDS.explorer,
      path: "C:\\Program Files\\Quillfen\\Dispatch Board\\dispatch-board.exe",
      cmdline: '"C:\\Program Files\\Quillfen\\Dispatch Board\\dispatch-board.exe" --yard main',
      createdAt: "2026-04-11T07:03:05Z",
      user: DISPATCH,
      threads: 17,
    })
    .module("C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\clrjit.dll")
    .region({ base: REGIONS.jit, size: 0x10000, preview: JIT_PREVIEW })
    .connection("10.60.0.21:51022", {
      local: "10.60.1.10:8443",
      createdAt: "2026-04-12T07:55:10Z",
    })
    .process("svchost.exe", {
      pid: PIDS.fakeSvchost,
      ppid: PIDS.explorer,
      path: "C:\\Users\\dispatch\\AppData\\Roaming\\svchost.exe",
      cmdline:
        "C:\\Users\\dispatch\\AppData\\Roaming\\svchost.exe -k netsvcs -relay cdn-sync.example:443",
      createdAt: "2026-04-11T19:43:05Z",
      user: DISPATCH,
      threads: 6,
    })
    .region({ base: REGIONS.injected, size: 0x4000, preview: INJECTED_PREVIEW })
    .connection(BEACON, {
      local: "10.60.1.10:49811",
      state: "CLOSE_WAIT",
      createdAt: "2026-04-12T08:36:58Z",
    })
    .connection(BEACON, {
      local: "10.60.1.10:49812",
      state: "CLOSE_WAIT",
      createdAt: "2026-04-12T08:37:58Z",
    })
    .connection(BEACON, {
      local: "10.60.1.10:49813",
      state: "CLOSE_WAIT",
      createdAt: "2026-04-12T08:38:58Z",
    })
    .connection(BEACON, { local: "10.60.1.10:49814", createdAt: "2026-04-12T08:39:58Z" })
    .process("cmd.exe", {
      pid: PIDS.cmd,
      ppid: PIDS.fakeSvchost,
      cmdline: "cmd.exe /c whoami /all",
      createdAt: "2026-04-11T19:44:00Z",
      exitedAt: "2026-04-11T19:44:01Z",
      user: DISPATCH,
      threads: 0,
    })
    .process("taskhost-upd.exe", {
      pid: PIDS.hidden,
      ppid: PIDS.fakeSvchost,
      path: "C:\\ProgramData\\taskhost-upd.exe",
      cmdline: "C:\\ProgramData\\taskhost-upd.exe --quiet --stage 2",
      createdAt: "2026-04-11T19:45:12Z",
      user: DISPATCH,
      threads: 3,
      unlinked: true,
    });

  return build
    .evidence("mem-fixture", { seed: CASE_SEED, host: "qf-srv-01" })
    .memory(memory)
    .zone("disk", "Europe/London")
    .build();
}

/** The analyst workstation with the server's memory image attached. */
export const memoryState = (): SimState =>
  attachEvidence(createInitialState(CASE_SCENARIO, CASE_SEED), memoryEvidence(), {
    now: Date.UTC(2026, 3, 12, 9, 0, 0),
  });
