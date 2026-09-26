import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  CaseRunner,
  loadCaseEvidence,
  PRACTICE_CASE,
  type CaseReportQuestion,
  type RunnableCase,
} from "@/features/cases";
import { nextCaseFor } from "@/features/cases/components/debrief/debrief-screen";
import {
  CASES_STORAGE_KEY,
  createCaseStorage,
  type CaseRunSave,
  type CaseStorage,
} from "@/lib/case-storage";
import { formatInstant } from "@/sim";
import type { EvidenceSet } from "@/sim/types";

/**
 * The Case Board, the report and the debrief as a player uses them
 * (docs/plan/10-case-board-report-custody.md), on the practice case and its real evidence: cards
 * with their notes, remove and undo, the cross-links, citing evidence on the report, "needs
 * evidence" until an answer cites what proves it, resubmitting, and the chain of custody on the
 * Objectives tab and the debrief. jsdom's matchMedia matches nothing, so the workspace shows one
 * view at a time.
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

const storageOver = (shelf: Shelf): CaseStorage =>
  createCaseStorage({ storage: () => memoryStorage(shelf) });

const CHUNK = { timeout: 15_000 };
const tab = (name: string) => screen.getByRole("tab", { name });
const saved = (shelf: Shelf, id = "practice") =>
  JSON.parse(shelf.get(CASES_STORAGE_KEY) ?? "{}").runs?.[id] as CaseRunSave | undefined;

let evidence: EvidenceSet;
let invoice: { ref: string; born: string; owner: string };
let logon: { ref: string };

beforeAll(async () => {
  evidence = await loadCaseEvidence("practice")!;
  const record = evidence.disks[0]?.records.find((item) =>
    item.path.endsWith("invoice-viewer.exe"),
  );
  const remote = evidence.logs.find((item) => item.fields.LogonType === "10");
  if (!record || !remote) throw new Error("the practice evidence has changed");
  invoice = {
    ref: `disk:qf-lt-03:mft/${record.record}`,
    born: formatInstant(record.times.b),
    owner: record.owner,
  };
  logon = { ref: `log:security/${remote.seq}` };
});

afterEach(() => {
  vi.restoreAllMocks();
});

function save(overrides: Partial<CaseRunSave>): CaseRunSave {
  return {
    phase: "workspace",
    log: [],
    pins: [],
    notes: "",
    reportDraft: {},
    completed: [],
    hintsShown: {},
    beatsPlayed: [],
    citations: {},
    pinNotes: {},
    marks: [],
    savedAt: 0,
    ...overrides,
  };
}

/** Opens a case with a save already in this browser, the way a returning player would. */
async function open(caseDef: RunnableCase, run: CaseRunSave) {
  const shelf: Shelf = new Map([
    [CASES_STORAGE_KEY, JSON.stringify({ v: 1, runs: { [caseDef.id]: run } })],
  ]);
  const user = userEvent.setup();
  render(<CaseRunner caseDef={caseDef} storage={storageOver(shelf)} />);
  return { user, shelf };
}

