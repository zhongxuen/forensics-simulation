import { describe, expect, it } from "vitest";
import { WORKSTATION } from "@/content/sandbox/workstation";
import { findBannedWords } from "@/content/voice";
import { createTerminalSession, submitLine, type TerminalSessionState } from "@/features/terminal";
import { createInitialState } from "@/sim";

/**
 * The sandbox's analyst workstation (docs/plan/01-foundation.md, "Done when": `/sandbox` shows the
 * vendored terminal on a tiny workstation machine, and `ls`, `cat`, `grep` work). Adapted from
 * Hacker Simulation's tests/unit/sandbox-scenarios.test.ts.
 */

function runOk(session: TerminalSessionState, command: string): TerminalSessionState {
  const next = submitLine(session, command);
  const block = next.blocks.at(-1);
  expect(block?.exitCode, command).toBe(0);
  expect(
    block?.lines.some((line) => line.error),
    command,
  ).toBe(false);
  return next;
}

const outputOf = (session: TerminalSessionState): string =>
  (session.blocks.at(-1)?.lines ?? []).map((line) => line.text).join("\n");

describe("the analyst workstation", () => {
  it("builds with the engine, in the Candlewright blue-team room", () => {
    const state = createInitialState(WORKSTATION.scenario, WORKSTATION.seed);
    expect(state.scenarioId).toBe(WORKSTATION.id);
    expect(state.session).toMatchObject({ hostId: "ir-ws-01", user: "examiner" });
    for (const host of Object.values(state.network.hosts)) {
      expect(host.interfaces.every((iface) => iface.ip.startsWith("10.20.0."))).toBe(true);
      expect(host.hostname.endsWith(".candlewright.example")).toBe(true);
    }
  });

  it("has a short, plain description", () => {
    expect(WORKSTATION.description.length).toBeLessThan(120);
    for (const text of [
      WORKSTATION.title,
      WORKSTATION.description,
      ...WORKSTATION.tryThis.map((idea) => idea.why),
    ]) {
      expect(findBannedWords(text), text).toEqual([]);
    }
  });

  it("suggests commands that work", () => {
    let session = createTerminalSession({ scenario: WORKSTATION.scenario, seed: WORKSTATION.seed });
    for (const { command } of WORKSTATION.tryThis) session = runOk(session, command);
  });

  it("runs ls, cat and grep on its own files", () => {
    let session = createTerminalSession({ scenario: WORKSTATION.scenario, seed: WORKSTATION.seed });
    session = runOk(session, "ls");
    expect(outputOf(session)).toContain("notes.txt");
    session = runOk(session, "cat notes.txt");
    expect(outputOf(session)).toContain("First week on the blue team");
    session = runOk(session, "grep -i warn /var/log/syslog");
    expect(outputOf(session)).toContain("/home is 60% full");
  });
});
