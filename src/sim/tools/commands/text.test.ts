import { describe, expect, it } from "vitest";
import { errorCodes, fixtureState, run, text } from "../../__fixtures__/harness";
import { screen, shell, shellSession } from "../../__fixtures__/shell";
import { stripAnsi } from "../../core/ansi";
import { compilePattern, translatePattern } from "./regex";

const AUTH = "/var/log/auth.log";

describe("grep", () => {
  it("prints matching lines, and exits 1 when nothing matches", () => {
    const result = run(fixtureState(), "grep", "Failed", AUTH);
    expect(text(result).split("\n")).toHaveLength(3);
    expect(result.exitCode).toBe(0);
    expect(run(fixtureState(), "grep", "zzz", AUTH).exitCode).toBe(1);
  });

  it("supports -i, -v, -n, -c, -w, -x and -o", () => {
    expect(text(run(fixtureState(), "grep", "-c", "-i", "failed", AUTH))).toBe("3");
    expect(text(run(fixtureState(), "grep", "-vc", "Failed", AUTH))).toBe("3");
    expect(text(run(fixtureState(), "grep", "-n", "Say", "notes.txt"))).toBe(
      "2:- Say hi to the team",
    );
    expect(text(run(fixtureState(), "grep", "-o", "port [0-9]*", AUTH)).split("\n")[0]).toBe(
      "port 51022",
    );
    expect(run(fixtureState(), "grep", "-w", "Fail", AUTH).exitCode).toBe(1);
    expect(text(run(fixtureState(), "grep", "-x", "Day 1 checklist:", "notes.txt"))).toBe(
      "Day 1 checklist:",
    );
  });

  it("reads basic and extended patterns, and fixed strings", () => {
    expect(text(run(fixtureState(), "grep", "-c", "root\\|admin", AUTH))).toBe("4");
    expect(text(run(fixtureState(), "grep", "-cE", "root|admin", AUTH))).toBe("4");
    expect(text(run(fixtureState(), "grep", "-c", "root|admin", AUTH))).toBe("0");
    expect(text(run(fixtureState(), "grep", "-F", "$1$", "hashes.txt"))).toContain("svc-web");
    expect(
      text(run(fixtureState(), "grep", "^- [[:upper:]]", "notes.txt")).split("\n"),
    ).toHaveLength(3);
  });

  it("names files when searching several, and lists files with -l", () => {
    expect(
      text(run(fixtureState(), "grep", "-l", "recruit", AUTH, "notes.txt", "hashes.txt")),
    ).toBe(AUTH);
    expect(text(run(fixtureState(), "grep", "-c", "e", "notes.txt", "hashes.txt"))).toBe(
      "notes.txt:4\nhashes.txt:3",
    );
  });

  it("searches folders with -r, reporting what it can't open", () => {
    const result = run(fixtureState(), "grep", "-r", "SIM{", "/home");
    expect(text(result)).toContain("/home/recruit/.secret-note:You found the hidden note!");
    expect(text(result)).toContain("grep: /home/alex: Permission denied");
    expect(result.exitCode).toBe(2);
  });

  it("highlights matches on screen only", () => {
    const onScreen = screen(shell(fixtureState(), "grep Say notes.txt"));
    expect(onScreen).toBe("- \x1b[01;31mSay\x1b[0m hi to the team");
    expect(screen(shell(fixtureState(), "grep Say notes.txt | cat"))).toBe("- Say hi to the team");
  });

  it("searches piped text", () => {
    expect(text(shell(fixtureState(), "cat /var/log/auth.log | grep -c Accepted"))).toBe("2");
  });

  it("rejects unreadable patterns and missing input", () => {
    expect(errorCodes(run(fixtureState(), "grep", "[abc", "notes.txt"))).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(run(fixtureState(), "grep", "x"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(run(fixtureState(), "grep"))).toEqual(["MISSING_ARGUMENT"]);
    expect(text(run(fixtureState(), "grep", "x", "/etc/shadow"))).toBe(
      "grep: /etc/shadow: Permission denied",
    );
  });
});

describe("regex translation", () => {
  it("keeps grep's basic syntax: + ? | ( ) are literal unless escaped", () => {
    expect(translatePattern("a+b", "basic")).toBe("a\\+b");
    expect(translatePattern("a\\+b", "basic")).toBe("a+b");
    expect(translatePattern("a+b", "extended")).toBe("a+b");
    expect(translatePattern("\\<word\\>", "basic")).toBe("\\bword\\b");
    expect(translatePattern("*star", "basic")).toBe("\\*star");
    expect(translatePattern("a.b", "fixed")).toBe("a\\.b");
    expect(translatePattern("[[:digit:]]", "basic")).toBe("[0-9]");
    expect(translatePattern("trailing\\", "basic")).toBeUndefined();
  });

  it("refuses patterns that are too long", () => {
    expect(compilePattern("a".repeat(300), { flavor: "basic" })).toBeUndefined();
  });
});

describe("wc", () => {
  it("counts lines, words and bytes", () => {
    expect(text(run(fixtureState(), "wc", "notes.txt"))).toBe("  4  23 109 notes.txt");
    expect(text(run(fixtureState(), "wc", "-l", "notes.txt"))).toBe("4 notes.txt");
    expect(text(run(fixtureState(), "wc", "-l", "notes.txt", "hashes.txt"))).toBe(
      "4 notes.txt\n4 hashes.txt\n8 total",
    );
  });

  it("counts piped text", () => {
    expect(text(shell(fixtureState(), "echo one two three | wc -w"))).toBe("3");
    expect(text(shell(fixtureState(), "echo one two | wc"))).toBe("      1       2       8");
  });
});

describe("sort, uniq and cut", () => {
  it("sort orders lines, numerically with -n, reversed with -r, by column with -k", () => {
    const start = shell(
      fixtureState(),
      "echo 10 > n.txt ; echo 9 >> n.txt ; echo 100 >> n.txt",
    ).state;
    expect(text(run(start, "sort", "n.txt"))).toBe("10\n100\n9");
    expect(text(run(start, "sort", "-n", "n.txt"))).toBe("9\n10\n100");
    expect(text(run(start, "sort", "-rn", "n.txt"))).toBe("100\n10\n9");
    expect(
      text(run(fixtureState(), "sort", "-t", ":", "-k", "3", "-n", "/etc/passwd")).split("\n")[0],
    ).toMatch(/^root:/);
    expect(errorCodes(run(fixtureState(), "sort", "-k", "x", "notes.txt"))).toEqual([
      "BAD_ARGUMENT",
    ]);
  });

  it("uniq squashes repeats, counting with -c", () => {
    const start = shell(
      fixtureState(),
      "echo a > l.txt ; echo a >> l.txt ; echo b >> l.txt ; echo a >> l.txt",
    ).state;
    expect(text(run(start, "uniq", "l.txt"))).toBe("a\nb\na");
    expect(text(run(start, "uniq", "-c", "l.txt"))).toBe("      2 a\n      1 b\n      1 a");
    expect(text(shell(start, "sort l.txt | uniq -c | sort -rn"))).toBe("      3 a\n      1 b");
    expect(text(run(start, "uniq", "-d", "l.txt"))).toBe("a");
  });

  it("cut keeps columns and characters", () => {
    expect(text(run(fixtureState(), "cut", "-d", ":", "-f", "1", "/etc/passwd"))).toBe(
      "root\nrecruit\nalex",
    );
    expect(
      text(run(fixtureState(), "cut", "-d", ":", "-f", "1,7", "/etc/passwd")).split("\n")[0],
    ).toBe("root:/bin/bash");
    expect(text(run(fixtureState(), "cut", "-c", "1-3", "notes.txt")).split("\n")[0]).toBe("Day");
    expect(errorCodes(run(fixtureState(), "cut", "notes.txt"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(run(fixtureState(), "cut", "-f", "0", "notes.txt"))).toEqual([
      "BAD_ARGUMENT",
    ]);
  });
});

describe("sed", () => {
  it("substitutes the first match, or every match with g", () => {
    expect(text(shell(fixtureState(), "echo aaa | sed s/a/b/"))).toBe("baa");
    expect(text(shell(fixtureState(), "echo aaa | sed s/a/b/g"))).toBe("bbb");
    expect(text(shell(fixtureState(), "echo aaa | sed s/a/b/2"))).toBe("aba");
    expect(text(shell(fixtureState(), "echo 'hello_world' | sed s/world/there/"))).toBe(
      "hello there",
    );
  });

  it("understands groups, & and other delimiters", () => {
    expect(text(shell(fixtureState(), "echo abc | sed s/b/[&]/"))).toBe("a[b]c");
    expect(text(shell(fixtureState(), "echo abc | sed -E s/(a)(b)/\\2\\1/"))).toBe("bac");
    expect(text(shell(fixtureState(), "echo /a/b | sed s|/|:|g"))).toBe(":a:b");
  });

  it("prints only changed lines with -n and p", () => {
    expect(text(run(fixtureState(), "sed", "-n", "s/Say/SAY/p", "notes.txt"))).toBe(
      "- SAY hi to the team",
    );
  });

  it("edits a file in place with -i, if allowed", () => {
    const edited = run(fixtureState(), "sed", "-i", "s/office/practice/", "notes.txt");
    expect(edited.output).toEqual([]);
    expect(text(run(edited.state, "cat", "notes.txt"))).toContain("practice network");
    expect(edited.events).toContainEqual({
      type: "file.changed",
      hostId: "ws-01",
      path: "/home/recruit/notes.txt",
      change: "modified",
    });
    expect(text(run(fixtureState(), "sed", "-i", "s/a/b/", "/etc/passwd"))).toBe(
      "sed: couldn't edit '/etc/passwd': Permission denied",
    );
  });

  it("explains scripts it can't read", () => {
    const result = run(fixtureState(), "sed", "d", "notes.txt");
    expect(text(result)).toBe("sed: -e expression #1, char 1: unknown command: `d'");
    expect(errorCodes(result)).toEqual(["BAD_ARGUMENT"]);
    expect(text(run(fixtureState(), "sed", "s/a/b", "notes.txt"))).toContain(
      "unterminated `s' command",
    );
  });
});

describe("echo", () => {
  it("prints its words, with -n and -e", () => {
    expect(text(run(fixtureState(), "echo", "hello", "world"))).toBe("hello world");
    expect(text(run(fixtureState(), "echo", "-e", "a\\nb"))).toBe("a\nb");
    expect(text(run(fixtureState(), "echo"))).toBe("");
    expect(text(run(fixtureState(), "echo", "-x"))).toBe("-x");
  });

  it("writes into files through redirection", () => {
    const [, read] = shellSession(fixtureState(), "echo 'first_note' > note.txt", "cat note.txt");
    expect(stripAnsi(text(read!))).toBe("first note");
  });
});
