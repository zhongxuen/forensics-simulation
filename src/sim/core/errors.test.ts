import { describe, expect, it } from "vitest";
import { exitCodeFor, formatError, SIM_ERROR_CODES, type SimError } from "./errors";
import { SIM_EVENT_TYPES } from "./events";

/** One example of every error code, so each has a realistic message. */
const EXAMPLES: Record<(typeof SIM_ERROR_CODES)[number], SimError> = {
  ENOENT: { code: "ENOENT", path: "notes.txt" },
  EACCES: { code: "EACCES", path: "/etc/shadow" },
  EPERM: { code: "EPERM", path: "/etc/passwd" },
  ENOTDIR: { code: "ENOTDIR", path: "notes.txt/x" },
  EISDIR: { code: "EISDIR", path: "/tmp" },
  EEXIST: { code: "EEXIST", path: "/tmp" },
  ENOTEMPTY: { code: "ENOTEMPTY", path: "/home" },
  ELOOP: { code: "ELOOP", path: "/tmp/loop" },
  EINVAL: { code: "EINVAL", path: "a", detail: "into-itself" },
  EBUSY: { code: "EBUSY", path: "/", detail: "root" },
  UNKNOWN_COMMAND: { code: "UNKNOWN_COMMAND", command: "sl" },
  BAD_FLAG: { code: "BAD_FLAG", flag: "--fast" },
  MISSING_ARGUMENT: { code: "MISSING_ARGUMENT", argument: "target" },
  BAD_ARGUMENT: {
    code: "BAD_ARGUMENT",
    argument: "--ports",
    value: "99999",
    reason: "out-of-range",
  },
  HOST_NOT_FOUND: { code: "HOST_NOT_FOUND", target: "nowhere" },
  HOST_UNREACHABLE: { code: "HOST_UNREACHABLE", target: "10.0.2.50", port: 443 },
  CONNECTION_REFUSED: { code: "CONNECTION_REFUSED", target: "10.0.1.20", port: 8080 },
  PROTOCOL_MISMATCH: {
    code: "PROTOCOL_MISMATCH",
    target: "10.0.1.20",
    port: 22,
    expected: "http",
    found: "ssh",
  },
  OUT_OF_SCOPE: { code: "OUT_OF_SCOPE", target: "100.64.0.1" },
  EFBIG: { code: "EFBIG", path: "big.txt" },
  SUDO_DENIED: { code: "SUDO_DENIED", user: "recruit" },
  NO_MANUAL_ENTRY: { code: "NO_MANUAL_ENTRY", topic: "nmap" },
};

/** Codes whose real message doesn't start with the tool's name. */
const UNPREFIXED: readonly string[] = ["UNKNOWN_COMMAND", "NO_MANUAL_ENTRY"];

describe("error codes", () => {
  it("are unique", () => {
    expect(new Set(SIM_ERROR_CODES).size).toBe(SIM_ERROR_CODES.length);
  });

  it("each format to one terse line naming the tool or command", () => {
    for (const code of SIM_ERROR_CODES) {
      const line = formatError("demo", EXAMPLES[code]);
      expect(line, code).not.toContain("\n");
      if (!UNPREFIXED.includes(code)) expect(line.startsWith("demo:"), code).toBe(true);
    }
  });

  it("read like a real terminal", () => {
    expect(formatError("cat", EXAMPLES.EACCES)).toBe("cat: /etc/shadow: Permission denied");
    expect(formatError("cat", EXAMPLES.ENOENT)).toBe("cat: notes.txt: No such file or directory");
    expect(formatError("x", EXAMPLES.UNKNOWN_COMMAND)).toBe("sl: command not found");
    expect(formatError("man", EXAMPLES.NO_MANUAL_ENTRY)).toBe("No manual entry for nmap");
    expect(formatError("ls", { code: "BAD_FLAG", flag: "-z" })).toBe("ls: invalid option -- 'z'");
    expect(formatError("ls", { code: "BAD_FLAG", flag: "--fast" })).toBe(
      "ls: unrecognized option '--fast'",
    );
    expect(
      formatError("chown", { code: "EINVAL", path: "f", detail: "unknown-user", value: "bob" }),
    ).toBe("chown: invalid user: 'bob'");
  });

  it("map to shell exit codes", () => {
    expect(exitCodeFor(EXAMPLES.UNKNOWN_COMMAND)).toBe(127);
    expect(exitCodeFor(EXAMPLES.BAD_FLAG)).toBe(2);
    expect(exitCodeFor(EXAMPLES.ENOENT)).toBe(1);
  });
});

describe("event types", () => {
  it("are unique and namespaced", () => {
    expect(new Set(SIM_EVENT_TYPES).size).toBe(SIM_EVENT_TYPES.length);
    for (const type of SIM_EVENT_TYPES) expect(type).toMatch(/^[a-z]+\.[a-z]+$/);
  });
});
