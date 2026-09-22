import { describe, expect, it } from "vitest";
import { accounts, as, T0, T1, testVfs } from "../__fixtures__/vfs";
import {
  chmod,
  chown,
  cp,
  listDir,
  mkdir,
  mv,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "./ops";
import { childOf, nodeAt } from "./tree";
import type { DirNode, Vfs } from "./types";

const vfs = testVfs();
const recruit = as("recruit");
const alex = as("alex");
const root = as("root");

/** Unwraps an ok result, failing the test with the error otherwise. */
function must<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

const code = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? "ok" : result.error?.code;
const read = (fs: Vfs, path: string, who = root) => must(readFile(fs, who, path));

describe("reading", () => {
  it("reads a file the user may read", () => {
    expect(read(vfs, "notes.txt", recruit)).toBe("hello\n");
    expect(read(vfs, "/var/log/auth.log", recruit)).toBe("entries\n"); // via the adm group
  });

  it("denies files the mode bits protect, and explains nothing itself", () => {
    expect(readFile(vfs, recruit, "/etc/shadow")).toEqual({
      ok: false,
      error: { code: "EACCES", path: "/etc/shadow" },
    });
    expect(code(readFile(vfs, alex, "/home/recruit/.hidden"))).toBe("EACCES");
    expect(code(readFile(vfs, alex, "/var/log/auth.log"))).toBe("EACCES");
    expect(read(vfs, "/etc/shadow")).toContain("recruit:!:");
  });

  it("refuses to read a directory as a file", () => {
    expect(code(readFile(vfs, recruit, "docs"))).toBe("EISDIR");
  });

  it("lists a directory sorted by name, without following links", () => {
    const names = must(listDir(vfs, recruit, ".")).map((entry) => `${entry.name}:${entry.kind}`);
    expect(names).toEqual([
      ".hidden:file",
      "dangling:symlink",
      "docs:dir",
      "notes.txt:file",
      "rel-link:symlink",
      "to-log:symlink",
    ]);
    expect(code(listDir(vfs, recruit, "/home/alex"))).toBe("EACCES");
    expect(code(listDir(vfs, recruit, "notes.txt"))).toBe("ENOTDIR");
  });

  it("stats and lstats", () => {
    expect(must(stat(vfs, recruit, "notes.txt"))).toMatchObject({
      path: "/home/recruit/notes.txt",
      kind: "file",
      owner: "recruit",
      group: "recruit",
      mode: 0o644,
      size: 6,
      mtime: T0,
    });
    expect(must(stat(vfs, recruit, "to-log")).path).toBe("/var/log");
    expect(must(stat(vfs, recruit, "to-log", { follow: false }))).toMatchObject({
      kind: "symlink",
      target: "/var/log",
    });
    expect(must(realpath(vfs, recruit, "to-log/../log/auth.log"))).toBe("/var/log/auth.log");
  });
});

describe("writing", () => {
  it("creates a file owned by the writer, with the default mode, and dates it", () => {
    const next = must(writeFile(vfs, recruit, "new.txt", "hi"));
    expect(must(stat(next, recruit, "new.txt"))).toMatchObject({
      owner: "recruit",
      group: "recruit",
      mode: 0o644,
      mtime: T1,
    });
    expect(must(stat(next, recruit, ".")).mtime).toBe(T1); // the directory changed too
  });

  it("overwrites and appends", () => {
    const over = must(writeFile(vfs, recruit, "notes.txt", "new"));
    expect(read(over, "/home/recruit/notes.txt")).toBe("new");
    const appended = must(writeFile(vfs, recruit, "notes.txt", "more\n", { append: true }));
    expect(read(appended, "/home/recruit/notes.txt")).toBe("hello\nmore\n");
  });

  it("writes through a symlink to its target", () => {
    const next = must(writeFile(vfs, recruit, "rel-link", "changed"));
    expect(read(next, "/home/recruit/docs/plan.txt")).toBe("changed");
  });

  it("never touches the old tree, and shares every untouched branch", () => {
    const next = must(writeFile(vfs, recruit, "notes.txt", "new"));
    expect(read(vfs, "/home/recruit/notes.txt")).toBe("hello\n");
    const var_ = (fs: Vfs) => childOf(fs.root, "var");
    expect(var_(next)).toBe(var_(vfs));
    expect(nodeAt(next.root, ["home", "recruit", "docs"])).toBe(
      nodeAt(vfs.root, ["home", "recruit", "docs"]),
    );
    expect(nodeAt(next.root, ["home", "recruit"])).not.toBe(nodeAt(vfs.root, ["home", "recruit"]));
  });

  it("denies writes without permission", () => {
    expect(code(writeFile(vfs, recruit, "/etc/passwd", "x"))).toBe("EACCES");
    expect(code(writeFile(vfs, recruit, "/etc/new.conf", "x"))).toBe("EACCES");
    expect(code(writeFile(vfs, alex, "/home/recruit/notes.txt", "x"))).toBe("EACCES");
    expect(code(writeFile(vfs, root, "/etc/new.conf", "x"))).toBe("ok");
  });

  it("reports impossible writes", () => {
    expect(code(writeFile(vfs, recruit, "docs", "x"))).toBe("EISDIR");
    expect(code(writeFile(vfs, recruit, "missing/new.txt", "x"))).toBe("ENOENT");
    expect(code(writeFile(vfs, recruit, "dangling", "x"))).toBe("ENOENT");
    expect(code(writeFile(vfs, recruit, "/", "x"))).toBe("EISDIR");
  });

  it("stores a file called __proto__ as an ordinary name", () => {
    const next = must(writeFile(vfs, recruit, "__proto__", "odd"));
    expect(read(next, "/home/recruit/__proto__")).toBe("odd");
    expect(must(listDir(next, recruit, ".")).map((e) => e.name)).toContain("__proto__");
    expect(({} as Record<string, unknown>).kind).toBeUndefined();
  });
});

describe("mkdir", () => {
  it("creates a directory, and refuses one that exists", () => {
    const next = must(mkdir(vfs, recruit, "projects"));
    expect(must(stat(next, recruit, "projects"))).toMatchObject({
      kind: "dir",
      owner: "recruit",
      mode: 0o755,
    });
    expect(code(mkdir(next, recruit, "projects"))).toBe("EEXIST");
    expect(code(mkdir(vfs, recruit, "dangling"))).toBe("EEXIST");
  });

  it("creates parents with -p, and accepts existing directories", () => {
    const next = must(mkdir(vfs, recruit, "a/b/c", { parents: true }));
    expect(must(stat(next, recruit, "a/b/c")).kind).toBe("dir");
    expect(code(mkdir(next, recruit, "a/b", { parents: true }))).toBe("ok");
    expect(code(mkdir(vfs, recruit, "notes.txt/x", { parents: true }))).toBe("ENOTDIR");
    expect(code(mkdir(vfs, recruit, "notes.txt", { parents: true }))).toBe("EEXIST");
  });

  it("needs a parent that exists and is writable", () => {
    expect(code(mkdir(vfs, recruit, "a/b"))).toBe("ENOENT");
    expect(code(mkdir(vfs, recruit, "/etc/new"))).toBe("EACCES");
  });

  it("passes a setgid directory's group down", () => {
    const next = must(mkdir(vfs, recruit, "/team/sub"));
    const withFile = must(writeFile(next, recruit, "/team/file.txt", "x"));
    expect(must(stat(next, recruit, "/team/sub"))).toMatchObject({ group: "team", mode: 0o2755 });
    expect(must(stat(withFile, recruit, "/team/file.txt")).group).toBe("team");
  });
});

describe("rm", () => {
  it("removes a file, and a symlink rather than its target", () => {
    const next = must(rm(vfs, recruit, "notes.txt"));
    expect(code(stat(next, recruit, "notes.txt"))).toBe("ENOENT");
    const unlinked = must(rm(vfs, recruit, "to-log"));
    expect(code(stat(unlinked, recruit, "/var/log/auth.log"))).toBe("ok");
  });

  it("needs -r for directories, and removes whole trees with it", () => {
    expect(code(rm(vfs, recruit, "docs"))).toBe("EISDIR");
    const next = must(rm(vfs, recruit, "docs", { recursive: true }));
    expect(code(stat(next, recruit, "docs/plan.txt"))).toBe("ENOENT");
  });

  it("ignores a missing file with force, and reports it without", () => {
    expect(code(rm(vfs, recruit, "missing"))).toBe("ENOENT");
    expect(must(rm(vfs, recruit, "missing", { force: true }))).toBe(vfs);
  });

  it("refuses the root and dot paths", () => {
    expect(rm(vfs, root, "/", { recursive: true })).toMatchObject({
      error: { code: "EBUSY", detail: "root" },
    });
    expect(rm(vfs, recruit, ".", { recursive: true })).toMatchObject({
      error: { code: "EINVAL", detail: "dot-path" },
    });
    expect(rm(vfs, recruit, "docs/..", { recursive: true })).toMatchObject({
      error: { code: "EINVAL" },
    });
  });

  it("lets root remove everything, and the tree stays valid", () => {
    let fs = vfs;
    for (const entry of must(listDir(fs, root, "/")))
      fs = must(rm(fs, root, entry.path, { recursive: true }));
    expect(must(listDir(fs, root, "/"))).toEqual([]);
    expect(read(vfs, "/etc/hostname")).toBe("box\n"); // the original is untouched: "Reset" is free
  });

  it("denies removal without write permission on the parent", () => {
    expect(code(rm(vfs, recruit, "/etc/passwd"))).toBe("EACCES");
  });

  it("protects other people's files in a sticky directory like /tmp", () => {
    expect(rm(vfs, recruit, "/tmp/alex.txt")).toMatchObject({
      error: { code: "EPERM", detail: "sticky" },
    });
    expect(code(rm(vfs, alex, "/tmp/alex.txt"))).toBe("ok");
    expect(code(rm(vfs, root, "/tmp/alex.txt"))).toBe("ok");
  });

  it("is all or nothing when part of a tree can't be removed", () => {
    // /shared-dir is world-writable, but root-owned/ inside it isn't writable by recruit.
    const result = rm(vfs, recruit, "/shared-dir/root-owned", { recursive: true });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "EACCES", path: "/shared-dir/root-owned" },
    });
  });
});

