import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseRunner, PRACTICE_CASE } from "@/features/cases";
import { CASES_STORAGE_KEY, createCaseStorage, type CaseStorage } from "@/lib/case-storage";
import { StoredDataControls } from "@/app/(marketing)/privacy/stored-data-controls";

/**
 * The case runner as a player uses it (docs/plan/05-workspace-ui.md), in a simulated browser:
 * start the practice case, type in the terminal, tick objectives, reload, and play on with
 * storage blocked. jsdom's matchMedia matches nothing (tests/components/setup.ts), so the
 * workspace shows its narrow layout: one view at a time, with the terminal as the first tab.
 */

type Shelf = Map<string, string>;

function memoryStorage(items: Shelf): Storage {
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
}

function blockedStorage(): Storage {
  const refuse = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  return {
    length: 0,
    clear: refuse,
    getItem: refuse,
    key: refuse,
    removeItem: refuse,
    setItem: refuse,
  };
}

const storageOver = (shelf: Shelf): CaseStorage =>
  createCaseStorage({ storage: () => memoryStorage(shelf) });

const prompt = () => screen.getByRole("textbox", { name: /^Command, in/ });
const output = () => screen.getByRole("log", { name: "Terminal output" });
const tab = (name: string) => screen.getByRole("tab", { name });

// Everything after Start case, and each pane, arrives as its own chunk (the engine among them).
// Loading it can take more than Testing Library's one-second default when the whole suite runs.
const CHUNK = { timeout: 15_000 };

async function startCase(storage: CaseStorage) {
  const user = userEvent.setup();
  const { unmount } = render(<CaseRunner caseDef={PRACTICE_CASE} storage={storage} />);
  await user.click(screen.getByRole("button", { name: "Start case" }));
  await screen.findByRole("tab", { name: "Terminal" }, CHUNK);
  return Object.assign(user, { unmount });
}

