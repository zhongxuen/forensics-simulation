import { encodeBase64 } from "@/sim";
import type { DiskImage, EvidenceSet, FileRecord, LogRecord, MemoryImage } from "@/sim/types";

/**
 * A small hand-built evidence set for the evidence-model tests (tests/unit/evidence-*.test.ts).
 * It is written out in full on purpose: these tests check what the model does with exactly these
 * bytes, times and fields, so nothing should be filled in behind them. Tests of the tools built on
 * the model use the fluent builder instead (`build` in src/sim/evidence/builder.ts). Every name is
 * from the story world (docs/plan/99-reference.md): Quillfen Freight, `.example` domains, private
 * and RFC 5737 addresses.
 */
const at = (iso: string) => Date.parse(iso);
const text = (value: string) => encodeBase64(new TextEncoder().encode(value));

const times = (iso: string) => ({ m: at(iso), a: at(iso), c: at(iso), b: at(iso) });

function file(
  record: number,
  path: string,
  content: string,
  extra: Partial<FileRecord> = {},
): FileRecord {
  return {
    record,
    path,
    size: new TextEncoder().encode(content).length,
    contentB64: text(content),
    times: times("2026-04-10T08:00:00Z"),
    deleted: false,
    clusters: [record],
    owner: "dana",
    kind: "file",
    ...extra,
  };
}

function dir(record: number, path: string, owner = "SYSTEM"): FileRecord {
  return { ...file(record, path, "", { owner }), kind: "dir", clusters: [] };
}

export const FIXTURE_DISK: DiskImage = {
  id: "qf-lt-07",
  device: { model: "QX-256 solid-state drive", serial: "QX-0000-7731" },
  sectorSize: 512,
  sectors: 2048,
  partitions: [{ index: 0, label: "Windows", fs: "NTFS-like", startSector: 64, sectors: 1984 }],
  records: [
    dir(5, "C:\\"),
    dir(30, "C:\\Users"),
    dir(40, "C:\\Users\\dana", "dana"),
    dir(41, "C:\\Users\\dana\\Documents", "dana"),
    file(100, "C:\\Users\\dana\\Documents\\notes.txt", "Order more pallet wrap.\n", {
      times: {
        m: at("2026-04-09T15:10:00Z"),
        a: at("2026-04-10T09:30:00Z"),
        c: at("2026-04-09T15:10:00Z"),
        b: at("2026-04-01T08:00:00Z"),
      },
    }),
    file(101, "C:\\Users\\dana\\Documents\\inv-0412.pdf", "%PDF-1.4\n%%EOF\n", {
      deleted: true,
      times: {
        m: at("2026-04-11T19:42:03Z"),
        a: at("2026-04-11T19:42:03Z"),
        c: at("2026-04-11T19:42:03Z"),
        b: at("2026-04-02T10:00:00Z"),
      },
    }),
  ],
  unallocatedB64: encodeBase64(new Uint8Array(64)),
  clusterSize: 4096,
};

export const FIXTURE_MEMORY: MemoryImage = {
  id: "qf-srv-01-mem",
  capturedAt: at("2026-04-14T10:05:00Z"),
  host: "qf-srv-01",
  processes: [
    {
      pid: 4,
      ppid: 0,
      name: "System",
      path: "",
      cmdline: "",
      createdAt: at("2026-04-13T06:00:00Z"),
      user: "SYSTEM",
      threads: 120,
    },
    {
      pid: 4120,
      ppid: 4,
      name: "svchost.exe",
      path: "C:\\Users\\Public\\svchost.exe",
      cmdline: "C:\\Users\\Public\\svchost.exe -k update",
      createdAt: at("2026-04-14T02:13:00Z"),
      user: "svc-update",
      threads: 3,
      unlinked: true,
    },
  ],
  connections: [
    {
      pid: 4120,
      proto: "TCPv4",
      local: "10.60.1.10:49811",
      remote: "203.0.113.47:443",
      state: "ESTABLISHED",
      createdAt: at("2026-04-14T10:04:00Z"),
    },
  ],
  modules: [
    { pid: 4120, path: "C:\\Windows\\System32\\ntdll.dll", base: 140_000_000, size: 2_000_000 },
  ],
  regions: [
    {
      pid: 4120,
      base: 2_097_152,
      size: 4096,
      protection: "PAGE_EXECUTE_READWRITE",
      previewB64: encodeBase64(new Uint8Array([0x4d, 0x5a, 0x90, 0x00])),
    },
  ],
  strings: [{ offset: 2_097_300, value: "203.0.113.47", pid: 4120 }],
};

