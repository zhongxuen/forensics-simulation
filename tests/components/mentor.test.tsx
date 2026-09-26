import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CaseRunner, PRACTICE_CASE } from "@/features/cases";
import { createCaseStorage, type CaseStorage } from "@/lib/case-storage";

/**
 * Noor in the workspace, **with no API key and no server at all** (docs/plan/14-mentor.md §Done
 * when: "With no key, every hint is the authored text and nothing errors").
 *
 * `tests/components/setup.ts` makes `fetch` throw by default, so every mentor request here fails
 * the way it would on a laptop with no `ANTHROPIC_API_KEY`: the client catches it and resolves to
 * the text written ahead of time. That is the condition this file exists to prove — the player
 * gets the authored hint, word for word, and nothing anywhere surfaces as an error.
 *
 * jsdom's matchMedia matches nothing, so the workspace shows one view at a time.
 */

const CHUNK = { timeout: 15_000 };

const storage = (): CaseStorage => {
  const items = new Map<string, string>();
  return createCaseStorage({
    storage: () =>
      ({
        get length() {
          return items.size;
        },
        clear: () => items.clear(),
        getItem: (key: string) => items.get(key) ?? null,
        key: (index: number) => [...items.keys()][index] ?? null,
        removeItem: (key: string) => void items.delete(key),
        setItem: (key: string, value: string) => void items.set(key, String(value)),
      }) as Storage,
  });
};

const READ_LETTER = PRACTICE_CASE.objectives.find((o) => o.id === "read-letter")!;

async function startCase() {
  const user = userEvent.setup();
  render(<CaseRunner caseDef={PRACTICE_CASE} storage={storage()} />);
  await user.click(await screen.findByRole("button", { name: "Start case" }));
  return user;
}

/** Opens Noor's drawer the way a player does. */
async function openNoor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Ask Noor" }, CHUNK));
  return screen.getByRole("dialog", { name: "Ask Noor" });
}

describe("Noor's panel, with no key and no server", () => {
  it("only opens because the player asked", async () => {
    const user = await startCase();
    // Before anything is pressed, the drawer is there but hidden: the mentor never opens itself.
    const ask = await screen.findByRole("button", { name: "Ask Noor" }, CHUNK);
    expect(ask.getAttribute("aria-expanded")).toBe("false");
    await user.click(ask);
    expect(screen.getByRole("dialog", { name: "Ask Noor" })).toBeTruthy();
  });

  it("gives the authored hint verbatim, and says it came from her notes", async () => {
    const user = await startCase();
    const panel = await openNoor(user);

    expect(within(panel).getByText("Hints are free. Use as many as you like.")).toBeTruthy();
    await user.click(within(panel).getByRole("button", { name: "Show me a hint" }));

    // Word for word the hint the case file holds — no model, no network, no error.
    const hint = await within(panel).findByText(READ_LETTER.hints[0]!, undefined, CHUNK);
    expect(hint).toBeTruthy();
    expect(within(panel).getByText(/From Noor's notes, written ahead of time/)).toBeTruthy();
    expect(within(panel).getByText(/Hint 1 of 3 · a nudge/)).toBeTruthy();
  });

  it("holds the next tier back until the cooldown passes, and says so calmly", async () => {
    const user = await startCase();
    const panel = await openNoor(user);
    await user.click(within(panel).getByRole("button", { name: "Show me a hint" }));
    await within(panel).findByText(READ_LETTER.hints[0]!, undefined, CHUNK);

    const again = within(panel).getByRole("button", { name: "Show me another hint" });
    expect(again.getAttribute("aria-disabled")).toBe("true");
    expect(within(panel).getByText(/Give this one a try/)).toBeTruthy();
    // Pressing it anyway does nothing, and nothing errors.
    await user.click(again);
    expect(within(panel).queryByText(READ_LETTER.hints[1]!)).toBeNull();
  });

  it("closes on Escape and hands focus back", async () => {
    const user = await startCase();
    const ask = await screen.findByRole("button", { name: "Ask Noor" }, CHUNK);
    await user.click(ask);
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(ask);
  });

  it("never mentions an error, a score, or anything a hint costs", async () => {
    const user = await startCase();
    const panel = await openNoor(user);
    await user.click(within(panel).getByRole("button", { name: "Show me a hint" }));
    await within(panel).findByText(READ_LETTER.hints[0]!, undefined, CHUNK);
    const words = panel.textContent ?? "";
    for (const banned of ["error", "failed", "unavailable", "score", "penalty", "cost"]) {
      expect(words.toLowerCase()).not.toContain(banned);
    }
  });
});

describe("Explain this, with no key and no server", () => {
  it("explains a terminal line with the terminal's own words", async () => {
    const user = await startCase();
    // jsdom matches no media query, so the workspace shows one view at a time: the terminal is
    // the first tab.
    await user.click(await screen.findByRole("tab", { name: "Terminal" }, CHUNK));
    const prompt = await screen.findByRole("textbox", { name: /^Command, in/ }, CHUNK);
    await user.click(prompt);
    await user.keyboard("whoami{Enter}");

    // The per-command "Explain this" the terminal offers.
    const explain = await screen.findByRole("button", { name: /Explain this/ }, CHUNK);
    await user.click(explain);

    const panel = await screen.findByRole("dialog", { name: "Ask Noor" }, CHUNK);
    // The question is shown back to the player, with the command in code font (so the text is
    // split across elements and read off the panel as a whole).
    await vi.waitFor(() => expect(panel.textContent).toContain("You asked:"));
    expect(panel.textContent).toContain("whoami");
    // The answer is the walk-through the terminal already had, so it needs no model.
    expect(within(panel).getByText(/From Noor's notes, written ahead of time/)).toBeTruthy();
  });
});
