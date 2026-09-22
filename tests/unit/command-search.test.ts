import { describe, expect, it } from "vitest";
import { searchCommands, type SearchableCommand } from "@/lib/command-search";

const COMMANDS: readonly SearchableCommand[] = [
  { id: "campaign", label: "Campaign", description: "Your story", keywords: ["chapters"] },
  { id: "missions", label: "Missions", description: "Story episodes", keywords: ["play"] },
  { id: "terminal", label: "Terminal", description: "Control a computer by typing" },
  { id: "network", label: "Network", description: "See what you've discovered", keywords: ["map"] },
  { id: "start", label: "Start here: Welcome to the team", keywords: ["first mission"] },
];

const ids = (query: string) => searchCommands(COMMANDS, query).map((command) => command.id);

describe("searchCommands", () => {
  it("returns every command, in order, for an empty or blank query", () => {
    expect(ids("")).toEqual(["campaign", "missions", "terminal", "network", "start"]);
    expect(ids("   ")).toEqual(["campaign", "missions", "terminal", "network", "start"]);
  });

  it("ignores case and extra spaces", () => {
    expect(ids("  NETWORK ")).toEqual(["network"]);
  });

  it("finds commands by description and keywords, not only the label", () => {
    expect(ids("map")).toEqual(["network"]);
    expect(ids("typing")).toEqual(["terminal"]);
  });

  it("ranks label matches above description matches", () => {
    // "Start here" only has "mission" in a keyword.
    expect(ids("mission")).toEqual(["missions", "start"]);
  });

  it("ranks a label that starts with the query first, then a label word that does", () => {
    // Terminal starts with "te", "team" in Start here does, and Campaign's "chapters" contains it.
    expect(ids("te")).toEqual(["terminal", "start", "campaign"]);
  });

  it("needs every word typed to match somewhere", () => {
    expect(ids("story episodes")).toEqual(["missions"]);
    expect(ids("story dragons")).toEqual([]);
  });

  it("returns nothing when nothing matches", () => {
    expect(ids("xyz")).toEqual([]);
  });

  it("doesn't change the list it was given", () => {
    const before = [...COMMANDS];
    searchCommands(COMMANDS, "te");
    expect(COMMANDS).toEqual(before);
  });
});
