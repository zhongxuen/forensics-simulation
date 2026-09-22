import { describe, expect, it } from "vitest";
import { actor, testVfs } from "../__fixtures__/vfs";
import { buildFs } from "./builder";
import { accounts } from "../__fixtures__/vfs";
import { basename, dirname, isValidName, joinPath, normalizePath, splitPath } from "./path";
import { MAX_SYMLINK_DEPTH, resolveParent, resolvePath } from "./resolve";

const vfs = testVfs();
const recruit = actor("recruit");
const home = "/home/recruit";

const resolved = (path: string, options: { follow?: boolean } = {}, cwd = home, who = recruit) => {
  const result = resolvePath(vfs, who, cwd, path, options);
  return result.ok ? joinPath(result.value.parts) : result.error.code;
};

describe("path helpers", () => {
  it("split, join and normalize lexically", () => {
    expect(splitPath("/a//b/./c/")).toEqual(["a", "b", ".", "c"]);
    expect(joinPath([])).toBe("/");
    expect(normalizePath("../../../../etc/passwd", "/home/recruit")).toBe("/etc/passwd");
    expect(normalizePath("./docs/../notes.txt", "/home/recruit")).toBe("/home/recruit/notes.txt");
    expect(basename("/a/b.txt")).toBe("b.txt");
    expect(dirname("/a/b.txt")).toBe("/a");
    expect(dirname("b.txt")).toBe(".");
  });

  it("validates new names", () => {
    expect(isValidName("notes.txt")).toBe(true);
    expect(isValidName("__proto__")).toBe(true);
    for (const bad of ["", ".", "..", "a/b", "a\0b", "x".repeat(256)])
      expect(isValidName(bad)).toBe(false);
  });
});

describe("resolvePath", () => {
  it("resolves absolute and relative paths, . and ..", () => {
    expect(resolved("/home/recruit/notes.txt")).toBe("/home/recruit/notes.txt");
    expect(resolved("notes.txt")).toBe("/home/recruit/notes.txt");
    expect(resolved("./docs/../notes.txt")).toBe("/home/recruit/notes.txt");
    expect(resolved(".")).toBe("/home/recruit");
    expect(resolved("/")).toBe("/");
  });

  it("never climbs above the root, however many .. there are", () => {
    expect(resolved("../../../../../../etc/passwd")).toBe("/etc/passwd");
    expect(resolved("/../../..")).toBe("/");
  });

  it("follows symlinks in the middle of a path, and at the end unless asked not to", () => {
    expect(resolved("to-log/auth.log")).toBe("/var/log/auth.log");
    expect(resolved("to-log")).toBe("/var/log");
    expect(resolved("to-log", { follow: false })).toBe("/home/recruit/to-log");
    expect(resolved("rel-link")).toBe("/home/recruit/docs/plan.txt");
  });

  it("treats .. after a symlink physically, like the kernel", () => {
    expect(resolved("to-log/..")).toBe("/var");
  });

  it("reports a dangling symlink as ENOENT, unless not following it", () => {
    expect(resolved("dangling")).toBe("ENOENT");
    expect(resolved("dangling", { follow: false })).toBe("/home/recruit/dangling");
  });

  it("stops symlink loops with ELOOP", () => {
    expect(resolved("/tmp/loop-a")).toBe("ELOOP");
    expect(resolved("/tmp/self")).toBe("ELOOP");
    expect(resolved("/tmp/loop-a/anything")).toBe("ELOOP");
    expect(resolved("/tmp/loop-a", { follow: false })).toBe("/tmp/loop-a");
  });

  it("allows long symlink chains up to the depth limit, and no further", () => {
    const chain = (length: number) =>
      buildFs(
        {
          entries: [
            { path: "/target.txt", content: "end" },
            ...Array.from({ length }, (_, i) => ({
              path: `/l${i}`,
              target: i === length - 1 ? "/target.txt" : `/l${i + 1}`,
            })),
          ],
        },
        { accounts, hostname: "box", defaultMtime: 0 },
      );
    const at = (length: number) => resolvePath(chain(length), recruit, "/", "/l0");
    expect(at(MAX_SYMLINK_DEPTH).ok).toBe(true);
    expect(at(MAX_SYMLINK_DEPTH + 1)).toMatchObject({ ok: false, error: { code: "ELOOP" } });
  });

  it("reports ENOENT and ENOTDIR", () => {
    expect(resolved("missing.txt")).toBe("ENOENT");
    expect(resolved("notes.txt/more")).toBe("ENOTDIR");
    expect(resolved("notes.txt/")).toBe("ENOTDIR");
    expect(resolved("")).toBe("ENOENT");
  });

  it("needs search (x) permission on every directory it passes through", () => {
    expect(resolved("/locked/inside.txt")).toBe("EACCES");
    expect(resolved("/home/alex/diary.txt")).toBe("EACCES");
    expect(resolved("/home/alex/diary.txt", {}, "/", actor("alex"))).toBe("/home/alex/diary.txt");
    expect(resolved("/locked/inside.txt", {}, "/", actor("root"))).toBe("/locked/inside.txt");
  });

  it("keeps the typed path in errors, the way real tools print it", () => {
    const result = resolvePath(vfs, recruit, home, "../alex/diary.txt");
    expect(result).toEqual({ ok: false, error: { code: "EACCES", path: "../alex/diary.txt" } });
  });

  it("looks names up as own properties, so object built-ins aren't files", () => {
    expect(resolved("constructor")).toBe("ENOENT");
    expect(resolved("__proto__")).toBe("ENOENT");
    expect(resolved("toString/x")).toBe("ENOENT");
  });

  it("fails cleanly when the working directory has been deleted", () => {
    expect(resolved("notes.txt", {}, "/gone/away")).toBe("ENOENT");
  });
});

describe("resolveParent", () => {
  it("returns the parent directory and the final name as typed", () => {
    const result = resolveParent(vfs, recruit, home, "docs/new.txt");
    expect(result.ok && [joinPath(result.value.dirParts), result.value.name]).toEqual([
      "/home/recruit/docs",
      "new.txt",
    ]);
  });

  it("refuses the root, and . or .. as a final name", () => {
    expect(resolveParent(vfs, recruit, home, "/")).toMatchObject({
      error: { code: "EBUSY", detail: "root" },
    });
    expect(resolveParent(vfs, recruit, home, "docs/..")).toMatchObject({
      error: { code: "EINVAL", detail: "dot-path" },
    });
  });

  it("reports a parent that isn't a directory", () => {
    expect(resolveParent(vfs, recruit, home, "notes.txt/child")).toMatchObject({
      error: { code: "ENOTDIR" },
    });
  });
});
