import { describe, expect, it } from "vitest";
import { BUILTIN_TOOLS, defaultRegistry } from ".";
import { parseArgs } from "./args";
import { listTools } from "./catalog";
import { renderHelp, renderManPage, REAL_WORLD_HEADING } from "./help";
import { createRegistry } from "./registry";
import type { Tool } from "./types";

// From md-files/voice-and-tone.md, "Banned words". Whole words only.
const BANNED_WORDS =
  /\b(simply|just|merely|obviously|clearly|of course|as you know|easy|trivial|basic|invalid|illegal|wrong|victim|n00b|script kiddie|1337|h4x0r)\b/i;

/** Names of real tools the simulated ones must never borrow. */
const REAL_TOOL_NAMES = [
  "nmap",
  "masscan",
  "nikto",
  "whatweb",
  "curl",
  "wget",
  "hashcat",
  "john",
  "hash-identifier",
  "hashid.py",
  "journalctl",
  // Forensics (docs/plan/04-disk-tools.md §Names). They may appear in a man page's
  // "Real-world equivalent" section, and never as a command name.
  "volatility",
  "autopsy",
  "ftkimager",
  "fls",
  "istat",
  "icat",
  "photorec",
  "foremost",
  "dd",
  "log2timeline",
  "plaso",
];

/** The simulated tools this game registers beside the Linux command set. */
const SECURITY_TOOL_TABLE = [
  "logview",
  ...["acquire", "blocker", "hashsum", "inode", "lsfs", "pin", "recover"],
  "timeline",
  ...["carve", "logq", "strings"],
];

/** The v1 command table from md-files/05-terminal-module.md, plus echo for redirection. */
const LINUX_COMMAND_TABLE = [
  ...["pwd", "ls", "cd", "tree"],
  ...["cat", "less", "head", "tail", "touch", "mkdir", "rm", "cp", "mv", "stat", "file"],
  ...["grep", "wc", "sort", "uniq", "cut", "sed", "echo"],
  ...["whoami", "id", "ps", "uname", "env", "history", "date"],
  ...["chmod", "chown", "sudo"],
  ...["ping", "hostname", "ifconfig"],
  ...["man", "help", "clear", "exit"],
];

describe("tool registry", () => {
  it("registers the security tools and the whole Linux command set", () => {
    const names = defaultRegistry.names();
    expect(names).toEqual(expect.arrayContaining([...SECURITY_TOOL_TABLE, ...LINUX_COMMAND_TABLE]));
    expect(names).toHaveLength(SECURITY_TOOL_TABLE.length + LINUX_COMMAND_TABLE.length);
    expect([...names].sort()).toEqual(names);
    expect(defaultRegistry.has("logview")).toBe(true);
    expect(defaultRegistry.get("nmap")).toBeUndefined();
  });

  it("refuses duplicate and malformed names", () => {
    const tool = BUILTIN_TOOLS[0] as Tool;
    expect(() => createRegistry([tool, tool])).toThrow(/registered twice/);
    expect(() => createRegistry([{ ...tool, name: "Bad Name" }])).toThrow(/lowercase/);
  });

  it("never uses a real tool's name", () => {
    for (const name of defaultRegistry.names()) expect(REAL_TOOL_NAMES).not.toContain(name);
  });

  it("lists every tool's name and one-liner, sorted, without running anything", () => {
    const tools = listTools();
    expect(tools.map((tool) => tool.name)).toEqual(defaultRegistry.names());
    expect(tools.find((tool) => tool.name === "logview")).toEqual({
      name: "logview",
      summary: defaultRegistry.get("logview")?.help.oneLiner,
      category: "investigate",
    });
    const custom = createRegistry([BUILTIN_TOOLS[0] as Tool]);
    expect(listTools(custom).map((tool) => tool.name)).toEqual(["logview"]);
  });

  it("names a real tool only in a man page's Real-world equivalent section", () => {
    const forensics = SECURITY_TOOL_TABLE.filter((name) => name !== "logview");
    for (const name of forensics) {
      const tool = defaultRegistry.get(name);
      expect(tool?.help.realWorld?.length, name).toBeGreaterThan(0);
      const page = renderManPage(name, (tool as Tool).help).map((line) => line.text);
      expect(page, name).toContain(REAL_WORLD_HEADING);
    }
  });
});

describe("tool help", () => {
  it.each(BUILTIN_TOOLS.map((tool) => [tool.name, tool] as const))(
    "%s has beginner-first help",
    (_, tool) => {
      const { help } = tool;
      // A plain-language one-liner first, readable in a few seconds.
      expect(help.oneLiner.length).toBeLessThan(110);
      expect(help.oneLiner.charAt(0)).toBe(help.oneLiner.charAt(0).toLowerCase());
      expect(help.usage.length).toBeGreaterThan(0);
      expect(help.description.length).toBeGreaterThan(0);
      expect(help.concept.length).toBeGreaterThan(0);
      expect(help.examples?.length).toBeGreaterThan(0);
      const all = [
        help.oneLiner,
        ...help.description,
        ...help.concept,
        ...(help.options ?? []).map((o) => o.text),
      ];
      for (const line of all) expect(line, line).not.toMatch(BANNED_WORDS);
      // Every example runs this tool: on its own, after sudo, or further along a pipeline.
      for (const example of help.examples ?? []) {
        const words = example.command.split(" ");
        const runs =
          words[0] === tool.name ||
          (words[0] === "sudo" && words[1] === tool.name) ||
          example.command.includes(`| ${tool.name} `) ||
          example.command.endsWith(`| ${tool.name}`);
        expect(runs, `${tool.name}: ${example.command}`).toBe(true);
      }
    },
  );

  it("renders the one-liner first and the concept last, under a simulation notice", () => {
    const lines = renderHelp("logview", (BUILTIN_TOOLS[0] as Tool).help).map((line) => line.text);
    expect(lines[0]).toMatch(/^logview - /);
    expect(lines[2]).toMatch(/^SIMULATED:/);
    expect(lines.indexOf("WHY IT MATTERS")).toBeGreaterThan(lines.indexOf("EXAMPLES"));
  });
});

describe("parseArgs", () => {
  const specs = [
    { names: ["-p", "--ports"], key: "ports", takesValue: true },
    { names: ["--no-ping"], key: "noPing" },
  ];

  it("reads short, long, inline and attached values", () => {
    for (const args of [["-p", "22"], ["--ports", "22"], ["--ports=22"], ["-p22"]]) {
      expect(parseArgs(args, specs), args.join(" ")).toEqual({
        ok: true,
        value: { options: { ports: "22" }, positionals: [] },
      });
    }
  });

  it("keeps positionals, and treats everything after -- as positional", () => {
    expect(parseArgs(["a", "--no-ping", "b", "--", "--ports"], specs)).toEqual({
      ok: true,
      value: { options: { noPing: true }, positionals: ["a", "b", "--ports"] },
    });
  });

  it("reports unknown options and missing values", () => {
    expect(parseArgs(["--fast"], specs)).toEqual({
      ok: false,
      error: { code: "BAD_FLAG", flag: "--fast" },
    });
    expect(parseArgs(["--no-ping=yes"], specs)).toMatchObject({
      ok: false,
      error: { code: "BAD_FLAG" },
    });
    expect(parseArgs(["-p"], specs)).toEqual({
      ok: false,
      error: { code: "MISSING_ARGUMENT", argument: "-p" },
    });
    expect(parseArgs(["-p", "--no-ping"], specs)).toMatchObject({
      ok: false,
      error: { code: "MISSING_ARGUMENT" },
    });
  });
});