describe("mv", () => {
  it("renames, keeping owner, mode and mtime", () => {
    const next = must(mv(vfs, recruit, "notes.txt", "renamed.txt"));
    expect(code(stat(next, recruit, "notes.txt"))).toBe("ENOENT");
    expect(must(stat(next, recruit, "renamed.txt"))).toMatchObject({
      owner: "recruit",
      mode: 0o644,
      mtime: T0,
    });
  });

  it("moves into an existing directory", () => {
    const next = must(mv(vfs, recruit, "notes.txt", "docs"));
    expect(read(next, "/home/recruit/docs/notes.txt")).toBe("hello\n");
  });

  it("refuses to put a directory inside itself", () => {
    expect(mv(vfs, recruit, "docs", "docs/sub")).toMatchObject({
      error: { code: "EINVAL", detail: "into-itself" },
    });
  });

  it("treats moving onto itself as done", () => {
    expect(must(mv(vfs, recruit, "notes.txt", "notes.txt"))).toBe(vfs);
  });

  it("refuses to replace a directory with a file, or a file with a directory", () => {
    const withDir = must(mkdir(vfs, recruit, "docs2"));
    expect(code(mv(withDir, recruit, "docs", "notes.txt"))).toBe("ENOTDIR");
    const full = must(mkdir(vfs, recruit, "docs/notes.txt"));
    expect(code(mv(full, recruit, "notes.txt", "docs"))).toBe("EISDIR");
  });

  it("needs write permission on both directories", () => {
    expect(code(mv(vfs, recruit, "notes.txt", "/etc/notes.txt"))).toBe("EACCES");
    expect(code(mv(vfs, recruit, "/etc/passwd", "passwd"))).toBe("EACCES");
    expect(mv(vfs, recruit, "/tmp/alex.txt", "mine.txt")).toMatchObject({
      error: { code: "EPERM" },
    });
  });
});

