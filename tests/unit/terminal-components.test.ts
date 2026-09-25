import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WORKSTATION } from "@/content/sandbox/workstation";
import { CommandCheatSheet, Terminal, useTerminalSession } from "@/features/terminal";

/**
 * The terminal renders on the server (no window during render) with real text in the DOM, the
 * roles and labels screen readers need, and the SIMULATED marker. Vitest runs in plain Node, so
 * this checks the markup; keyboard behaviour is covered through the session and beginner tests.
 */

function Harness({ startTour = false }: { startTour?: boolean }) {
  const session = useTerminalSession({
    scenario: WORKSTATION.scenario,
    seed: WORKSTATION.seed,
  });
  return createElement(Terminal, { session, startTour });
}

describe("Terminal", () => {
  const html = renderToStaticMarkup(createElement(Harness));

  it("renders an output log, a labelled prompt and a live region", () => {
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-label="Terminal output"');
    expect(html).toContain('aria-live="off"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toMatch(/<input[^>]*aria-label="Command, in ~"/);
    expect(html).toMatch(/<input[^>]*autoComplete="off"|<input[^>]*autocomplete="off"/i);
  });

  it("carries the SIMULATED marker and the toolbar actions", () => {
    expect(html).toContain("Simulated");
    // Copy transcript and Reset machine sit in the "More" menu, closed until it's opened.
    expect(html).toContain("More");
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain("Help");
  });

  it("shows the prompt and a first-time hint, and suggested commands in beginner mode", () => {
    expect(html).toContain("examiner@ir-ws-01");
    expect(html).toContain("Type a command and press Enter");
    expect(html).toContain("Try:");
    expect(html).toContain("cat README.txt");
  });

  it("renders with the tour requested, without touching the page on the server", () => {
    expect(() => renderToStaticMarkup(createElement(Harness, { startTour: true }))).not.toThrow();
  });
});

describe("CommandCheatSheet", () => {
  it("lists every command group with summaries", () => {
    const html = renderToStaticMarkup(createElement(CommandCheatSheet));
    for (const label of ["Look around", "Read files", "Find things", "Explore the network"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("List what&#x27;s in a folder");
    expect(html).toContain('aria-expanded="true"');
  });
});
