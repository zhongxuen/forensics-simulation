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

function Playground({ suggestions }: { suggestions?: readonly string[] }) {
  const session = useTerminalSession({
    scenario: WORKSTATION.scenario,
    seed: WORKSTATION.seed,
  });
  return <Terminal session={session} {...(suggestions && { suggestions })} />;
}

const SHA256 = "cc20b7947fd925ecbd62268a6f2c581c955a807e69380b6abc112c1a6e66b209";

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

    // Reset machine and Copy transcript live in the header's menu; Help stays a button.
    expect(screen.queryByRole("button", { name: "Reset machine" })).toBeNull();
    expect(screen.getByRole("button", { name: /Help/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /More/ }));
    expect(screen.getByRole("menuitem", { name: "Copy transcript" })).toBeTruthy();
    await user.click(screen.getByRole("menuitem", { name: "Reset machine" }));
    expect(screen.getByText("The practice machine is back to how it started.")).toBeTruthy();
    await user.type(prompt(), "ls{Enter}");
    // Earlier output stays on screen; the newest ls shows the machine as it started.
    const listings = within(output()).getAllByRole("region", { name: "Command: ls" });
    expect(listings.at(-1)!.textContent).not.toContain("made-by-me.txt");
    expect(document.activeElement).toBe(prompt());
  });

  it("suggests what it's given in place of its own chips, and hides an empty list", async () => {
    const { unmount } = render(<Playground />);
    expect(screen.getByText("Try:")).toBeTruthy();
    expect(screen.getByRole("button", { name: "cat README.txt" })).toBeTruthy();
    unmount();

    const user = userEvent.setup();
    const { unmount: unmountCase } = render(<Playground suggestions={["blocker", "pin"]} />);
    expect(screen.queryByRole("button", { name: "cat README.txt" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "blocker" }));
    // A chip fills the prompt and never runs it.
    expect((prompt() as HTMLInputElement).value).toBe("blocker");
    unmountCase();

    render(<Playground suggestions={[]} />);
    expect(screen.queryByText("Try:")).toBeNull();
  });

  it("puts What just happened? after the output, never on the command line", async () => {
    const user = userEvent.setup();
    render(<Playground />);
    await user.type(prompt(), "whoami{Enter}");
    await user.type(prompt(), "pwd{Enter}");
    const first = within(output()).getByRole("region", { name: "Command: whoami" });
    const commandLine = first.querySelector("p")!;
    expect(commandLine.textContent).not.toMatch(/What just happened/);
    // An older block still has it, in the tab order, after everything it printed.
    const button = within(first).getByRole("button", { name: "What just happened?" });
    expect(button.tabIndex).toBe(0);
    expect(commandLine.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await user.click(button);
    expect(first.textContent).toMatch(/What just happened/);
    expect(within(first).getByRole("button", { name: "Hide explanation" })).toBeTruthy();
  });

  it("puts a hash on its own line with a Copy button, and keeps the line's text whole", async () => {
    const user = userEvent.setup();
    render(<Playground />);
    await user.type(prompt(), `echo SHA-256 ${SHA256} ok{Enter}`);
    const block = within(output()).getByRole("region", { name: /^Command: echo/ });
    const copy = within(block).getByRole("button", { name: `Copy ${SHA256.slice(0, 8)}…` });
    expect(copy.previousElementSibling?.textContent).toBe(SHA256);
    expect(copy.previousElementSibling?.className).toContain("break-all");
    expect(block.textContent).toContain("SHA-256");
    expect(block.textContent).toContain("ok");
  });
});
