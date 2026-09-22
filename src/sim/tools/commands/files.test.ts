import { describe, expect, it } from "vitest";
import { errorCodes, eventTypes, fixtureState, run, text } from "../../__fixtures__/harness";
import { shell, shellSession } from "../../__fixtures__/shell";
import { sessionFs } from "../../core/session";
import type { SimState } from "../../core/types";
import { stat as statPath } from "../../fs/ops";

const info = (state: SimState, path: string) => {
  const { vfs, ctx } = sessionFs(state, 0);
  const result = statPath(vfs, ctx, path, { follow: false });
  return result.ok ? result.value : undefined;
};

describe("cat", () => {
  it("prints files in order, and numbers lines with -n", () => {
    expect(text(run(fixtureState(), "cat", "notes.txt"))).toMatch(/^Day 1 checklist:\n- Say hi/);
    expect(text(run(fixtureState(), "cat", "-n", "notes.txt")).split("\n")[0]).toBe(
      "     1  Day 1 checklist:",
    );
  });

  it("emits file.read with the real path, through links", () => {
    const result = run(fixtureState(), "cat", "logs/syslog");
    expect(result.events).toContainEqual({
      type: "file.read",
      hostId: "ws-01",
      path: "/var/log/syslog",
    });
  });

  it("keeps going past a missing file, and reports each failure in place", () => {
    const result = run(fixtureState(), "cat", "nope", "notes.txt", "/etc/shadow");
    const lines = text(result).split("\n");
    expect(lines[0]).toBe("cat: nope: No such file or directory");
    expect(lines.at(-1)).toBe("cat: /etc/shadow: Permission denied");
    expect(errorCodes(result)).toEqual(["ENOENT", "EACCES"]);
    expect(result.exitCode).toBe(1);
  });

  it("refuses folders, and asks for a file when given nothing", () => {
    expect(text(run(fixtureState(), "cat", "/tmp"))).toBe("cat: /tmp: Is a directory");
    expect(errorCodes(run(fixtureState(), "cat"))).toEqual(["MISSING_ARGUMENT"]);
  });

  it("reads piped text", () => {
    expect(text(shell(fixtureState(), "echo piped | cat"))).toBe("piped");
  });
});

describe("less", () => {
  it("shows the whole file, like cat", () => {
    expect(text(run(fixtureState(), "less", "notes.txt"))).toBe(
      text(run(fixtureState(), "cat", "notes.txt")),
    );
    expect(text(run(fixtureState(), "less", "-N", "notes.txt"))).toContain("     2  - Say hi");
  });
});

