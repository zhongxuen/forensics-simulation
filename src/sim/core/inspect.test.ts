import { describe, expect, it } from "vitest";
import { fixtureState } from "../__fixtures__/harness";
import { inspectPath, userCanAccess } from "./inspect";

describe("inspectPath", () => {
  const state = fixtureState();

  it("describes a file, as root, with its content", () => {
    expect(inspectPath(state, "ws-01", "/home/recruit/notes.txt")).toMatchObject({
      exists: true,
      path: "/home/recruit/notes.txt",
      kind: "file",
      mode: 0o644,
      owner: "recruit",
      group: "recruit",
      content: expect.stringContaining("Day 1 checklist"),
    });
  });

  it("sees into folders only their owner can enter", () => {
    expect(inspectPath(state, "ws-01", "/home/alex/todo.txt")).toMatchObject({
      exists: true,
      owner: "alex",
    });
    expect(inspectPath(state, "ws-01", "/var/log/private.log")).toMatchObject({ mode: 0o600 });
  });

  it("follows a final symlink unless asked not to", () => {
    expect(inspectPath(state, "ws-01", "/home/recruit/logs")).toMatchObject({
      exists: true,
      path: "/var/log",
      kind: "dir",
    });
    expect(inspectPath(state, "ws-01", "/home/recruit/logs", { follow: false })).toMatchObject({
      exists: true,
      path: "/home/recruit/logs",
      kind: "symlink",
      target: "/var/log",
    });
  });

  it("keeps the special mode bits", () => {
    expect(inspectPath(state, "ws-01", "/srv/shared")).toMatchObject({ kind: "dir", mode: 0o2775 });
    expect(inspectPath(state, "ws-01", "/tmp")).toMatchObject({ mode: 0o1777 });
  });

  it("reports missing paths, symlink loops, and hosts without a filesystem as not existing", () => {
    expect(inspectPath(state, "ws-01", "/home/recruit/nope.txt")).toEqual({ exists: false });
    expect(inspectPath(state, "ws-01", "/home/recruit/notes.txt/inside")).toEqual({
      exists: false,
    });
    expect(inspectPath(state, "ws-01", "/tmp/loop-a")).toEqual({ exists: false });
    expect(inspectPath(state, "ws-01", "/tmp/loop-a", { follow: false })).toMatchObject({
      kind: "symlink",
    });
    expect(inspectPath(state, "web-01", "/etc/hostname")).toEqual({ exists: false });
    expect(inspectPath(state, "no-such-host", "/")).toEqual({ exists: false });
  });

  it("resolves relative paths from the root folder", () => {
    expect(inspectPath(state, "ws-01", "home/recruit/../recruit/notes.txt")).toMatchObject({
      path: "/home/recruit/notes.txt",
    });
  });
});

describe("userCanAccess", () => {
  const state = fixtureState();
  const can = (user: string, path: string, access: "r" | "w" | "x" = "r") =>
    userCanAccess(state, "ws-01", user, path, access);

  it("applies the owner, group and other bits", () => {
    expect(can("recruit", "/home/recruit/notes.txt")).toBe(true);
    expect(can("recruit", "/var/log/auth.log")).toBe(true); // recruit is in adm
    expect(can("alex", "/var/log/auth.log")).toBe(false);
    expect(can("recruit", "/var/log/private.log")).toBe(false);
    expect(can("root", "/var/log/private.log")).toBe(true);
    expect(can("recruit", "/tmp/alex-scratch.txt", "w")).toBe(true);
    expect(can("recruit", "/home/recruit/notes.txt", "x")).toBe(false);
  });

  it("needs search permission on every folder on the way", () => {
    // notes.txt is readable by anyone (644), but alex can't enter /home/recruit (750).
    expect(inspectPath(state, "ws-01", "/home/recruit/notes.txt")).toMatchObject({ mode: 0o644 });
    expect(can("alex", "/home/recruit/notes.txt")).toBe(false);
  });

  it("follows symlinks", () => {
    expect(can("recruit", "/home/recruit/logs/syslog")).toBe(true);
    expect(can("recruit", "/home/recruit/logs/private.log")).toBe(false);
  });

  it("is false for unknown users, hosts and paths, and for loops", () => {
    expect(can("nobody-here", "/home/recruit/notes.txt")).toBe(false);
    expect(can("recruit", "/home/recruit/missing.txt")).toBe(false);
    expect(can("recruit", "/tmp/loop-a")).toBe(false);
    expect(userCanAccess(state, "web-01", "root", "/", "r")).toBe(false);
  });
});