async function run(user: ReturnType<typeof userEvent.setup>, line: string) {
  await user.click(tab("Terminal"));
  await user.type(prompt(), `${line}{Enter}`);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CaseRunner", () => {
  it("shows the briefing first: the team's two lines, the client, who signed, and the first objective", () => {
    render(<CaseRunner caseDef={PRACTICE_CASE} storage={storageOver(new Map())} />);
    expect(screen.getByRole("heading", { level: 1, name: PRACTICE_CASE.title })).toBeTruthy();
    const team = screen.getByRole("list", { name: "From the team" });
    expect(within(team).getAllByRole("listitem")).toHaveLength(2);
    expect(team.textContent).toContain("Theo Ashgrove");
    expect(team.textContent).toContain("Team lead");
    expect(screen.getByText(/signed the letter/).textContent).toContain(
      "the owner of Quillfen Freight",
    );
    expect(screen.getByRole("heading", { name: "Your first objective" })).toBeTruthy();
  });

  it("plays the case: a command ticks an objective, and the run is saved in this browser", async () => {
    const shelf: Shelf = new Map();
    const user = await startCase(storageOver(shelf));

    // The SIMULATED marker is in the header, whichever view is open.
    expect(screen.getAllByRole("button", { name: /simulated/i }).length).toBeGreaterThan(0);
    expect(tab("Objectives").getAttribute("aria-selected")).toBe("true");

    await run(user, "cat cases/practice/letter.txt");
    expect(within(output()).getByRole("region", { name: /Command: cat/ }).textContent).toContain(
      "letter of engagement",
    );

    await user.click(tab("Objectives"));
    expect(await screen.findByText(/the laptop and its logs are in scope/, {}, CHUNK)).toBeTruthy();
    expect(screen.getByText("Saved in this browser only.")).toBeTruthy();

    const saved = JSON.parse(shelf.get(CASES_STORAGE_KEY) ?? "{}");
    expect(saved.runs.practice.log).toEqual([{ line: "cat cases/practice/letter.txt" }]);
    expect(saved.runs.practice.completed).toEqual(["read-letter"]);
  });

  it("brings back the terminal history, ticks and notes after a reload", async () => {
    const shelf: Shelf = new Map();
    const user = await startCase(storageOver(shelf));
    await run(user, "cd cases/practice");
    await run(user, "grep Sealed handover.txt");
    await user.click(tab("Objectives"));
    await user.type(screen.getByRole("textbox", { name: "Your notes" }), "Seal matches.");

    // Close the tab, open it again.
    user.unmount();
    render(<CaseRunner caseDef={PRACTICE_CASE} storage={storageOver(shelf)} />);

    // Straight back into the workspace, no briefing.
    await screen.findByRole("tab", { name: "Terminal" }, CHUNK);
    expect(screen.queryByRole("button", { name: "Start case" })).toBeNull();
    await user.click(tab("Objectives"));
    expect((screen.getByRole("textbox", { name: "Your notes" }) as HTMLTextAreaElement).value).toBe(
      "Seal matches.",
    );
    expect(screen.getByText(/You found seal QF-0412/)).toBeTruthy();

    await user.click(tab("Terminal"));
    const history = output();
    expect(
      within(history).getByRole("region", { name: /Command: grep Sealed/ }).textContent,
    ).toContain("QF-0412");
    // The machine came back too: the prompt is still in the case folder.
    expect(prompt().getAttribute("aria-label")).toMatch(/cases\/practice/);
  });

  it("still plays start to finish when storage is blocked, and says calmly it won't be kept", async () => {
    const user = await startCase(createCaseStorage({ storage: blockedStorage }));
    expect(
      await screen.findByText(
        "This browser isn't letting us save, so this case won't be kept if you close the tab.",
      ),
    ).toBeTruthy();

    await run(user, "cat cases/practice/letter.txt");
    await run(user, "grep Sealed cases/practice/handover.txt");
    await user.click(tab("Objectives"));
    await user.click(await screen.findByRole("button", { name: "Write your report" }, CHUNK));
    await user.type(screen.getByRole("textbox", { name: "Your summary" }), "All in order.");
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("heading", { level: 1, name: /Case closed/ })).toBeTruthy();
    expect(screen.getByText("All in order.")).toBeTruthy();
  });

  it("forgets the save when the case is started again", async () => {
    const shelf: Shelf = new Map();
    const user = await startCase(storageOver(shelf));
    await run(user, "ls");
    expect(JSON.parse(shelf.get(CASES_STORAGE_KEY) ?? "{}").runs.practice).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Start the case again" }));
    const dialog = await screen.findByRole("dialog", { name: "Start this case again?" });
    await user.click(within(dialog).getByRole("button", { name: "Start the case again" }));
    expect(await screen.findByRole("button", { name: "Start case" })).toBeTruthy();
    expect(JSON.parse(shelf.get(CASES_STORAGE_KEY) ?? "{}").runs.practice).toBeUndefined();
  });

  it("shows Timeline and Board as empty states that say what will be there", async () => {
    const user = await startCase(storageOver(new Map()));
    await user.click(tab("Timeline"));
    expect(screen.getByRole("heading", { name: "Your timeline will be here" })).toBeTruthy();
    await user.click(tab("Board"));
    expect(screen.getByRole("heading", { name: "Your case board will be here" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Show your objectives" }));
    expect(tab("Objectives").getAttribute("aria-selected")).toBe("true");
  });

  it("opens the Evidence Browser in the Evidence tab, loaded on demand", async () => {
    const user = await startCase(storageOver(new Map()));
    await user.click(tab("Evidence"));
    const tree = await screen.findByRole("tree", { name: "Evidence" }, CHUNK);
    expect(within(tree).getByRole("treeitem", { name: /qf-lt-03/ })).toBeTruthy();
    expect(screen.getByText(/Logs from/)).toBeTruthy();
  });

  it("moves between tabs with the arrow keys", async () => {
    const user = await startCase(storageOver(new Map()));
    tab("Objectives").focus();
    await user.keyboard("{ArrowRight}");
    expect(tab("Terminal").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("Terminal"));
    await user.keyboard("{End}");
    expect(tab("Objectives").getAttribute("aria-selected")).toBe("true");
  });
});

describe("StoredDataControls (/privacy)", () => {
  it("exports the cases as a file, and imports a file back after checking it", async () => {
    const user = userEvent.setup();
    const shelf: Shelf = new Map();
    const storage = storageOver(shelf);
    storage.save("practice", {
      phase: "workspace",
      log: [{ line: "ls" }],
      pins: [],
      notes: "",
      reportDraft: {},
      completed: [],
      hintsShown: {},
      beatsPlayed: [],
      savedAt: 0,
    });
    const createObjectURL = vi.fn(() => "blob:cases");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<StoredDataControls storage={storage} />);
    await user.click(screen.getByRole("button", { name: "Export my cases" }));
    expect(click).toHaveBeenCalled();
    expect(await screen.findByText(/incident-room-cases\.json/)).toBeTruthy();
    const exported = storage.exportText();

    const other = storageOver(new Map());
    render(<StoredDataControls storage={other} />);
    const inputs = screen.getAllByLabelText("Import cases from a file");
    await user.upload(inputs.at(-1) as HTMLInputElement, new File([exported], "cases.json"));
    expect(await screen.findByText(/Imported 1 case/)).toBeTruthy();
    expect(other.load("practice")?.log).toEqual([{ line: "ls" }]);
  });

  it("refuses a file that doesn't validate, and says what to try", async () => {
    const user = userEvent.setup();
    const storage = storageOver(new Map());
    render(<StoredDataControls storage={storage} />);
    await user.upload(
      screen.getByLabelText("Import cases from a file"),
      new File([JSON.stringify({ v: 1, runs: { practice: { phase: "nope" } } })], "cases.json"),
    );
    expect(await screen.findByText(/Nothing was imported/)).toBeTruthy();
    expect(storage.read().runs).toEqual({});
  });

  it("clears everything after asking", async () => {
    const user = userEvent.setup();
    const shelf: Shelf = new Map([[CASES_STORAGE_KEY, JSON.stringify({ v: 1, runs: {} })]]);
    render(<StoredDataControls storage={storageOver(shelf)} />);
    await user.click(screen.getByRole("button", { name: "Clear everything" }));
    const dialog = await screen.findByRole("dialog", { name: "Clear everything?" });
    await user.click(within(dialog).getByRole("button", { name: "Clear everything" }));
    expect(await screen.findByText(/Everything is cleared/)).toBeTruthy();
    expect(shelf.has(CASES_STORAGE_KEY)).toBe(false);
  });
});
