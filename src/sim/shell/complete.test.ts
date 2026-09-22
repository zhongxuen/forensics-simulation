import { describe, expect, it } from "vitest";
import { fixtureState, run } from "../__fixtures__/harness";
import { defaultRegistry } from "../tools";
import {
  closestMatches,
  completeCommandName,
  completePath,
  editDistance,
  suggestNextCommands,
  suggestPath,
} from "./complete";

describe("editDistance and closestMatches", () => {
  it("counts edits, with a swap of neighbours as one", () => {
    expect(editDistance("sl", "ls")).toBe(1);
    expect(editDistance("cat", "cat")).toBe(0);
    expect(editDistance("grpe", "grep")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
  });

  it("suggests the nearest commands, closest first", () => {
    const names = defaultRegistry.names();
    expect(closestMatches("sl", names)[0]).toBe("ls");
    expect(closestMatches("grpe", names)[0]).toBe("grep");
    expect(closestMatches("logveiw", names)).toContain("logview");
    expect(closestMatches("zzzzzz", names)).toEqual([]);
    expect(closestMatches("LS", names)[0]).toBe("ls");
  });
});

describe("completion", () => {
  it("completes command names", () => {
    expect(completeCommandName(defaultRegistry, "wh")).toEqual(["whoami"]);
    expect(completeCommandName(defaultRegistry, "c")).toEqual(
      expect.arrayContaining(["cat", "cd", "chmod", "chown", "clear", "cp", "cut"]),
    );
  });

  it("completes paths, marking folders, and hides dotfiles unless asked", () => {
    const state = fixtureState();
    expect(completePath(state, "no")).toEqual(["notes.txt"]);
    expect(completePath(state, "l")).toEqual(["logs/"]);
    expect(completePath(state, "")).toEqual(["hashes.txt", "logs/", "notes.txt"]);
    expect(completePath(state, ".s")).toEqual([".secret-note"]);
    expect(completePath(state, "/et")).toEqual(["/etc/"]);
    expect(completePath(state, "/etc/pa")).toEqual(["/etc/passwd"]);
    expect(completePath(state, "~/no")).toEqual(["~/notes.txt"]);
    expect(completePath(state, "/home/alex/")).toEqual([]);
    expect(completePath(state, "", { dirsOnly: true })).toEqual(["logs/"]);
  });
});

describe("suggestPath", () => {
  it("fixes a misspelt name to a real one nearby", () => {
    const state = fixtureState();
    expect(suggestPath(state, "note.txt")).toBe("notes.txt");
    expect(suggestPath(state, "/ect/passwd")).toBe("/etc/passwd");
    expect(suggestPath(state, "Notes.txt")).toBe("notes.txt");
    expect(suggestPath(state, "notes.txt")).toBeUndefined();
    expect(suggestPath(state, "completely-different")).toBeUndefined();
  });
});

describe("suggestNextCommands", () => {
  it("suggests commands that work where you are, always ending with help", () => {
    const home = suggestNextCommands(fixtureState());
    expect(home).toEqual(["ls", "cat hashes.txt", "cd logs", "ls -a", "help"]);
    const elsewhere = suggestNextCommands(run(fixtureState(), "cd", "/tmp").state);
    expect(elsewhere[0]).toBe("ls");
    expect(elsewhere).toContain("cd ~");
    expect(elsewhere.at(-1)).toBe("help");
  });
});
