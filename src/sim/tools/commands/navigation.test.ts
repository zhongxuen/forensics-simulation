import { describe, expect, it } from "vitest";
import { errorCodes, fixtureState, run, text } from "../../__fixtures__/harness";
import { screen, shell } from "../../__fixtures__/shell";
import { stripAnsi } from "../../core/ansi";

describe("pwd", () => {
  it("prints the working folder", () => {
    expect(text(run(fixtureState(), "pwd"))).toBe("/home/recruit");
  });

  it("refuses extra arguments and unknown options", () => {
    expect(run(fixtureState(), "pwd", "x").exitCode).toBe(2);
    expect(text(run(fixtureState(), "pwd", "-z"))).toContain("pwd: invalid option -- 'z'");
  });
});

describe("ls", () => {
  it("lists visible names one per line when not on screen", () => {
    expect(text(run(fixtureState(), "ls"))).toBe("hashes.txt\nlogs\nnotes.txt");
  });

  it("lays names out in columns on screen, and colours folders and links", () => {
    const result = shell(fixtureState(), "ls");
    expect(stripAnsi(screen(result))).toBe("hashes.txt  logs  notes.txt");
    expect(screen(result)).toContain("\x1b[01;36mlogs\x1b[0m");
    expect(stripAnsi(screen(shell(fixtureState(), "ls --color=never")))).toBe(
      screen(shell(fixtureState(), "ls --color=never")),
    );
  });

  it("shows hidden files with -a (including . and ..) and -A, sorted ignoring the dot", () => {
    // Like ls in an ordinary (not "C") locale: .secret-note sorts as "secret-note".
    expect(text(run(fixtureState(), "ls", "-a"))).toBe(
      ".\n..\nhashes.txt\nlogs\nnotes.txt\n.secret-note",
    );
    expect(text(run(fixtureState(), "ls", "-A"))).toBe("hashes.txt\nlogs\nnotes.txt\n.secret-note");
  });

  it("shows permissions, owner, size and time with -l, and a total", () => {
    const lines = text(run(fixtureState(), "ls", "-l")).split("\n");
    expect(lines[0]).toMatch(/^total \d+$/);
    expect(lines).toContainEqual(
      expect.stringMatching(/^-rw-r--r-- 1 recruit recruit\s+\d+ Mar  2 09:00 notes\.txt$/),
    );
    expect(lines).toContainEqual(expect.stringMatching(/^lrwxrwxrwx .* logs -> \/var\/log$/));
  });

  it("combines short options, like -la", () => {
    const result = text(run(fixtureState(), "ls", "-la"));
    expect(result).toContain(".secret-note");
    expect(result).toMatch(/^-rw------- 1 recruit recruit .* \.secret-note$/m);
  });

  it("reads permission-aware output for /etc", () => {
    const result = text(run(fixtureState(), "ls", "-la", "/etc"));
    expect(result).toMatch(/^-rw-r-----\s+1 root\s+shadow .* shadow$/m);
    expect(result).toMatch(/^-rw-r--r--\s+1 root\s+root .* passwd$/m);
    expect(text(run(fixtureState(), "cat", "/etc/passwd"))).toMatch(
      /^root:x:0:0:root:\/root:\/bin\/bash\nrecruit:x:1000:1000:recruit:\/home\/recruit:\/bin\/bash/,
    );
  });

  it("lists a file operand as itself, and folders under headers", () => {
    expect(text(run(fixtureState(), "ls", "notes.txt"))).toBe("notes.txt");
    expect(text(run(fixtureState(), "ls", "/srv", "/tmp"))).toBe(
      "/srv:\nshared\n\n/tmp:\nalex-scratch.txt\nloop-a\nloop-b",
    );
  });

  it("follows a link to a folder, unless -l or -d", () => {
    expect(text(run(fixtureState(), "ls", "logs"))).toBe("auth.log\nprivate.log\nsyslog");
    expect(text(run(fixtureState(), "ls", "-d", "logs"))).toBe("logs");
  });

  it("marks kinds with -F and sizes with -h", () => {
    expect(text(run(fixtureState(), "ls", "-F"))).toBe("hashes.txt\nlogs@\nnotes.txt");
    expect(text(run(fixtureState(), "ls", "-lh", "/"))).toMatch(/4\.0K .* home$/m);
  });

  it("sorts by time, size, and in reverse", () => {
    expect(text(run(fixtureState(), "ls", "-r"))).toBe("notes.txt\nlogs\nhashes.txt");
    expect(text(run(fixtureState(), "ls", "-S")).split("\n")[0]).toBe("hashes.txt");
  });

  it("lists recursively with -R", () => {
    const result = text(run(fixtureState(), "ls", "-R", "/srv"));
    expect(result).toBe("/srv:\nshared\n\n/srv/shared:");
  });

  it("reports missing and locked folders realistically, with typed errors", () => {
    const missing = run(fixtureState(), "ls", "nope");
    expect(text(missing)).toBe("ls: cannot access 'nope': No such file or directory");
    expect(missing.exitCode).toBe(2);
    const locked = run(fixtureState(), "ls", "/home/alex");
    expect(text(locked)).toBe("ls: cannot open directory '/home/alex': Permission denied");
    expect(errorCodes(locked)).toEqual(["EACCES"]);
    expect(errorCodes(run(fixtureState(), "ls", "--sideways"))).toEqual(["BAD_FLAG"]);
  });
});