describe("cp", () => {
  it("copies a file as the copier, with a fresh mtime", () => {
    const next = must(cp(vfs, recruit, "/var/log/auth.log", "auth-copy.log"));
    expect(must(stat(next, recruit, "auth-copy.log"))).toMatchObject({
      owner: "recruit",
      group: "recruit",
      mode: 0o640,
      mtime: T1,
    });
    expect(read(next, "/home/recruit/auth-copy.log")).toBe("entries\n");
  });

  it("can't copy what it can't read", () => {
    expect(code(cp(vfs, recruit, "/etc/shadow", "stolen"))).toBe("EACCES");
  });

  it("needs -r for directories, and copies trees with it", () => {
    expect(cp(vfs, recruit, "docs", "docs-copy")).toMatchObject({
      error: { code: "EISDIR", detail: "omit-directory" },
    });
    const next = must(cp(vfs, recruit, "docs", "docs-copy", { recursive: true }));
    expect(read(next, "/home/recruit/docs-copy/plan.txt")).toBe("step one\n");
    expect(code(cp(vfs, recruit, "docs", "docs/inner", { recursive: true }))).toBe("EINVAL");
  });

  it("overwrites an existing file's content but keeps its owner and mode", () => {
    const next = must(cp(vfs, recruit, "notes.txt", ".hidden"));
    expect(must(stat(next, recruit, ".hidden"))).toMatchObject({ mode: 0o600 });
    expect(read(next, "/home/recruit/.hidden")).toBe("hello\n");
  });

  it("refuses to copy a file onto itself", () => {
    expect(code(cp(vfs, recruit, "notes.txt", "notes.txt"))).toBe("EINVAL");
  });
});

