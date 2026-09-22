import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { WORKSTATION } from "@/content/sandbox/workstation";
import { Terminal, useTerminalSession } from "@/features/terminal";

/**
 * The terminal as a learner uses it (md-files/05-terminal-module.md), in a simulated browser: type,
 * press keys, read the output. The server-rendered markup is tested in tests/unit; this is the
 * part only a DOM can show, like focus, keyboard shortcuts and the output changing as you type.
 */

function Playground() {
  const session = useTerminalSession({
    scenario: WORKSTATION.scenario,
    seed: WORKSTATION.seed,
  });
  return <Terminal session={session} />;
}

const prompt = () => screen.getByRole("textbox", { name: /^Command, in/ });
const output = () => screen.getByRole("log", { name: "Terminal output" });

describe("Terminal", () => {
  it("runs a typed command and shows its output, with the simulated marker", async () => {
    const user = userEvent.setup();
    render(<Playground />);
    expect(
      within(screen.getByRole("region", { name: "Terminal" })).getByText(/simulated/i),
    ).toBeTruthy();

    await user.type(prompt(), "whoami{Enter}");
    expect(within(output()).getByRole("region", { name: "Command: whoami" }).textContent).toContain(
      "examiner",
    );
    expect((prompt() as HTMLInputElement).value).toBe("");
  });

  it("explains a mistake in plain words and suggests the command you meant", async () => {
    const user = userEvent.setup();
    render(<Playground />);
    await user.type(prompt(), "sl{Enter}");
    const block = within(output()).getByRole("region", { name: "Command: sl" });
    expect(block.textContent).toMatch(/command not found/);
    expect(block.textContent).toMatch(/Did you mean/i);
  });

  it("brings back the last command with the up arrow", async () => {
    const user = userEvent.setup();
    render(<Playground />);
    await user.type(prompt(), "pwd{Enter}");
    await user.keyboard("{ArrowUp}");
    expect((prompt() as HTMLInputElement).value).toBe("pwd");
  });

  it("finishes a file name with Tab", async () => {
    const user = userEvent.setup();
    render(<Playground />);
    // The practice computer's home folder has notes.txt (src/content/sandbox/workstation.ts).
    const name = "notes.txt";
    await user.type(prompt(), `cat ${name.slice(0, 3)}`);
    await user.keyboard("{Tab}");
    expect((prompt() as HTMLInputElement).value).toBe(`cat ${name}`);
  });

  it("puts the machine back with Reset machine, and says so", async () => {
    const user = userEvent.setup();
    render(<Playground />);
    await user.type(prompt(), "touch made-by-me.txt{Enter}");
    await user.type(prompt(), "ls{Enter}");
    expect(output().textContent).toContain("made-by-me.txt");

    await user.click(screen.getByRole("button", { name: "Reset machine" }));
    expect(screen.getByText("The practice machine is back to how it started.")).toBeTruthy();
    await user.type(prompt(), "ls{Enter}");
    // Earlier output stays on screen; the newest ls shows the machine as it started.
    const listings = within(output()).getAllByRole("region", { name: "Command: ls" });
    expect(listings.at(-1)!.textContent).not.toContain("made-by-me.txt");
    expect(document.activeElement).toBe(prompt());
  });
});
