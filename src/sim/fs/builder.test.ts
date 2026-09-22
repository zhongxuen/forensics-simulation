import { describe, expect, it } from "vitest";
import { accounts, as, testVfs } from "../__fixtures__/vfs";
import { ScenarioError } from "../core/scenario-error";
import { buildAccounts } from "./accounts";
import { buildFs } from "./builder";
import { formatMode, formatOctal, parseOctalMode } from "./mode";
import { readFile, stat } from "./ops";
import { canAccess } from "./perms";
import type { FsEntrySpec } from "./types";

const build = (entries: FsEntrySpec[], base: "linux" | "empty" = "empty") =>
  buildFs({ base, entries }, { accounts, hostname: "box", defaultMtime: 0 });

const problems = (entries: FsEntrySpec[]) => {
  try {
    build(entries);
  } catch (error) {
    if (error instanceof ScenarioError) return error.problems.join("\n");
    throw error;
  }
  throw new Error("expected the spec to be rejected");
};

describe("buildFs", () => {
  it("builds the linux base layout with generated account files", () => {
    const vfs = testVfs();
    const root = as("root");
    const passwd = readFile(vfs, root, "/etc/passwd");
    expect(passwd.ok && passwd.value.split("\n")[0]).toBe("root:x:0:0:root:/root:/bin/bash");
    expect(passwd.ok && passwd.value).toContain(
      "recruit:x:1000:1000:recruit:/home/recruit:/bin/bash",
    );
    const group = readFile(vfs, root, "/etc/group");
    expect(group.ok && group.value).toContain("team:x:");
    expect(group.ok && group.value).toMatch(/team:x:\d+:alex,recruit/);
    expect(stat(vfs, root, "/etc/shadow")).toMatchObject({
      value: { group: "shadow", mode: 0o640 },
    });
    expect(stat(vfs, root, "/tmp")).toMatchObject({ value: { mode: 0o1777 } });
    expect(stat(vfs, root, "/root")).toMatchObject({ value: { mode: 0o700 } });
    expect(stat(vfs, root, "/home/recruit")).toMatchObject({
      value: { owner: "recruit", mode: 0o750 },
    });
  });

  it("gives files under a home folder to that user by default", () => {
    const vfs = build([{ path: "/home/alex/a/b.txt", content: "x" }]);
    expect(stat(vfs, as("root"), "/home/alex/a")).toMatchObject({
      value: { owner: "alex", group: "alex" },
    });
    expect(stat(vfs, as("root"), "/home/alex/a/b.txt")).toMatchObject({
      value: { owner: "alex", mode: 0o644 },
    });
  });

  it("lets an entry redefine a directory's metadata without losing its contents", () => {
    const vfs = build([
      { path: "/srv/a.txt", content: "x" },
      { path: "/srv", type: "dir", mode: "700" },
    ]);
    expect(stat(vfs, as("root"), "/srv")).toMatchObject({ value: { mode: 0o700 } });
    expect(stat(vfs, as("root"), "/srv/a.txt").ok).toBe(true);
  });

  it("stores children in sorted order", () => {
    const vfs = build([
      { path: "/b", content: "" },
      { path: "/a", content: "" },
    ]);
    expect(Object.keys(vfs.root.children)).toEqual(["a", "b"]);
  });

  it("lists every problem in a spec", () => {
    const text = problems([
      { path: "relative/path", content: "" },
      { path: "/a/../b", content: "" },
      { path: "/nothing" },
      { path: "/f", content: "", owner: "mallory" },
      { path: "/g", content: "", mode: "999" },
      { path: "/h", content: "", mtime: "yesterday" },
      { path: "/x.txt", content: "" },
      { path: "/x.txt/under", content: "" },
      { path: "/dup", content: "" },
      { path: "/dup", content: "" },
    ]);
    expect(text).toMatch(/"relative\/path" must be an absolute path/);
    expect(text).toMatch(/"\/a\/..\/b" contains/);
    expect(text).toMatch(/"\/nothing": add content/);
    expect(text).toMatch(/owner "mallory" is not a user/);
    expect(text).toMatch(/mode "999" should be octal/);
    expect(text).toMatch(/mtime should be ISO-8601/);
    expect(text).toMatch(/\/x.txt is not a directory/);
    expect(text).toMatch(/"\/dup" is listed twice/);
  });
});

describe("buildAccounts", () => {
  it("always has root, and creates groups users mention", () => {
    const built = buildAccounts([{ name: "sam", uid: 1200, groups: ["ops"] }]);
    expect(built.users.root).toMatchObject({ uid: 0, gid: 0, home: "/root" });
    expect(built.users.sam).toMatchObject({
      gid: 1200,
      group: "sam",
      groups: ["ops"],
      home: "/home/sam",
    });
    expect(built.groups.ops?.members).toEqual(["sam"]);
  });

  it("rejects duplicate uids, uid 0 for anyone but root, and bad names", () => {
    expect(() =>
      buildAccounts([
        { name: "a", uid: 5 },
        { name: "b", uid: 5 },
      ]),
    ).toThrow(/uid 5 is used twice/);
    expect(() => buildAccounts([{ name: "toor", uid: 0 }])).toThrow(/only root may have uid 0/);
    expect(() => buildAccounts([{ name: "Bad Name", uid: 5 }])).toThrow(/should be lowercase/);
  });
});

describe("modes and permissions", () => {
  it("parses and formats modes", () => {
    expect(parseOctalMode("644")).toBe(0o644);
    expect(parseOctalMode("1777")).toBe(0o1777);
    expect(parseOctalMode("8")).toBeUndefined();
    expect(parseOctalMode("rwx")).toBeUndefined();
    expect(formatOctal(0o644)).toBe("0644");
    expect(formatMode("dir", 0o755)).toBe("drwxr-xr-x");
    expect(formatMode("file", 0o640)).toBe("-rw-r-----");
    expect(formatMode("dir", 0o1777)).toBe("drwxrwxrwt");
    expect(formatMode("file", 0o4755)).toBe("-rwsr-xr-x");
    expect(formatMode("file", 0o2644)).toBe("-rw-r-Sr--");
    expect(formatMode("symlink", 0o777)).toBe("lrwxrwxrwx");
  });

  it("uses only the first matching class: owner, then group, then other", () => {
    const node = {
      kind: "file",
      owner: "recruit",
      group: "team",
      mode: 0o047,
      mtime: 0,
      content: "",
    } as const;
    const recruit = as("recruit").actor;
    const alex = as("alex").actor;
    expect(canAccess(recruit, node, "r")).toBe(false); // owner bits are ---, even though others may read
    expect(canAccess(alex, node, "r")).toBe(true); // group bits r--
    expect(canAccess(alex, node, "w")).toBe(false);
  });

  it("lets root read and write anything, but execute only if some x bit is set", () => {
    const rootActor = as("root").actor;
    const file = {
      kind: "file",
      owner: "alex",
      group: "alex",
      mode: 0o600,
      mtime: 0,
      content: "",
    } as const;
    expect(canAccess(rootActor, file, "r")).toBe(true);
    expect(canAccess(rootActor, file, "w")).toBe(true);
    expect(canAccess(rootActor, file, "x")).toBe(false);
    expect(canAccess(rootActor, { ...file, mode: 0o700 }, "x")).toBe(true);
  });
});
