/**
 * A small, fictional office network for engine tests. Every name is made up and every address is
 * in a reserved range. It's deliberately varied:
 *
 * - ws-01       the learner's workstation (10.0.1.10), with a filesystem
 * - web-01      a web server on two networks (10.0.1.20 and 10.0.2.20)
 * - printer-01  ignores pings, so plain sweeps miss it
 * - db-01       reachable, but every port is firewalled from the office
 * - vault-01    exists, but only web-01 can reach it
 */
import type { FsEntrySpec, ScenarioSpec } from "../types";

const linux = { family: "linux", name: "Linux", version: "6.8" } as const;
const ssh = { port: 22, protocol: "tcp", name: "ssh", product: "sshd", version: "9.6" } as const;

const AUTH_LOG = [
  "2026-03-01T22:14:03Z INFO sshd[811]: Accepted password for alex from 10.0.1.10 port 51022",
  "2026-03-01T23:02:44Z WARN sshd[902]: Failed password for root from 10.0.1.20 port 40112",
  "2026-03-01T23:02:46Z WARN sshd[902]: Failed password for root from 10.0.1.20 port 40114",
  "2026-03-01T23:02:49Z WARN sshd[902]: Failed password for admin from 10.0.1.20 port 40118",
  "2026-03-01T23:02:51Z ERROR sshd[902]: Too many authentication failures for admin from 10.0.1.20",
  "2026-03-02T08:55:10Z INFO sshd[1044]: Accepted publickey for recruit from 10.0.1.10 port 52210",
];

const SYSLOG = [
  "2026-03-02T06:00:01Z INFO cron[400]: nightly backup started",
  "2026-03-02T06:04:17Z ERROR backup[401]: could not reach db-01 on port 5432",
  "2026-03-02T06:04:18Z WARN backup[401]: backup incomplete, retrying tomorrow",
  "2026-03-02T08:30:00Z INFO systemd[1]: Started session 12 of user recruit",
];

const WS_FILES: readonly FsEntrySpec[] = [
  {
    path: "/home/recruit/notes.txt",
    content:
      "Day 1 checklist:\n- Say hi to the team\n- Read the rules of engagement\n- Find out what's on the office network\n",
  },
  {
    path: "/home/recruit/.secret-note",
    content: "You found the hidden note! SIM{hidden-in-plain-sight}\n",
    mode: "600",
  },
  { path: "/home/recruit/logs", target: "/var/log" },
  {
    path: "/home/recruit/hashes.txt",
    content: [
      "svc-web:$1$xYz12$Fq0Wn2d9Lr5Kp8Tq3Vb7M.:20514:0:99999:7:::",
      "guest::20514:0:99999:7:::",
      "legacy:7A3E9C1F5B8D2E4A6C0F9B3D5E7A1C8F:20514:0:99999:7:::",
      "nobody:*:20514:0:99999:7:::",
      "",
    ].join("\n"),
  },
  { path: "/home/alex/todo.txt", content: "Rotate the backup password.\n" },
  { path: "/var/log/auth.log", content: `${AUTH_LOG.join("\n")}\n`, group: "adm", mode: "640" },
  { path: "/var/log/syslog", content: `${SYSLOG.join("\n")}\n` },
  { path: "/var/log/private.log", content: "root only\n", mode: "600" },
  { path: "/tmp/loop-a", target: "/tmp/loop-b" },
  { path: "/tmp/loop-b", target: "/tmp/loop-a" },
  { path: "/tmp/alex-scratch.txt", content: "scratch\n", owner: "alex", mode: "666" },
  { path: "/srv/shared", type: "dir", group: "adm", mode: "2775" },
];

export const FIXTURE_SCENARIO: ScenarioSpec = {
  id: "fixture-office",
  startTime: "2026-03-02T09:00:00Z",
  network: {
    subnets: [
      { cidr: "10.0.1.0/24", name: "office" },
      { cidr: "10.0.2.0/24", name: "servers" },
    ],
    hosts: [
      {
        id: "ws-01",
        hostname: "ws-01.corp.example",
        interfaces: [{ ip: "10.0.1.10", subnet: "10.0.1.0/24" }],
        os: linux,
        services: [{ ...ssh, banner: "SSH-2.0-sshd_9.6" }],
        users: [
          {
            name: "recruit",
            uid: 1000,
            groups: ["adm"],
            passwordHash: "$y$j9T$fixture0salt0$Q3m9ZpLw1Xk7Rv2Tn8Hc4Ys6Ub0Ae5Df1Gi3Jl7Mo9",
          },
          {
            name: "alex",
            uid: 1001,
            passwordHash:
              "$6$fixturesalt$Zq8Lm2Nw4Pr6Ts0Vx3Yb5Ce7Gh9Jk1Mn3Pq5Rs7Tu9Wx1Za3Bc5De7Fg9Hj1Kl3Mn5Pq7Rs9Tu1Vw3Xy5",
          },
        ],
        fs: { entries: WS_FILES },
      },
      {
        id: "web-01",
        hostname: "web-01.corp.example",
        interfaces: [
          { ip: "10.0.1.20", subnet: "10.0.1.0/24" },
          { ip: "10.0.2.20", subnet: "10.0.2.0/24" },
        ],
        os: linux,
        services: [
          ssh,
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
                  title: "Staff portal",
                  body: "<html><head><title>Staff portal</title></head><body><!-- TODO: remove the test account before launch --><h1>Welcome</h1><!-- build note: SIM{view-source} --></body></html>",
                },
                "/admin": { status: 401, title: "Sign in required" },
                "/old": { status: 301, headers: { Location: "/" } },
              },
            },
          },
        ],
      },
      {
        id: "printer-01",
        hostname: "printer-01",
        interfaces: [{ ip: "10.0.1.30", subnet: "10.0.1.0/24" }],
        os: { family: "embedded", name: "Printer firmware" },
        respondsToPing: false,
        services: [
          {
            port: 80,
            protocol: "tcp",
            name: "http",
            product: "printd-web",
            version: "1.2",
            http: { pages: { "/": { status: 200, title: "Printer status" } } },
          },
          { port: 9100, protocol: "tcp", name: "printer", product: "printd", version: "1.2" },
        ],
      },
      {
        id: "db-01",
        hostname: "db-01.corp.example",
        interfaces: [{ ip: "10.0.2.40", subnet: "10.0.2.0/24" }],
        os: linux,
        reachableFrom: ["10.0.1.0/24", "10.0.2.0/24"],
        services: [
          { ...ssh, reachableFrom: ["10.0.2.0/24"] },
          {
            port: 5432,
            protocol: "tcp",
            name: "sql",
            product: "sqld",
            version: "15.4",
            reachableFrom: ["web-01"],
          },
        ],
      },
      {
        id: "vault-01",
        hostname: "vault-01.corp.example",
        interfaces: [{ ip: "10.0.2.50", subnet: "10.0.2.0/24" }],
        os: linux,
        reachableFrom: ["web-01"],
        services: [
          {
            port: 443,
            protocol: "tcp",
            name: "https",
            product: "httpd",
            version: "2.4.58",
            http: { pages: { "/": { status: 200, title: "Vault" } } },
          },
        ],
      },
    ],
  },
  session: { host: "ws-01", user: "recruit" },
  flags: [
    { id: "hidden-note", token: "SIM{hidden-in-plain-sight}" },
    { id: "view-source", token: "SIM{view-source}" },
  ],
};

export const FIXTURE_SEED = 20260302;
