import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CaseRunner, PRACTICE_CASE } from "@/features/cases";
import { scopeItems } from "@/features/cases/components/briefing-scope";
import { createCaseStorage } from "@/lib/case-storage";

/**
 * The briefing (UIUX.md §2.4): the written permission as a letter, with what it covers as ticks
 * and what it leaves out as crosses, and Start case in a bar that stays on screen.
 */

const emptyStorage = () =>
  createCaseStorage({
    storage: () => {
      const items = new Map<string, string>();
      return {
        get length() {
          return items.size;
        },
        clear: () => items.clear(),
        getItem: (key) => items.get(key) ?? null,
        key: (index) => [...items.keys()][index] ?? null,
        removeItem: (key) => void items.delete(key),
        setItem: (key, value) => void items.set(key, String(value)),
      };
    },
  });

/** A chapter case's written permission, as its file has it. */
function authorization(id: string): string {
  const file = parse(readFileSync(`src/content/cases/${id}.yaml`, "utf8")) as {
    briefing: { authorization: string };
  };
  return file.briefing.authorization;
}

describe("scopeItems", () => {
  it("splits Case 1's letter into who signed, what it covers and what it leaves out", () => {
    expect(scopeItems(authorization("case-01"))).toEqual({
      signed: [
        "Delia Quillfen, who owns Quillfen Freight, and Theo Ashgrove, Candlewright's team lead, both signed on 13 April 2026.",
      ],
      allowed: ["The letter covers one machine, the yard office laptop qf-lt-03."],
      excluded: [
        "Nothing that belongs to a member of staff personally.",
        "The yard's other computers are out of scope.",
      ],
    });
  });

  it("puts every chapter case's machine in scope and something out of it, losing no words", () => {
    for (const [id, machine] of [
      ["case-01", "qf-lt-03"],
      ["case-02", "qf-lt-07"],
      ["case-03", "qf-srv-01"],
    ] as const) {
      const text = authorization(id);
      const { signed, allowed, excluded } = scopeItems(text);
      expect(allowed.join(" "), id).toContain(machine);
      expect(excluded.length, id).toBeGreaterThan(0);
      expect(excluded.join(" "), id).not.toContain(machine);
      const words = (value: string) => value.toLowerCase().match(/[a-z0-9-]+/g) ?? [];
      const kept = words([...signed, ...allowed, ...excluded].join(" "));
      // Every word survives, except the "and" before a split-off "nothing".
      expect(kept.length, id).toBeGreaterThanOrEqual(words(text).length - 1);
    }
  });

  it("reads the practice case's scope too", () => {
    const { allowed, excluded } = scopeItems(PRACTICE_CASE.client.scope);
    expect(allowed).toEqual([
      "The yard office laptop, qf-lt-03, and the office logs sent with it.",
    ]);
    expect(excluded).toEqual(["Nothing else: not staff phones, not anyone else's computers."]);
  });
});

describe("CaseBriefing", () => {
  it("shows the written permission as a signed letter, with scope as ticks and crosses", () => {
    render(<CaseRunner caseDef={PRACTICE_CASE} storage={emptyStorage()} />);
    const letter = screen.getByRole("region", { name: "Your written permission" });
    expect(within(letter).getByText("Signed:")).toBeTruthy();
    expect(letter.textContent).toContain(PRACTICE_CASE.client.signedBy);
    const allowed = within(letter).getByRole("list", { name: "You may examine" });
    expect(within(allowed).getAllByRole("listitem")[0]?.textContent).toMatch(/^In scope: /);
    const excluded = within(letter).getByRole("list", { name: "Out of scope" });
    expect(within(excluded).getAllByRole("listitem")[0]?.textContent).toMatch(/^Out of scope: /);
  });

  it("keeps Start case, the time and 'Hints are free' together in one bar", () => {
    render(<CaseRunner caseDef={PRACTICE_CASE} storage={emptyStorage()} />);
    const start = screen.getByRole("button", { name: "Start case" });
    const bar = start.closest(".sticky");
    expect(bar).toBeTruthy();
    expect(bar?.textContent).toContain(`About ${PRACTICE_CASE.estimatedMinutes} minutes`);
    expect(bar?.textContent).toContain("Hints are free");
    // Section headings use the type roles.
    expect(screen.getByRole("heading", { level: 2, name: "The situation" }).className).toContain(
      "type-section-title",
    );
  });
});