describe("head and tail", () => {
  it("show the first and last lines", () => {
    expect(text(run(fixtureState(), "head", "-n", "1", "/var/log/auth.log"))).toContain(
      "Accepted password for alex",
    );
    expect(text(run(fixtureState(), "tail", "-1", "/var/log/auth.log"))).toContain(
      "Accepted publickey for recruit",
    );
    expect(text(run(fixtureState(), "head", "-2", "notes.txt")).split("\n")).toHaveLength(2);
  });

  it("start from a line with tail -n +N, and count characters with -c", () => {
    expect(text(run(fixtureState(), "tail", "-n", "+4", "notes.txt"))).toBe(
      "- Find out what's on the office network",
    );
    expect(text(run(fixtureState(), "head", "-c", "3", "notes.txt"))).toBe("Day");
  });

  it("label several files", () => {
    const result = text(run(fixtureState(), "head", "-n", "1", "notes.txt", "hashes.txt"));
    expect(result).toBe(
      "==> notes.txt <==\nDay 1 checklist:\n\n==> hashes.txt <==\nsvc-web:$1$xYz12$Fq0Wn2d9Lr5Kp8Tq3Vb7M.:20514:0:99999:7:::",
    );
  });

  it("reject bad counts and work in pipelines", () => {
    expect(errorCodes(run(fixtureState(), "head", "-n", "lots", "notes.txt"))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(text(shell(fixtureState(), "cat notes.txt | tail -n 1"))).toBe(
      "- Find out what's on the office network",
    );
    expect(errorCodes(run(fixtureState(), "tail", "-f", "notes.txt"))).toEqual(["BAD_FLAG"]);
  });
});

describe("touch and mkdir", () => {
  it("touch creates an empty file and reports it", () => {
    const result = run(fixtureState(), "touch", "new.txt");
    expect(info(result.state, "new.txt")).toMatchObject({
      kind: "file",
      size: 0,
      owner: "recruit",
      mode: 0o644,
    });
    expect(result.events).toContainEqual({
      type: "file.changed",
      hostId: "ws-01",
      path: "/home/recruit/new.txt",
      change: "created",
    });
  });

  it("touch refuses a folder it can't write to", () => {
    const result = run(fixtureState(), "touch", "/etc/new.conf");
    expect(text(result)).toBe("touch: cannot touch '/etc/new.conf': Permission denied");
  });

  it("mkdir makes folders, with -p for parents and -m for permissions", () => {
    const result = run(fixtureState(), "mkdir", "-p", "case/logs");
    expect(info(result.state, "case/logs")?.kind).toBe("dir");
    expect(info(run(fixtureState(), "mkdir", "-m", "700", "private").state, "private")?.mode).toBe(
      0o700,
    );
    expect(text(run(fixtureState(), "mkdir", "logs"))).toBe(
      "mkdir: cannot create directory 'logs': File exists",
    );
    expect(text(run(fixtureState(), "mkdir", "a/b"))).toBe(
      "mkdir: cannot create directory 'a/b': No such file or directory",
    );
    expect(errorCodes(run(fixtureState(), "mkdir"))).toEqual(["MISSING_ARGUMENT"]);
  });
});

describe("rm", () => {
  it("deletes a file and reports it", () => {
    const result = run(fixtureState(), "rm", "notes.txt");
    expect(info(result.state, "notes.txt")).toBeUndefined();
    expect(result.events).toContainEqual({
      type: "file.changed",
      hostId: "ws-01",
      path: "/home/recruit/notes.txt",
      change: "deleted",
    });
  });

  it("needs -r for folders, and deletes them whole with it", () => {
    const made = run(fixtureState(), "mkdir", "-p", "junk/inner").state;
    expect(text(run(made, "rm", "junk"))).toBe("rm: cannot remove 'junk': Is a directory");
    expect(info(run(made, "rm", "-r", "junk").state, "junk")).toBeUndefined();
  });

  it("is quiet about missing files with -f", () => {
    expect(run(fixtureState(), "rm", "-f", "nope").exitCode).toBe(0);
    expect(text(run(fixtureState(), "rm", "nope"))).toBe(
      "rm: cannot remove 'nope': No such file or directory",
    );
  });

  it("respects permissions and the sticky bit on /tmp", () => {
    expect(text(run(fixtureState(), "rm", "/etc/hostname"))).toBe(
      "rm: cannot remove '/etc/hostname': Permission denied",
    );
    const sticky = run(fixtureState(), "rm", "/tmp/alex-scratch.txt");
    expect(text(sticky)).toBe("rm: cannot remove '/tmp/alex-scratch.txt': Operation not permitted");
    expect(errorCodes(sticky)).toEqual(["EPERM"]);
  });

  it("refuses rm -rf / unless the safety catch is turned off, then deletes only what it may", () => {
    const refused = run(fixtureState(), "rm", "-rf", "/");
    expect(text(refused)).toBe(
      "rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe",
    );
    expect(errorCodes(refused)).toEqual(["EBUSY", "EBUSY"]);
    const forced = run(fixtureState(), "rm", "-rf", "--no-preserve-root", "/");
    expect(forced.exitCode).toBe(1);
    expect(text(forced)).toContain("rm: cannot remove '/etc': Permission denied");
    expect(info(forced.state, "/etc/passwd")).toBeDefined();
  });

  it("refuses . and ..", () => {
    expect(text(run(fixtureState(), "rm", "-r", ".."))).toBe(
      "rm: refusing to remove '.' or '..' directory: skipping '..'",
    );
  });
});

describe("cp and mv", () => {
  it("cp copies a file, owned by the copier", () => {
    const result = run(fixtureState(), "cp", "/etc/hostname", "host.txt");
    expect(info(result.state, "host.txt")).toMatchObject({ owner: "recruit", kind: "file" });
    expect(text(run(result.state, "cat", "host.txt"))).toBe("ws-01.corp.example");
  });

  it("cp copies into a folder, several at once, and folders with -r", () => {
    const result = run(fixtureState(), "cp", "notes.txt", "hashes.txt", "/tmp");
    expect(info(result.state, "/tmp/notes.txt")).toBeDefined();
    expect(info(result.state, "/tmp/hashes.txt")).toBeDefined();
    const made = run(fixtureState(), "mkdir", "d").state;
    expect(text(run(made, "cp", "d", "e"))).toBe("cp: -r not specified; omitting directory 'd'");
    expect(info(run(made, "cp", "-r", "d", "e").state, "e")?.kind).toBe("dir");
  });

  it("cp reports missing and unreadable sources, and a missing destination", () => {
    expect(text(run(fixtureState(), "cp", "nope", "x"))).toBe(
      "cp: cannot stat 'nope': No such file or directory",
    );
    expect(text(run(fixtureState(), "cp", "/etc/shadow", "x"))).toBe(
      "cp: cannot open '/etc/shadow': Permission denied",
    );
    expect(text(run(fixtureState(), "cp", "notes.txt"))).toBe(
      "cp: missing destination file operand after 'notes.txt'\nTry 'cp --help' for more information.",
    );
    expect(text(run(fixtureState(), "cp", "a", "b", "notes.txt"))).toBe(
      "cp: target 'notes.txt': Not a directory",
    );
  });

  it("mv renames and moves, keeping the owner", () => {
    const renamed = run(fixtureState(), "mv", "notes.txt", "todo.txt");
    expect(info(renamed.state, "notes.txt")).toBeUndefined();
    expect(info(renamed.state, "todo.txt")?.owner).toBe("recruit");
    expect(renamed.events).toContainEqual({
      type: "file.changed",
      hostId: "ws-01",
      path: "/home/recruit/todo.txt",
      change: "moved",
    });
    const moved = run(fixtureState(), "mv", "notes.txt", "/srv/shared");
    expect(info(moved.state, "/srv/shared/notes.txt")).toBeDefined();
    expect(text(run(fixtureState(), "mv", "/etc/hostname", "."))).toBe(
      "mv: cannot stat '/etc/hostname': Permission denied",
    );
  });
});

describe("stat and file", () => {
  it("stat shows size, permissions, owner and times", () => {
    const result = text(run(fixtureState(), "stat", "/etc/shadow"));
    expect(result).toContain("  File: /etc/shadow");
    expect(result).toContain("Access: (0640/-rw-r-----)  Uid: (    0/    root)   Gid: (");
    expect(result).toContain("regular file");
    expect(result).toContain("Modify: 2026-03-02 09:00:00.000000000 +0000");
    expect(text(run(fixtureState(), "stat", "nope"))).toBe(
      "stat: cannot statx 'nope': No such file or directory",
    );
  });

  it("file describes content, not names", () => {
    expect(text(run(fixtureState(), "file", "notes.txt"))).toBe("notes.txt: ASCII text");
    expect(text(run(fixtureState(), "file", "logs"))).toBe("logs: symbolic link to /var/log");
    expect(text(run(fixtureState(), "file", "-L", "logs"))).toBe("logs: directory");
    expect(text(run(fixtureState(), "file", "/etc/shadow"))).toBe(
      "/etc/shadow: regular file, no read permission",
    );
    const script = shellSession(fixtureState(), "echo '#!/bin/bash' > run.sh", "file run.sh").at(
      -1,
    )!;
    expect(text(script)).toBe("run.sh: Bourne-Again shell script, ASCII text executable");
    expect(eventTypes(run(fixtureState(), "file", "nope"))).toContain("command.run");
  });
});
