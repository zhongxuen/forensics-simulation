import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseRunner, loadCaseEvidence, PRACTICE_CASE, replayLog } from "@/features/cases";
import { EvidenceBrowser } from "@/features/evidence-browser";
import { createCaseStorage } from "@/lib/case-storage";
import { attachEvidence, browseImage, build, createInitialState, setBlocker } from "@/sim";
import type { BrowsedImage, EvidenceSet, SimEvent, SimState } from "@/sim/types";

/**
 * The Evidence Browser (docs/plan/05-workspace-ui.md §Evidence Browser), as a player uses it: the
 * tree from the keyboard, the table's sort, filters and time zones, the detail tabs, pins and
 * "Show in terminal", and every read going through the engine so the write-blocker applies.
 *
 * Most tests render the browser over a small drive built here, with a harness that holds the
 * engine state the way the workspace does. The last ones play the practice case end to end.
 */

const DEVICE = "/dev/evidence/qf-lt-09";
const NOW = Date.UTC(2026, 3, 12, 9, 30, 0);

/** A drive with a live document, a deleted invoice, a deleted folder and a large log. */
function drive(): EvidenceSet {
  return build
    .evidence("browser-test", { host: "qf-lt-09" })
    .disk(
      build
        .disk("qf-lt-09", { model: "Fenwold M2 solid-state drive", serial: "FW-0000-0909" })
        .file("C:\\Users\\dana\\Documents\\rota.txt", {
          record: 40,
          content: "Mon: early shift\nTue: pallet count\n",
          at: "2026-04-09T15:10:00Z",
        })
        .file("C:\\Users\\dana\\Documents\\inv-0413.pdf", {
          record: 41,
          content: "%PDF-1.4 invoice 0413",
          at: "2026-04-11T19:41:02Z",
          deleted: true,
        })
        .file("C:\\Users\\dana\\Old\\notes.txt", {
          record: 43,
          content: "left at six",
          at: "2026-04-01T08:00:00Z",
        })
        .file("C:\\Windows\\Temp\\big.log", {
          record: 50,
          content: "x".repeat(64 * 1024),
          at: "2026-04-10T10:00:00Z",
        })
        .deleted("C:\\Users\\dana\\Old"),
    )
    .zone("disk", "Europe/London")
    .handover("qf-lt-09", { hashes: true, receivedAt: "2026-04-12T08:00:00Z" })
    .build();
}

function workstation(evidence: EvidenceSet, blocker = true): SimState {
  const sim = attachEvidence(
    createInitialState(PRACTICE_CASE.scenario, PRACTICE_CASE.seed),
    evidence,
  );
  return blocker ? sim : setBlocker(sim, "qf-lt-09", false);
}

interface HarnessProps {
  evidence?: EvidenceSet;
  blocker?: boolean;
  onEvents?: (events: readonly SimEvent[], sim: SimState) => void;
  showInTerminal?: (line: string) => void;
  onPin?: (ref: string) => void;
}

/** Holds the engine state and the pins, the way the case workspace does. */
function Harness({
  evidence = drive(),
  blocker = true,
  onEvents,
  showInTerminal,
  onPin,
}: HarnessProps) {
  const [sim, setSim] = useState(() => workstation(evidence, blocker));
  const [pins, setPins] = useState<readonly string[]>([]);
  const browse = (path: string): BrowsedImage | undefined => {
    const opened = browseImage(sim, path, NOW);
    if (!opened.ok) return undefined;
    setSim(opened.value.state);
    onEvents?.(opened.value.events, opened.value.state);
    return opened.value;
  };
  return (
    <EvidenceBrowser
      sim={sim}
      evidence={evidence}
      browse={browse}
      pins={pins}
      onPin={(ref) => {
        onPin?.(ref);
        setPins([...pins, ref]);
      }}
      onUnpin={(ref) => setPins(pins.filter((pin) => pin !== ref))}
      showInTerminal={showInTerminal ?? (() => {})}
    />
  );
}

const tree = () => screen.getByRole("tree", { name: "Evidence" });
const item = (name: RegExp) => within(tree()).getByRole("treeitem", { name });
const table = () => screen.getByRole("table");
const row = (name: RegExp) =>
  within(table())
    .getAllByRole("row")
    .find((element) => name.test(element.textContent ?? "")) as HTMLElement;