describe("the Case Board", () => {
  it("shows each pin as a card with its source, time, line, ref and note", async () => {
    const { user } = await open(
      PRACTICE_CASE,
      save({
        pins: [logon.ref, invoice.ref],
        pinNotes: { [invoice.ref]: "downloaded that night" },
      }),
    );
    await user.click(await screen.findByRole("tab", { name: "Board" }, CHUNK));

    const card = await screen.findByRole("article", { name: /invoice-viewer\.exe/ }, CHUNK);
    expect(within(card).getByText("Disk")).toBeTruthy();
    expect(within(card).getByText(invoice.born)).toBeTruthy();
    // The laptop's clock showed UK time, an hour on from UTC: both are on the card.
    expect(within(card).getByText(/\+01:00/)).toBeTruthy();
    expect(within(card).getByText(invoice.ref)).toBeTruthy();
    expect((within(card).getByLabelText("Your note") as HTMLTextAreaElement).value).toBe(
      "downloaded that night",
    );
    expect(within(card).getByText(/deleted/)).toBeTruthy();

    // Grouped by source: the drive first, then the log.
    const groups = screen.getAllByRole("heading", { level: 4 }).map((item) => item.textContent);
    expect(groups).toEqual(["Disk qf-lt-03", "security log"]);

    // Sorted by time instead: one list, oldest first (the logon came before the download).
    await user.click(screen.getByRole("radio", { name: "Sort by time" }));
    const list = screen.getByRole("list", { name: "Pins, oldest first" });
    const titles = within(list)
      .getAllByRole("article")
      .map((item) => item.getAttribute("aria-labelledby") && item.textContent);
    expect(titles[0]).toContain("security record");
    expect(titles[1]).toContain("invoice-viewer.exe");
  });

  it("edits a note, removes a pin, and puts it back with Undo", async () => {
    const { user, shelf } = await open(PRACTICE_CASE, save({ pins: [invoice.ref] }));
    await user.click(await screen.findByRole("tab", { name: "Board" }, CHUNK));
    const card = await screen.findByRole("article", { name: /invoice-viewer\.exe/ }, CHUNK);

    await user.type(within(card).getByLabelText("Your note"), "the download");
    expect(saved(shelf)?.pinNotes).toEqual({ [invoice.ref]: "the download" });

    await user.click(within(card).getByRole("button", { name: "Remove" }));
    expect(screen.queryByRole("article", { name: /invoice-viewer\.exe/ })).toBeNull();
    expect(screen.getByText(/off the board/)).toBeTruthy();
    expect(saved(shelf)?.pins).toEqual([]);
    // With nothing left, the empty state says how to pin, and Undo is still there.
    expect(screen.getByRole("heading", { name: "Pinned evidence shows up here" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    const back = await screen.findByRole("article", { name: /invoice-viewer\.exe/ });
    expect((within(back).getByLabelText("Your note") as HTMLTextAreaElement).value).toBe(
      "the download",
    );
    expect(saved(shelf)?.pins).toEqual([invoice.ref]);
    expect(saved(shelf)?.pinNotes).toEqual({ [invoice.ref]: "the download" });
  });

  it("draws each card as an evidence tag, and a card put back rises in", async () => {
    const { user } = await open(PRACTICE_CASE, save({ pins: [invoice.ref] }));
    await user.click(await screen.findByRole("tab", { name: "Board" }, CHUNK));
    const card = await screen.findByRole("article", { name: /invoice-viewer\.exe/ }, CHUNK);
    // The ref on an evidence-tag badge (monospace, amber outline), the source in words too.
    const tag = within(card).getByText(invoice.ref).parentElement;
    expect(tag?.className).toContain("font-mono");
    expect(tag?.className).toContain("border-accent");
    expect(within(card).getByText("Disk")).toBeTruthy();
    // It was on the board when the board opened, so it stays still.
    expect(card.className).not.toContain("animate-rise-in");

    await user.click(within(card).getByRole("button", { name: "Remove" }));
    const toast = screen
      .getAllByRole("status")
      .find((element) => element.textContent?.includes("Taken off the board")) as HTMLElement;
    // Focus moves on the next frame, once the toast is on screen.
    await waitFor(() =>
      expect(document.activeElement).toBe(within(toast).getByRole("button", { name: "Undo" })),
    );
    await user.click(within(toast).getByRole("button", { name: "Undo" }));
    const back = await screen.findByRole("article", { name: /invoice-viewer\.exe/ });
    expect(back.className).toContain("animate-rise-in");
  });

  it("links to the terminal and the Evidence Browser", async () => {
    const { user } = await open(PRACTICE_CASE, save({ pins: [invoice.ref, logon.ref] }));
    await user.click(await screen.findByRole("tab", { name: "Board" }, CHUNK));
    const card = await screen.findByRole("article", { name: /invoice-viewer\.exe/ }, CHUNK);
    const log = screen.getByRole("article", { name: /security record/ });
    // A log record has no tool to show it yet, and the Evidence Browser shows drives.
    expect(within(log).queryByRole("button", { name: "Show in terminal" })).toBeNull();
    expect(within(log).queryByRole("button", { name: "Show in Evidence Browser" })).toBeNull();
    // The Timeline pane is registered, so every card offers it.
    expect(within(card).getByRole("button", { name: "Show in timeline" })).toBeTruthy();
    expect(within(log).getByRole("button", { name: "Show in timeline" })).toBeTruthy();

    await user.click(within(card).getByRole("button", { name: "Show in terminal" }));
    const prompt = screen.getByRole("textbox", { name: /^Command, in/ }) as HTMLInputElement;
    expect(prompt.value).toBe(`inode /dev/evidence/qf-lt-03 ${invoice.ref.split("/").at(-1)}`);

    await user.click(tab("Board"));
    await user.click(within(card).getByRole("button", { name: "Show in Evidence Browser" }));
    expect(tab("Evidence").getAttribute("aria-selected")).toBe("true");
    // Nothing is open yet, and the browser never opens a drive by itself.
    expect(
      await screen.findByText(/open a drive from qf-lt-03 in the tree first/, {}, CHUNK),
    ).toBeTruthy();

    // With the drive open, the same link selects the record and shows its details.
    const drive = screen.getByRole("treeitem", { name: /qf-lt-03/ });
    drive.focus();
    await user.keyboard("{Enter}");
    await user.click(tab("Board"));
    await user.click(within(card).getByRole("button", { name: "Show in Evidence Browser" }));
    expect(await screen.findByText(/Showing .*invoice-viewer\.exe/)).toBeTruthy();
  });
});

const REPORTED: RunnableCase = {
  ...PRACTICE_CASE,
  report: {
    questions: [] as CaseReportQuestion[],
  },
};

function reportedCase(): RunnableCase {
  return {
    ...REPORTED,
    report: {
      questions: [
        {
          id: "which-drive",
          ask: "Which drive was the file on?",
          type: "choice",
          choices: ["qf-lt-03", "qf-lt-07"],
          answer: "qf-lt-03",
          acceptedRefs: [invoice.ref],
          explain: "The record's ref names the drive.",
        },
        {
          id: "when-downloaded",
          ask: "When did the file arrive?",
          type: "timestamp",
          answer: invoice.born,
          answerAt: Date.parse(invoice.born),
          toleranceSeconds: 60,
          acceptedRefs: [invoice.ref],
          explain: "The record's born time.",
        },
        {
          id: "which-account",
          ask: "Which account signed in from outside?",
          type: "account",
          answer: "yard",
          acceptedRefs: [logon.ref],
          explain: "The remote logon names the account.",
        },
      ],
    },
  };
}

describe("the report and the debrief", () => {
  it("says needs evidence until an answer cites what proves it, and takes it again as often as you like", async () => {
    const caseDef = reportedCase();
    const { user, shelf } = await open(
      caseDef,
      save({ phase: "report", pins: [invoice.ref, logon.ref] }),
    );
    await screen.findByRole("heading", { level: 1, name: /Your report for/ }, CHUNK);

    // Every question has a Supporting evidence picker listing the board, and nothing else.
    const pickers = screen.getAllByRole("group", { name: "Supporting evidence" });
    expect(pickers).toHaveLength(3);
    for (const picker of pickers) expect(within(picker).getAllByRole("checkbox")).toHaveLength(2);

    await user.click(screen.getByRole("radio", { name: "qf-lt-03" }));
    await user.click(within(pickers[0]!).getByRole("checkbox", { name: /invoice-viewer\.exe/ }));
    // A time from the board, rather than typed: the timeline pick.
    await user.click(screen.getByRole("button", { name: new RegExp(`^Use ${invoice.born}`) }));
    expect(
      (screen.getByRole("textbox", { name: /When did the file arrive/ }) as HTMLInputElement).value,
    ).toBe(invoice.born);
    await user.type(screen.getByRole("textbox", { name: /Which account/ }), "yard");
    // Cited, but the file doesn't show who signed in.
    await user.click(within(pickers[2]!).getByRole("checkbox", { name: /invoice-viewer\.exe/ }));

    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(
      await screen.findByRole("heading", { name: "Your report: 1 of 3 findings supported" }),
    ).toBeTruthy();
    const findings = screen.getByRole("heading", { name: /findings supported/ }).parentElement!;
    const [drive, when, account] = within(findings).getAllByRole("listitem");
    expect(within(drive!).getByText("Supported")).toBeTruthy();
    expect(drive!.textContent).toContain("The record's ref names the drive.");
    expect(within(when!).getByText("Needs evidence")).toBeTruthy();
    expect(when!.textContent).toContain(
      "That's right. Now show how you know: cite a pinned item that proves it.",
    );
    // The explanation waits until the finding is supported.
    expect(when!.textContent).not.toContain("The record's born time.");
    expect(within(account!).getByText("Needs evidence")).toBeTruthy();
    expect(account!.textContent).toContain("What you cited doesn't show this one.");
    expect(account!.textContent).not.toContain("The remote logon names the account.");

    // Back to the report: nothing is lost.
    await user.click(screen.getByRole("button", { name: "Change your report" }));
    await screen.findByRole("heading", { level: 1, name: /Your report for/ });
    expect((screen.getByRole("radio", { name: "qf-lt-03" }) as HTMLInputElement).checked).toBe(
      true,
    );
    const again = screen.getAllByRole("group", { name: "Supporting evidence" });
    await user.click(within(again[1]!).getByRole("checkbox", { name: /invoice-viewer\.exe/ }));
    await user.click(within(again[2]!).getByRole("checkbox", { name: /invoice-viewer\.exe/ }));
    await user.click(within(again[2]!).getByRole("checkbox", { name: /security record/ }));
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(
      await screen.findByRole("heading", { name: "Your report: 3 of 3 findings supported" }),
    ).toBeTruthy();
    expect(screen.getByText("The record's born time.")).toBeTruthy();

    // Both submissions are on the chain of custody, with how each one landed.
    const custody = screen.getByRole("heading", { name: "Your chain of custody" }).parentElement!;
    expect(custody.textContent).toContain("Submitted the report: 1 of 3 findings supported.");
    expect(custody.textContent).toContain("Submitted the report: 3 of 3 findings supported.");
    expect(saved(shelf)?.citations).toEqual({
      "which-drive": [invoice.ref],
      "when-downloaded": [invoice.ref],
      "which-account": [logon.ref],
    });
  });

  it("never says what the answer is when it's not yet", async () => {
    const caseDef = reportedCase();
    await open(
      caseDef,
      save({
        phase: "debrief",
        pins: [invoice.ref],
        reportDraft: { "which-drive": "qf-lt-07", "when-downloaded": "2026-01-01T00:00:00Z" },
        citations: { "which-drive": [invoice.ref], "when-downloaded": [invoice.ref] },
      }),
    );
    await screen.findByRole("heading", { name: "Your report: 0 of 3 findings supported" }, CHUNK);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Not this one yet.");
    expect(text).toContain("Not this time yet.");
    expect(text).toContain("Nothing written for this one yet.");
    for (const question of caseDef.report?.questions ?? []) {
      expect(text).not.toContain(question.explain);
    }
    expect(text).not.toContain(invoice.born);
  });

  it("downloads the chain of custody as plain text stamped SIMULATED", async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:custody");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { user } = await open(
      reportedCase(),
      save({
        phase: "debrief",
        log: [{ line: "hashsum /dev/evidence/qf-lt-03" }],
        pins: [invoice.ref],
        marks: [{ after: 2, kind: "pinned", ref: invoice.ref }],
      }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Download the custody record" }, CHUNK),
    );
    expect(click).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]?.[0];
    const text = await blob!.text();
    expect(text.startsWith("=")).toBe(true);
    expect(text).toContain("SIMULATED CHAIN OF CUSTODY RECORD");
    expect(text).toContain("SIMULATED. Not a real custody record.");
    expect(text).toContain("qf-lt-03, by");
    expect(text).toMatch(/1\. Hashed: Hashed \/dev\/evidence\/qf-lt-03 with SHA-256/);
    expect(text).toContain(`2. Pinned: Pinned ${invoice.ref} to the case board from a view.`);
  });

  it("counts what's filled in as the player goes, and cites pins as cards with checkbox semantics", async () => {
    const { user } = await open(
      reportedCase(),
      save({ phase: "report", pins: [invoice.ref, logon.ref] }),
    );
    await screen.findByRole("heading", { level: 1, name: /Your report for/ }, CHUNK);
    const progress = screen.getByRole("status");
    expect(progress.textContent).toBe("0 of 3 answered, 0 with evidence");
    // Submit sits in the sticky bar with the progress line.
    expect(
      progress.parentElement!.contains(screen.getByRole("button", { name: "Submit report" })),
    ).toBe(true);

    // The questions are a numbered list, and each pin is a card named by its source, ref and title.
    const [first] = screen.getAllByRole("group", { name: "Supporting evidence" });
    const card = within(first!).getByRole("checkbox", {
      name: new RegExp(`Disk.*${invoice.ref}.*invoice-viewer\\.exe`),
    });
    expect(within(first!).getByRole("checkbox", { name: /Log.*security record/ })).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: "qf-lt-03" }));
    expect(progress.textContent).toBe("1 of 3 answered, 0 with evidence");
    // Space on the focused card ticks it, like any checkbox.
    card.focus();
    await user.keyboard(" ");
    expect((card as HTMLInputElement).checked).toBe(true);
    expect(progress.textContent).toBe("1 of 3 answered, 1 with evidence");
    // A wrong answer counts the same: this line says what's filled in, never whether it's right.
    await user.type(screen.getByRole("textbox", { name: /Which account/ }), "nobody");
    expect(progress.textContent).toBe("2 of 3 answered, 1 with evidence");
  });

  it("leads the debrief with the stamp and the findings, then custody, then objectives, with one next step", async () => {
    const caseDef = reportedCase();
    const { user } = await open(
      caseDef,
      save({
        phase: "debrief",
        pins: [invoice.ref, logon.ref],
        reportDraft: {
          "which-drive": "qf-lt-03",
          "when-downloaded": invoice.born,
          "which-account": "yard",
        },
        citations: {
          "which-drive": [invoice.ref],
          "when-downloaded": [invoice.ref],
          "which-account": [logon.ref],
        },
      }),
    );
    const title = await screen.findByRole("heading", { level: 1, name: /^Case closed:/ }, CHUNK);
    const findings = screen.getByRole("heading", {
      name: "Your report: 3 of 3 findings supported",
    });
    const custody = screen.getByRole("heading", { name: "Your chain of custody" });
    const objectives = screen.getByRole("heading", { name: "Objectives" });
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText("Case closed", { selector: "span" })).toBeTruthy();
    expect(
      follows(title, findings) && follows(findings, custody) && follows(custody, objectives),
    ).toBe(true);

    // Each finding's status is a word, not only a colour, and resolves in turn.
    const chips = within(findings.parentElement!).getAllByText("Supported");
    expect(chips).toHaveLength(3);
    expect(chips.map((chip) => chip.closest(".animate-pop")?.getAttribute("style"))).toEqual([
      "animation-delay: calc(0ms * var(--motion-scale));",
      "animation-delay: calc(80ms * var(--motion-scale));",
      "animation-delay: calc(160ms * var(--motion-scale));",
    ]);
    expect(document.body.textContent).not.toMatch(/score|points|%/i);

    // One primary action. The practice case isn't in the chapter, so it's Back to your cases.
    const primary = document.querySelectorAll("article .bg-accent");
    expect([...primary].map((node) => node.textContent)).toEqual(["Back to your cases"]);
    expect(screen.getByRole("button", { name: "Back to the workspace" })).toBeTruthy();
    // Start the case again waits in the "⋯ Case" menu, behind its confirm dialog.
    expect(screen.queryByRole("button", { name: "Start the case again" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Case" }));
    await user.click(screen.getByRole("menuitem", { name: "Start the case again" }));
    expect(await screen.findByRole("dialog", { name: "Start this case again?" })).toBeTruthy();
  });

  it("makes Change your report the one primary action while a finding isn't supported", async () => {
    await open(
      reportedCase(),
      save({ phase: "debrief", pins: [invoice.ref], reportDraft: { "which-drive": "qf-lt-03" } }),
    );
    await screen.findByRole("heading", { name: "Your report: 0 of 3 findings supported" }, CHUNK);
    const primary = document.querySelectorAll("article .bg-accent");
    expect([...primary].map((node) => node.textContent)).toEqual(["Change your report"]);
  });
});