describe("cd", () => {
  it("moves the session, and back with cd -", () => {
    const moved = run(fixtureState(), "cd", "/var/log");
    expect(moved.state.session.cwd).toBe("/var/log");
    expect(moved.state.session.env.PWD).toBe("/var/log");
    expect(moved.output).toEqual([]);
    const back = run(moved.state, "cd", "-");
    expect(back.state.session.cwd).toBe("/home/recruit");
    expect(text(back)).toBe("/home/recruit");
  });

  it("goes home with no argument, and understands .. and links", () => {
    const up = run(fixtureState(), "cd", "..");
    expect(up.state.session.cwd).toBe("/home");
    expect(run(up.state, "cd").state.session.cwd).toBe("/home/recruit");
    expect(run(fixtureState(), "cd", "logs").state.session.cwd).toBe("/var/log");
    expect(run(fixtureState(), "cd", "../../../..").state.session.cwd).toBe("/");
  });

  it("fails like bash for missing folders, files, and locked folders", () => {
    expect(text(run(fixtureState(), "cd", "nope"))).toBe(
      "bash: cd: nope: No such file or directory",
    );
    expect(text(run(fixtureState(), "cd", "notes.txt"))).toBe(
      "bash: cd: notes.txt: Not a directory",
    );
    const locked = run(fixtureState(), "cd", "/home/alex");
    expect(text(locked)).toBe("bash: cd: /home/alex: Permission denied");
    expect(locked.state.session.cwd).toBe("/home/recruit");
    expect(text(run(fixtureState(), "cd", "a", "b"))).toBe("bash: cd: too many arguments");
    expect(text(run(fixtureState(), "cd", "-"))).toBe("bash: cd: OLDPWD not set");
  });
});

describe("tree", () => {
  it("draws a folder as a tree, with a count", () => {
    expect(text(run(fixtureState(), "tree", "/srv"))).toBe(
      "/srv\n└── shared\n\n1 directory, 0 files",
    );
    const home = text(run(fixtureState(), "tree"));
    expect(home).toContain("├── hashes.txt");
    expect(home).toContain("├── logs -> /var/log");
    expect(home).toContain("└── notes.txt");
    expect(home).toMatch(/0 directories, 3 files$/);
  });

  it("shows hidden files with -a, limits depth with -L, and marks locked folders", () => {
    expect(text(run(fixtureState(), "tree", "-a"))).toContain(".secret-note");
    expect(text(run(fixtureState(), "tree", "-L", "1", "/home"))).toBe(
      "/home\n├── alex  [error opening dir]\n└── recruit\n\n2 directories, 0 files",
    );
    expect(errorCodes(run(fixtureState(), "tree", "-L", "0"))).toEqual(["BAD_ARGUMENT"]);
  });
});