type User = ReturnType<typeof userEvent.setup>;

/** Opens each folder in turn from the keyboard (Right on a closed node opens it), then selects the last. */
async function reveal(user: User, ...names: string[]) {
  for (const name of names) {
    const node = item(new RegExp(`^${name}( deleted)?$`));
    await user.click(node);
    if (node.getAttribute("aria-expanded") === "false") await user.keyboard("{ArrowRight}");
  }
}

async function openDrive(...folders: string[]) {
  const user = userEvent.setup();
  render(<Harness />);
  item(/qf-lt-09/).focus();
  await user.keyboard("{Enter}");
  await reveal(user, ...folders);
  return user;
}

describe("the tree", () => {
  it("follows the ARIA tree pattern, and opens a drive from the keyboard", async () => {
    const events: SimEvent[] = [];
    const user = userEvent.setup();
    render(<Harness onEvents={(made) => events.push(...made)} />);

    const drive = item(/qf-lt-09/);
    expect(drive.getAttribute("aria-level")).toBe("1");
    expect(drive.getAttribute("aria-expanded")).toBe("false");
    expect(drive.getAttribute("tabindex")).toBe("0");
    expect(drive.textContent).toMatch(/write-blocker on, not opened yet/);

    drive.focus();
    await user.keyboard("{Enter}");
    // The read went through the engine, through the write-blocker.
    expect(events).toEqual([
      { type: "evidence.readOriginal", device: DEVICE, blocker: true, tool: "evidence-browser" },
    ]);
    expect(item(/qf-lt-09/).getAttribute("aria-expanded")).toBe("true");
    // The partition that holds the files opens with it, down to the drive's root folder.
    const partition = item(/Windows \(partition 1\)/);
    expect(partition.getAttribute("aria-level")).toBe("2");
    expect(item(/^C:\\$/).getAttribute("aria-level")).toBe("3");

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(partition);
    expect(partition.getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{ArrowLeft}");
    expect(partition.getAttribute("aria-expanded")).toBe("false");
    await user.keyboard("{ArrowRight}");
    expect(partition.getAttribute("aria-expanded")).toBe("true");
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(item(/^C:\\$/));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(item(/qf-lt-09/));
  });

  it("strikes deleted folders through and says so in words", async () => {
    await openDrive("Users", "dana");
    const old = item(/^Old deleted$/);
    expect(old.querySelector(".line-through")?.textContent).toBe("Old");
  });
});

describe("the table", () => {
  it("lists the selected folder, and filters the whole drive to deleted records", async () => {
    const user = await openDrive("Users", "dana", "Documents");
    expect(row(/rota\.txt/)).toBeTruthy();
    expect(row(/inv-0413\.pdf/)).toBeTruthy();
    expect(row(/big\.log/)).toBeUndefined();

    await user.click(screen.getByRole("checkbox", { name: "Deleted only" }));
    const rows = within(table()).getAllByRole("row").slice(1);
    expect(rows.map((element) => element.querySelector("td")?.textContent)).toEqual([
      expect.stringMatching(/inv-0413\.pdf\s*deleted/),
      expect.stringMatching(/Old\s*deleted/),
    ]);
    // Deleted is said in words, as well as struck through.
    expect(row(/inv-0413/).querySelector(".line-through")?.textContent).toBe("inv-0413.pdf");
  });

  it("sorts by any column from its header, and says which way", async () => {
    const user = await openDrive("Users", "dana", "Documents");
    const header = (name: RegExp) =>
      screen
        .getAllByRole("columnheader")
        .find((th) => name.test(th.textContent ?? "")) as HTMLElement;
    expect(header(/^Name/).getAttribute("aria-sort")).toBe("ascending");
    await user.click(within(header(/^Size/)).getByRole("button"));
    expect(header(/^Size/).getAttribute("aria-sort")).toBe("ascending");
    const names = () =>
      within(table())
        .getAllByRole("row")
        .slice(1)
        .map((element) => (/(rota|inv-0413)/.exec(element.textContent ?? "") ?? [])[0]);
    expect(names()).toEqual(["inv-0413", "rota"]);
    await user.click(within(header(/^Size/)).getByRole("button"));
    expect(header(/^Size/).getAttribute("aria-sort")).toBe("descending");
    expect(names()).toEqual(["rota", "inv-0413"]);
  });

  it("filters to records with a time between two times", async () => {
    await openDrive();
    fireEvent.change(screen.getByLabelText("Between (UTC)"), {
      target: { value: "2026-04-11T00:00" },
    });
    const names = within(table())
      .getAllByRole("row")
      .slice(1)
      .map((element) => element.querySelector("td span.break-all")?.textContent);
    expect(names).toEqual(["inv-0413.pdf"]);
  });

  it("shows times in UTC, or in the drive's own zone, named", async () => {
    const user = await openDrive("Users", "dana", "Documents");
    expect(row(/rota/).textContent).toContain("2026-04-09T15:10:00Z");
    await user.click(screen.getByRole("radio", { name: /Local: Europe\/London/ }));
    expect(row(/rota/).textContent).toContain("2026-04-09 16:10:00 +01:00");
    expect(screen.getByLabelText("Between (Europe/London)")).toBeTruthy();
  });

  it("moves with the arrow keys, opens with Enter, and pins with p", async () => {
    const pinned: string[] = [];
    const user = userEvent.setup();
    render(<Harness onPin={(ref) => pinned.push(ref)} />);
    item(/qf-lt-09/).focus();
    await user.keyboard("{Enter}");
    await user.click(item(/^Users$/));

    // Users holds dana; Enter on it goes into the folder, in the table and the tree.
    row(/dana/).focus();
    await user.keyboard("{Enter}");
    expect(item(/^dana$/).getAttribute("aria-selected")).toBe("true");
    row(/Documents/).focus();
    await user.keyboard("{Enter}");
    row(/inv-0413/).focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(row(/rota/));
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(row(/inv-0413/));

    await user.keyboard("p");
    expect(pinned).toEqual(["disk:qf-lt-09:mft/41"]);
    expect(row(/inv-0413/).textContent).toContain("pinned");
    expect(
      within(row(/inv-0413/)).getByRole("button", { name: "Unpin inv-0413.pdf" }),
    ).toBeTruthy();

    // Enter on a file moves to its details.
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /inv-0413\.pdf/ }));
  });
});