/** One record per event id and per non-event source, so each has a golden rendering. */
export const FIXTURE_LOGS: LogRecord[] = [
  {
    seq: 1,
    source: "security",
    at: at("2026-04-11T19:40:12Z"),
    host: "qf-lt-07",
    eventId: 4624,
    fields: {
      TargetUserName: "dana",
      TargetDomainName: "QUILLFEN",
      LogonType: "10",
      IpAddress: "10.60.0.21",
      IpPort: "50112",
      WorkstationName: "QF-LT-03",
      LogonProcessName: "User32",
      AuthenticationPackageName: "Negotiate",
      TargetLogonId: "0x3e7a1",
      SubjectUserName: "QF-LT-07$",
      SubjectDomainName: "QUILLFEN",
    },
  },
  {
    seq: 2,
    source: "security",
    at: at("2026-04-14T02:10:00Z"),
    host: "qf-srv-01",
    eventId: 4625,
    fields: {
      TargetUserName: "administrator",
      TargetDomainName: "QF-SRV-01",
      LogonType: "10",
      Status: "0xc000006d",
      SubStatus: "0xc000006a",
      FailureReason: "Unknown user name or bad password.",
      IpAddress: "198.51.100.23",
      IpPort: "61022",
      WorkstationName: "-",
    },
  },
  {
    seq: 3,
    source: "security",
    at: at("2026-04-11T17:31:00Z"),
    host: "qf-lt-07",
    eventId: 4634,
    fields: {
      TargetUserName: "dana",
      TargetDomainName: "QUILLFEN",
      TargetLogonId: "0x2b100",
      LogonType: "2",
    },
  },
  {
    seq: 4,
    source: "security",
    at: at("2026-04-14T02:12:30Z"),
    host: "qf-srv-01",
    eventId: 4672,
    fields: {
      SubjectUserName: "administrator",
      SubjectDomainName: "QF-SRV-01",
      SubjectLogonId: "0x51c20",
      PrivilegeList: "SeDebugPrivilege SeBackupPrivilege",
    },
  },
  {
    seq: 5,
    source: "security",
    at: at("2026-04-14T02:13:00Z"),
    host: "qf-srv-01",
    eventId: 4688,
    fields: {
      SubjectUserName: "svc-update",
      SubjectDomainName: "QF-SRV-01",
      NewProcessId: "0x1018",
      NewProcessName: "C:\\Users\\Public\\svchost.exe",
      ParentProcessName: "C:\\Windows\\System32\\cmd.exe",
      CommandLine: "C:\\Users\\Public\\svchost.exe -k update",
      TokenElevationType: "%%1937",
    },
  },
  {
    seq: 6,
    source: "security",
    at: at("2026-04-14T02:12:40Z"),
    host: "qf-srv-01",
    eventId: 4720,
    fields: {
      SubjectUserName: "administrator",
      SubjectDomainName: "QF-SRV-01",
      TargetUserName: "svc-update",
      TargetDomainName: "QF-SRV-01",
      SamAccountName: "svc-update",
    },
  },
  {
    seq: 7,
    source: "security",
    at: at("2026-04-14T02:12:45Z"),
    host: "qf-srv-01",
    eventId: 4732,
    fields: {
      SubjectUserName: "administrator",
      SubjectDomainName: "QF-SRV-01",
      MemberName: "-",
      MemberSid: "S-1-5-21-1004-1001",
      TargetUserName: "Administrators",
      TargetDomainName: "Builtin",
    },
  },
  {
    seq: 1,
    source: "sysmon-lite",
    at: at("2026-04-14T02:13:00Z"),
    host: "qf-srv-01",
    eventId: 1,
    fields: {
      ProcessId: "4120",
      Image: "C:\\Users\\Public\\svchost.exe",
      CommandLine: "C:\\Users\\Public\\svchost.exe -k update",
      User: "QF-SRV-01\\svc-update",
      ParentProcessId: "3310",
      ParentImage: "C:\\Windows\\System32\\cmd.exe",
    },
  },
  {
    seq: 2,
    source: "sysmon-lite",
    at: at("2026-04-14T02:14:00Z"),
    host: "qf-srv-01",
    eventId: 3,
    fields: {
      ProcessId: "4120",
      Image: "C:\\Users\\Public\\svchost.exe",
      User: "QF-SRV-01\\svc-update",
      Protocol: "tcp",
      SourceIp: "10.60.1.10",
      SourcePort: "49811",
      DestinationIp: "203.0.113.47",
      DestinationPort: "443",
    },
  },
  {
    seq: 3,
    source: "sysmon-lite",
    at: at("2026-04-11T19:44:00Z"),
    host: "qf-lt-03",
    eventId: 11,
    fields: {
      ProcessId: "2204",
      Image: "C:\\Windows\\System32\\notepad.exe",
      TargetFilename: "C:\\Users\\Public\\README-HL.txt",
    },
  },
  {
    seq: 4,
    source: "sysmon-lite",
    at: at("2026-04-11T19:42:03Z"),
    host: "qf-lt-07",
    eventId: 23,
    fields: {
      ProcessId: "5120",
      Image: "C:\\Windows\\explorer.exe",
      User: "QUILLFEN\\dana",
      TargetFilename: "C:\\Users\\dana\\Documents\\Invoices\\inv-0412.pdf",
    },
  },
  {
    seq: 1,
    source: "web-access",
    at: at("2026-04-11T19:39:58Z"),
    host: "qf-srv-01",
    fields: {
      clientIp: "10.60.0.21",
      method: "GET",
      path: "/dispatch/login",
      protocol: "HTTP/1.1",
      status: "200",
      bytes: "5120",
      referer: "-",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  },
  {
    seq: 1,
    source: "firewall",
    at: at("2026-04-11T19:41:30Z"),
    host: "qf-fw-01",
    fields: {
      dst: "203.0.113.80",
      src: "10.60.0.21",
      action: "allow",
      proto: "TCP",
      spt: "51234",
      dpt: "443",
      bytes: "1843200",
      rule: "office-out",
      note: "large upload",
    },
  },
  {
    seq: 1,
    source: "dns",
    at: at("2026-04-14T02:13:55Z"),
    host: "qf-srv-01",
    fields: {
      client: "10.60.1.10",
      query: "cdn-sync.example",
      type: "A",
      rcode: "NOERROR",
      answer: "203.0.113.47",
    },
  },
  {
    seq: 1,
    source: "vpn",
    at: at("2026-04-11T19:35:00Z"),
    host: "qf-vpn-01",
    fields: { event: "auth-fail", user: "dana", src: "198.51.100.7", reason: "bad password" },
  },
];

export function fixtureEvidence(): EvidenceSet {
  return {
    caseId: "fixture",
    seed: 42,
    disks: [FIXTURE_DISK],
    memory: [FIXTURE_MEMORY],
    logs: FIXTURE_LOGS,
    zones: { security: "Europe/London", "web-access": "Europe/London" },
    handover: [
      {
        item: "qf-lt-07",
        hashes: { md5: "0".repeat(32), sha256: "0".repeat(64) },
        receivedAt: at("2026-04-13T09:00:00Z"),
        by: "Quillfen Freight office",
      },
    ],
  };
}