describe("the debrief's next case", () => {
  it("goes to the chapter's next released case, and back to the list after the last", () => {
    expect(nextCaseFor("case-01")).toEqual({
      href: "/cases/case-02",
      title: "The deleted invoice",
    });
    expect(nextCaseFor("case-02")).toEqual({
      href: "/cases/case-03",
      title: "Something is still running",
    });
    expect(nextCaseFor("case-03")).toBeNull();
    expect(nextCaseFor("practice")).toBeNull();
  });
});

describe("the Objectives tab's chain of custody", () => {
  it("is empty until something is done to the evidence, then lists it in order", async () => {
    const user = userEvent.setup();
    render(<CaseRunner caseDef={PRACTICE_CASE} storage={storageOver(new Map())} />);
    await user.click(screen.getByRole("button", { name: "Start case" }));
    await user.click(await screen.findByRole("tab", { name: "Chain of custody" }, CHUNK));
    expect(screen.getByText("Your chain of custody will be here")).toBeTruthy();

    await user.click(tab("Terminal"));
    await user.type(
      screen.getByRole("textbox", { name: /^Command, in/ }),
      "hashsum /dev/evidence/qf-lt-03{Enter}",
    );
    await user.click(tab("Objectives"));
    const custody = screen.getByRole("region", { name: "Chain of custody" });
    const entries = within(custody).getAllByRole("listitem");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.textContent).toContain("Hashed /dev/evidence/qf-lt-03 with SHA-256");
  });
});