describe("the details", () => {
  async function openRecord(name: RegExp, folders = ["Users", "dana", "Documents"]) {
    const user = await openDrive(...folders);
    await user.click(row(name));
    return user;
  }

  it("shows a file's text, and its record in the metadata", async () => {
    const user = await openRecord(/rota/);
    expect(screen.getByRole("tabpanel", { name: "Text" }).textContent).toContain(
      "Tue: pallet count",
    );
    await user.click(screen.getByRole("tab", { name: "Metadata" }));
    const metadata = screen.getByRole("tabpanel", { name: "Metadata" });
    expect(metadata.textContent).toContain("disk:qf-lt-09:mft/40");
    expect(metadata.textContent).toContain("C:\\Users\\dana\\Documents\\rota.txt");
  });

  it("says whether a deleted file's content is still on the drive", async () => {
    const user = await openRecord(/inv-0413/);
    await user.click(screen.getByRole("tab", { name: "Metadata" }));
    expect(screen.getByRole("tabpanel", { name: "Metadata" }).textContent).toContain(
      "Yes: nothing has been written over its clusters yet",
    );
  });

  it("virtualises the hex view: a 64 KB file draws a few dozen rows, not 4,096", async () => {
    const user = await openRecord(/big\.log/, ["Windows", "Temp"]);
    await user.click(screen.getByRole("tab", { name: "Hex" }));
    const hex = screen.getByRole("region", { name: "Hex view of big.log" });
    const rows = hex.querySelectorAll("[data-hex-row]");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(40);
    expect(rows[0]?.textContent).toBe(
      "00000000  78 78 78 78 78 78 78 78  78 78 78 78 78 78 78 78  xxxxxxxxxxxxxxxx",
    );
  });

  it("names the real tool this view copies", async () => {
    const user = await openRecord(/rota/);
    await user.click(screen.getByRole("tab", { name: "Real-world equivalent" }));
    expect(screen.getByRole("tabpanel", { name: "Real-world equivalent" }).textContent).toContain(
      "Autopsy",
    );
  });

  it("pins from the details, and puts the matching inode command at the prompt", async () => {
    const showInTerminal = vi.fn();
    const user = userEvent.setup();
    render(<Harness showInTerminal={showInTerminal} />);
    item(/qf-lt-09/).focus();
    await user.keyboard("{Enter}");
    await reveal(user, "Users", "dana", "Documents");
    await user.click(row(/inv-0413/));
    await user.click(screen.getByRole("button", { name: "Pin to the case board" }));
    expect(screen.getByRole("button", { name: "Unpin from the case board" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Show in terminal" }));
    expect(showInTerminal).toHaveBeenCalledWith(`inode ${DEVICE} 41`);
  });
});

describe("the write-blocker", () => {
  it("warns before and after opening an original with its blocker off, and the drive changes", async () => {
    const events: SimEvent[] = [];
    const states: SimState[] = [];
    const user = userEvent.setup();
    render(
      <Harness
        blocker={false}
        onEvents={(made, sim) => {
          events.push(...made);
          states.push(sim);
        }}
      />,
    );
    expect(screen.getByText("The write-blocker is off")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open qf-lt-09" }));
    expect(events).toEqual([
      expect.objectContaining({ type: "evidence.readOriginal", blocker: false }),
    ]);
    expect(states[0]?.evidence?.attached["qf-lt-09"]?.changedAt).toBe(NOW);
    expect(screen.getByText("The original has changed")).toBeTruthy();

    // The new access times are what the browser shows: it draws the engine's view.
    await reveal(user, "Users", "dana", "Documents");
    expect(row(/rota/).textContent).toContain("2026-04-12T09:30:00Z");
  });
});

// ---------------------------------------------------------------------------------------------
// The practice case, end to end

const CHUNK = { timeout: 15_000 };

function memoryStorage(items: Map<string, string>): Storage {
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

describe("in the practice case", () => {
  it("reads through the workstation's engine, pins from the keyboard, and keeps it all on reload", async () => {
    const shelf = new Map<string, string>();
    const storage = createCaseStorage({ storage: () => memoryStorage(shelf) });
    const user = userEvent.setup();
    const { unmount } = render(<CaseRunner caseDef={PRACTICE_CASE} storage={storage} />);
    await user.click(screen.getByRole("button", { name: "Start case" }));
    await user.click(await screen.findByRole("tab", { name: "Evidence" }, CHUNK));

    const drive = await screen.findByRole("treeitem", { name: /qf-lt-03/ }, CHUNK);
    drive.focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("checkbox", { name: "Deleted only" }));
    row(/invoice-viewer\.exe/).focus();
    await user.keyboard("p");
    expect(row(/invoice-viewer\.exe/).textContent).toContain("pinned");

    // Show in terminal: the command waits at the prompt, unrun, with the terminal in view.
    await user.click(row(/invoice-viewer\.exe/));
    await user.click(screen.getByRole("button", { name: "Show in terminal" }));
    const prompt = screen.getByRole("textbox", { name: /^Command, in/ }) as HTMLInputElement;
    expect(prompt.value).toMatch(/^inode \/dev\/evidence\/qf-lt-03 \d+$/);
    expect(document.activeElement).toBe(prompt);

    const saved = JSON.parse(shelf.get("incident-room:cases:v1") ?? "{}");
    expect(saved.runs.practice.log).toEqual([{ browse: "/dev/evidence/qf-lt-03" }]);
    expect(saved.runs.practice.pins).toEqual([expect.stringMatching(/^disk:qf-lt-03:mft\/\d+$/)]);

    // Reload: the pin is still on the board, and the drive shows it once it's opened again.
    unmount();
    render(<CaseRunner caseDef={PRACTICE_CASE} storage={storage} />);
    await user.click(await screen.findByRole("tab", { name: "Board" }, CHUNK));
    expect(await screen.findByRole("heading", { name: /invoice-viewer\.exe/ }, CHUNK)).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "Evidence" }));
    const again = await screen.findByRole("treeitem", { name: /qf-lt-03/ }, CHUNK);
    again.focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("checkbox", { name: "Deleted only" }));
    expect(row(/invoice-viewer\.exe/).textContent).toContain("pinned");
  });

  it("replays an open with the write-blocker off, so the changed drive comes back", async () => {
    const evidence = await loadCaseEvidence("practice");
    const session = replayLog(
      PRACTICE_CASE,
      [{ line: "blocker off /dev/evidence/qf-lt-03" }, { browse: "/dev/evidence/qf-lt-03" }],
      undefined,
      evidence,
    );
    expect(session.sim.evidence?.attached["qf-lt-03"]?.changedAt).toBeDefined();
    expect(session.lastEvents).toEqual([
      expect.objectContaining({ type: "evidence.readOriginal", blocker: false }),
    ]);
  });
});