describe("chmod and chown", () => {
  it("lets the owner change the mode, and nobody else but root", () => {
    const next = must(chmod(vfs, recruit, "notes.txt", 0o600));
    expect(must(stat(next, recruit, "notes.txt")).mode).toBe(0o600);
    expect(code(chmod(vfs, alex, "/home/recruit/notes.txt", 0o777))).toBe("EACCES"); // can't even get there
    expect(code(chmod(vfs, recruit, "/etc/passwd", 0o777))).toBe("EPERM");
    expect(code(chmod(vfs, root, "/etc/passwd", 0o600))).toBe("ok");
  });

  it("locks the owner out too, once they remove their own read bit", () => {
    const next = must(chmod(vfs, recruit, "notes.txt", 0o000));
    expect(code(readFile(next, recruit, "notes.txt"))).toBe("EACCES");
    expect(code(readFile(next, root, "/home/recruit/notes.txt"))).toBe("ok");
  });

  it("only lets root give files away", () => {
    expect(code(chown(vfs, recruit, accounts, "notes.txt", { owner: "alex" }))).toBe("EPERM");
    const given = must(chown(vfs, root, accounts, "/home/recruit/notes.txt", { owner: "alex" }));
    expect(must(stat(given, root, "/home/recruit/notes.txt")).owner).toBe("alex");
  });

  it("lets an owner change the group to one they belong to", () => {
    const next = must(chown(vfs, recruit, accounts, "notes.txt", { group: "team" }));
    expect(must(stat(next, recruit, "notes.txt")).group).toBe("team");
    expect(code(chown(vfs, recruit, accounts, "notes.txt", { group: "shadow" }))).toBe("EPERM");
  });

  it("rejects unknown users and groups", () => {
    expect(chown(vfs, root, accounts, "/tmp", { owner: "mallory" })).toMatchObject({
      error: { code: "EINVAL", detail: "unknown-user", value: "mallory" },
    });
    expect(chown(vfs, root, accounts, "/tmp", { group: "nope" })).toMatchObject({
      error: { code: "EINVAL", detail: "unknown-group" },
    });
  });
});

describe("the tree", () => {
  it("keeps the root a directory after every operation", () => {
    const next = must(mv(vfs, root, "/tmp", "/tmp2"));
    expect((next.root as DirNode).kind).toBe("dir");
  });
});
