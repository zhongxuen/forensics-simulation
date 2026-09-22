import { describe, expect, it } from "vitest";
import { errorCodes, eventTypes, fixtureState, run, text } from "../../__fixtures__/harness";
import { screen, shell } from "../../__fixtures__/shell";
import { CLEAR_SCREEN } from "../../core/ansi";
import { BUILTIN_TOOLS, defaultRegistry } from "..";
import { renderManPage } from "../help";
import { commandGroups } from "./help";

describe("ping", () => {
  it("gets replies from a reachable host and puts it on the map", () => {
    const result = run(fixtureState(), "ping", "-c", "2", "web-01");
    const lines = text(result).split("\n");
    expect(lines[0]).toBe("PING web-01 (10.0.1.20) 56(84) bytes of data.");
    expect(lines[1]).toMatch(/^64 bytes from 10\.0\.1\.20: icmp_seq=1 ttl=64 time=\d/);
    expect(text(result)).toContain("2 packets transmitted, 2 received, 0% packet loss");
    expect(result.events).toContainEqual({
      type: "host.discovered",
      hostId: "web-01",
      ip: "10.0.1.20",
      via: "ping",
    });
    expect(result.exitCode).toBe(0);
  });

  it("gets no reply from a host that ignores pings, or one behind a firewall", () => {
    const state = fixtureState();
    const quiet = run(state, "ping", "10.0.1.30");
    expect(text(quiet)).toContain("4 packets transmitted, 0 received, 100% packet loss");
    expect(errorCodes(quiet)).toEqual(["HOST_UNREACHABLE"]);
    expect(eventTypes(quiet)).not.toContain("host.discovered");
    expect(quiet.state.discovery).toBe(state.discovery);
    expect(run(fixtureState(), "ping", "vault-01").exitCode).toBe(1);
  });

  it("answers from this computer for localhost", () => {
    expect(text(run(fixtureState(), "ping", "-c", "1", "localhost"))).toContain("1 received");
  });

  it("refuses real-world targets and unknown names", () => {
    expect(errorCodes(run(fixtureState(), "ping", "8.8.8.8"))).toEqual(["OUT_OF_SCOPE"]);
    expect(errorCodes(run(fixtureState(), "ping", "nowhere"))).toEqual(["HOST_NOT_FOUND"]);
    expect(errorCodes(run(fixtureState(), "ping"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(run(fixtureState(), "ping", "-c", "99", "web-01"))).toEqual(["BAD_ARGUMENT"]);
  });

  it("is deterministic for a seed", () => {
    expect(text(run(fixtureState(3), "ping", "web-01"))).toBe(
      text(run(fixtureState(3), "ping", "web-01")),
    );
  });
});

describe("man", () => {
  it("opens a manual page with the one-liner first and a CONCEPT section", () => {
    const result = run(fixtureState(), "man", "ls");
    const lines = text(result).split("\n");
    expect(lines[0]).toMatch(/^LS\(1\) +Candlewright: Incident Room manual +LS\(1\)$/);
    expect(lines[2]).toBe("NAME");
    expect(lines[3]).toBe(
      "       ls - list what's in a folder, like opening it in a file browser.",
    );
    expect(lines).toContain("SYNOPSIS");
    expect(lines).toContain("CONCEPT");
    expect(result.events[0]).toEqual({ type: "help.viewed", command: "ls" });
  });

  it("searches summaries with -k, and says when there's no page", () => {
    expect(text(run(fixtureState(), "man", "-k", "folder"))).toContain("ls (1)");
    const missing = run(fixtureState(), "man", "nmap");
    expect(text(missing)).toBe("No manual entry for nmap");
    expect(errorCodes(missing)).toEqual(["NO_MANUAL_ENTRY"]);
    expect(text(run(fixtureState(), "man"))).toBe(
      "What manual page do you want?\nFor example, try 'man man'.",
    );
  });
});

describe("help", () => {
  it("groups every command by what a beginner wants to do", () => {
    const result = text(run(fixtureState(), "help"));
    expect(result).toMatch(/Look around\s+pwd  ls  cd  tree/);
    expect(result).toMatch(/Read files\s+cat  less  head  tail/);
    const listed = commandGroups(defaultRegistry).flatMap((group) => group.commands);
    expect([...listed].sort()).toEqual(defaultRegistry.names());
  });

  it("shows one command's guide with help <command>", () => {
    expect(text(run(fixtureState(), "help", "grep"))).toContain("grep - find the lines");
    expect(text(run(fixtureState(), "help", "nmap"))).toBe(
      "bash: help: no help topics match 'nmap'.",
    );
  });
});

describe("clear and exit", () => {
  it("clear prints the clear-screen codes a terminal understands", () => {
    expect(screen(shell(fixtureState(), "clear"))).toBe(CLEAR_SCREEN);
  });

  it("exit logs out with a status", () => {
    const result = run(fixtureState(), "exit", "3");
    expect(text(result)).toBe("logout");
    expect(result.exitCode).toBe(3);
  });
});

describe("every command's manual page", () => {
  it.each(BUILTIN_TOOLS.map((tool) => [tool.name, tool] as const))(
    "%s opens with a plain one-liner and has a CONCEPT section",
    (name, tool) => {
      const lines = renderManPage(name, tool.help).map((line) => line.text);
      expect(lines[3]).toBe(`       ${name} - ${tool.help.oneLiner}`);
      const concept = lines.indexOf("CONCEPT");
      expect(concept).toBeGreaterThan(lines.indexOf("DESCRIPTION"));
      expect(lines[concept + 1]?.trim().length).toBeGreaterThan(40);
    },
  );
});