/**
 * Pretends every element is `px` wide: jsdom has no layout, so a component that sizes itself to
 * its pane measures nothing (and lays itself out wide) unless told otherwise.
 */
function paneWidth(px: number) {
  return vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    width: px,
    height: 0,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: px,
    bottom: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe("the layout, by the pane's width", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lays the tree, the table and the details side by side from 900 px", async () => {
    paneWidth(1100);
    const { container } = render(<Harness />);
    expect(container.querySelector("[data-layout]")?.getAttribute("data-layout")).toBe("columns");
  });

  it("offers the one drive to open while nothing is open, and keeps the filters until then", async () => {
    paneWidth(600);
    const user = userEvent.setup();
    render(<Harness />);
    expect(
      screen.getByRole("heading", { name: "A drive's files will be listed here" }),
    ).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Deleted only" })).toBeNull();
    // One Open button: the drive's own details don't repeat it.
    expect(screen.getAllByRole("button", { name: "Open qf-lt-09" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Open qf-lt-09" }));
    expect(item(/Windows \(partition 1\)/)).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "A drive's files will be listed here" }),
    ).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Deleted only" })).toBeTruthy();
  });

  it("never offers to open an original whose write-blocker is off", () => {
    paneWidth(600);
    render(<Harness blocker={false} />);
    expect(
      screen.queryByRole("heading", { name: "A drive's files will be listed here" }),
    ).toBeNull();
    expect(screen.getByText(/The write-blocker is off/)).toBeTruthy();
  });

  it("drills in below 900 px: drives, a folder's records, one record, with a breadcrumb and Back", async () => {
    paneWidth(600);
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    expect(container.querySelector("[data-layout]")?.getAttribute("data-layout")).toBe("drill-in");
    item(/qf-lt-09/).focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("table")).toBeNull();

    // A click on a folder's name goes in to its records; the tree steps aside.
    await user.click(item(/^Users$/));
    expect(screen.queryByRole("tree")).toBeNull();
    const where = () => screen.getByRole("navigation", { name: "Where you are in the drive" });
    expect(within(where()).getByText("Users").getAttribute("aria-current")).toBe("location");
    expect(document.activeElement?.textContent).toBe("Records");

    // A click on a folder's row goes into it; on a file's row, to its details.
    await user.click(row(/dana/));
    await user.click(row(/Documents/));
    expect(within(where()).getByText("Documents")).toBeTruthy();
    await user.click(row(/rota\.txt/));
    expect(screen.queryByRole("table")).toBeNull();
    expect(document.activeElement?.textContent).toContain("rota.txt");
    expect(within(where()).getByText("rota.txt").getAttribute("aria-current")).toBe("location");

    await user.click(screen.getByRole("button", { name: /Back to the records/ }));
    expect(row(/rota\.txt/)).toBeTruthy();
    // The keys are the same drilled in: Enter on a file's row goes to its details.
    row(/rota\.txt/).focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement?.textContent).toContain("rota.txt");

    await user.click(within(where()).getByRole("button", { name: "Drives and folders" }));
    expect(tree()).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Where you are in the drive" })).toBeNull();
  });

  it("shows what a filter finds, drilled in, and folds the time window away until asked", async () => {
    paneWidth(600);
    const user = userEvent.setup();
    render(<Harness />);
    item(/qf-lt-09/).focus();
    await user.keyboard("{Enter}");

    const toggle = screen.getByRole("button", { name: /Time window/ });
    const between = screen.getByLabelText("Between (UTC)");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(between.closest("fieldset")?.hidden).toBe(true);
    await user.click(toggle);
    expect(between.closest("fieldset")?.hidden).toBe(false);

    await user.click(screen.getByRole("checkbox", { name: "Deleted only" }));
    expect(row(/inv-0413\.pdf/)).toBeTruthy();
    expect(within(screen.getByRole("navigation")).getByText("Filtered records")).toBeTruthy();
  });
});
