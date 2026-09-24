import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CaseRunner, loadCaseEvidence, PRACTICE_CASE } from "@/features/cases";
import { onTrack, sourcesIn, TimelineView } from "@/features/timeline";
import { CASES_STORAGE_KEY, createCaseStorage, type CaseStorage } from "@/lib/case-storage";
import { buildTimeline } from "@/sim";
import type { EvidenceSet, TimelineEntry } from "@/sim/types";

/**
 * The Timeline view (docs/plan/09-timeline.md §The view), on the practice case's real evidence:
 * the keyboard map on the tracks, the table sharing the tracks' selection, and the pane in the
 * workspace, where pinning a moment puts it on the board. jsdom draws no canvas, so what the
 * tracks show is read from what they announce and from the chosen moment's details.
 */

const CHUNK = { timeout: 15_000 };

let evidence: EvidenceSet;
let entries: TimelineEntry[];

beforeAll(async () => {
  evidence = (await loadCaseEvidence("practice"))!;
  entries = buildTimeline(evidence);
});

function renderView(overrides: { pins?: string[] } = {}) {
  const onPin = vi.fn();
  const onUnpin = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <TimelineView
      set={evidence}
      entries={entries}
      pins={overrides.pins ?? []}
      onPin={onPin}
      onUnpin={onUnpin}
    />,
  );
  return { user, onPin, onUnpin, ...view };
}

/** What the tracks last said: the polite live region. */
const said = (container: HTMLElement) =>
  container.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? "";

const details = () => screen.getByRole("region", { name: "The chosen moment" });

describe("the tracks from the keyboard", () => {
  it("steps along a track, jumps ten, changes track, zooms, chooses, pins and switches clocks", async () => {
    const { user, onPin, container } = renderView();
    const tracks = sourcesIn(entries);
    const [first, second] = tracks;
    if (!first || !second) throw new Error("the practice evidence needs two sources");
    const firstTrack = onTrack(entries, first);

    screen.getByRole("application", { name: "Timeline tracks" }).focus();

    // With nothing chosen yet, → starts at the very first moment.
    await user.keyboard("{ArrowRight}");
    expect(said(container)).toContain(firstTrack[0]!.summary);
    expect(said(container)).toContain(`1 of ${firstTrack.length} on this track`);

    await user.keyboard("{ArrowRight}");
    expect(said(container)).toContain(`2 of ${firstTrack.length} on this track`);
    await user.keyboard("{ArrowLeft}");
    expect(said(container)).toContain(`1 of ${firstTrack.length} on this track`);

    // Shift jumps ten, stopping at the end of the track; End and Home go to the ends.
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    const jumped = Math.min(11, firstTrack.length);
    expect(said(container)).toContain(`${jumped} of ${firstTrack.length} on this track`);
    await user.keyboard("{End}");
    expect(said(container)).toContain(`${firstTrack.length} of ${firstTrack.length}`);
    await user.keyboard("{Home}");
    expect(said(container)).toContain(`1 of ${firstTrack.length}`);

    // ↓ moves to the nearest moment on the next track down.
    await user.keyboard("{ArrowDown}");
    const secondTrack = onTrack(entries, second);
    expect(said(container)).toMatch(new RegExp(`of ${secondTrack.length} on this track`));

    // + zooms in a level at a time, − back out.
    await user.keyboard("+");
    expect(screen.getByText("Hours")).toBeTruthy();
    await user.keyboard("+");
    expect(screen.getByText("Minutes")).toBeTruthy();
    await user.keyboard("-");
    expect(screen.getByText("Hours")).toBeTruthy();

    // Enter chooses the moment: its details show, with its ref.
    await user.keyboard("{Enter}");
    expect(said(container)).toMatch(/^Chose /);
    const chosen = within(details());
    const ref = secondTrack.find((entry) => chosen.queryByText(entry.ref))?.ref;
    expect(ref).toBeDefined();

    // P pins it; Z switches to each source's own clock and back.
    await user.keyboard("p");
    expect(onPin).toHaveBeenCalledWith(ref);
    expect(said(container)).toMatch(/^Pinned the .* to the case board\.$/);
    const own = screen.getByRole("button", { name: "Own clocks" });
    expect(own.getAttribute("aria-pressed")).toBe("false");
    await user.keyboard("z");
    expect(own.getAttribute("aria-pressed")).toBe("true");
    await user.keyboard("z");
    expect(own.getAttribute("aria-pressed")).toBe("false");

    // Escape lets go of the chosen moment.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "The chosen moment" })).toBeNull();
  });

  it("unpins a moment that's already on the board", async () => {
    const pinned = entries[0]!;
    const { user, onUnpin } = renderView({ pins: [pinned.ref] });
    screen.getByRole("application", { name: "Timeline tracks" }).focus();
    await user.keyboard("{ArrowRight}p");
    expect(onUnpin).toHaveBeenCalledWith(pinned.ref);
  });

  it("shows the zone banner, because the drive kept UK time and the logs UTC", () => {
    renderView();
    const banner = screen.getByRole("note");
    expect(banner.textContent).toContain("Time zones");
    expect(banner.textContent).toContain("Europe/London");
    expect(banner.textContent).toMatch(/times are shown in UTC/);
  });
});

describe("one selection, two views", () => {
  it("keeps the chosen moment when switching to the table, and back", async () => {
    const { user } = renderView();
    screen.getByRole("application", { name: "Timeline tracks" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{Enter}");
    const chosenRef = within(details()).getByText(/^(disk|log|mem):/).textContent;

    await user.click(screen.getByRole("button", { name: "Table" }));
    const table = screen.getByRole("table");
    const current = within(table)
      .getAllByRole("row")
      .find((row) => row.getAttribute("aria-current") === "true");
    expect(current).toBeDefined();
    expect(current!.textContent).toContain("chosen");
    // The cursor is on the chosen row, so it's the row the table's one tab stop lands on.
    expect(current!.getAttribute("tabindex")).toBe("0");
    expect(within(details()).getByText(chosenRef!)).toBeTruthy();

    // Down and Enter in the table choose the next moment...
    current!.focus();
    await user.keyboard("{ArrowDown}{Enter}");
    // Three steps along the first track chose its third moment; Down is the next in time.
    const third = onTrack(entries, entries[0]!.source)[2]!;
    const next = entries[entries.indexOf(third) + 1]!;
    expect(within(details()).getByText(next.ref)).toBeTruthy();
    const rows = within(table).getAllByRole("row");
    expect(rows.filter((row) => row.getAttribute("aria-current") === "true")).toHaveLength(1);

    // ...and the tracks have it too.
    await user.click(screen.getByRole("button", { name: "Tracks" }));
    expect(within(details()).getByText(next.ref)).toBeTruthy();
  });

  it("filters both views the same way", async () => {
    const { user } = renderView();
    const [first] = sourcesIn(entries);
    await user.click(screen.getByRole("button", { name: "Table" }));
    const before = within(screen.getByRole("table")).getAllByRole("row").length;
    await user.click(screen.getByRole("checkbox", { name: new RegExp(`^${label(first!)}`) }));
    const after = within(screen.getByRole("table")).getAllByRole("row").length;
    expect(before - after).toBe(onTrack(entries, first!).length);
  });

  it("lights up the moments near the chosen one in the table, in words", async () => {
    const { user } = renderView();
    await user.click(screen.getByRole("button", { name: "Table" }));
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    await user.selectOptions(screen.getByLabelText("Light up moments within"), "1800000");
    await user.click(rows[1]!);
    expect(rows[1]!.textContent).toContain("chosen");
    expect(rows.some((row) => row.textContent?.includes("nearby"))).toBe(true);
  });
});

const LABELS: Record<string, string> = { disk: "Drive", security: "Security log" };
const label = (source: string) => LABELS[source] ?? source;

describe("the Timeline pane in the workspace", () => {
  function storage(): CaseStorage {
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
  }

  it("adds the drive's times through the write-blocker, pins from the table, and the board has it", async () => {
    const user = userEvent.setup();
    render(<CaseRunner caseDef={PRACTICE_CASE} storage={storage()} />);
    await user.click(await screen.findByRole("button", { name: "Start case" }));
    await user.click(await screen.findByRole("tab", { name: "Timeline" }, CHUNK));

    // Before the drive is read, only the logs are there, and the card says how it will be read.
    const add = await screen.findByRole("button", { name: "Add qf-lt-03's file times" }, CHUNK);
    expect(screen.getByText(/through its write-blocker, which is on/)).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /^Drive/ })).toBeNull();
    await user.click(add);
    expect(screen.getByRole("checkbox", { name: /^Drive/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add qf-lt-03's file times" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Table" }));
    const row = within(screen.getByRole("table"))
      .getAllByRole("row")
      .find((item) => item.textContent?.includes("invoice-viewer.exe"));
    expect(row).toBeDefined();
    await user.click(row!);
    row!.focus();
    await user.keyboard("p");
    expect(row!.textContent).toContain("pinned");

    await user.click(screen.getByRole("tab", { name: "Board" }));
    const card = await screen.findByRole("article", { name: /invoice-viewer\.exe/ }, CHUNK);

    // And back: the board's "Show in timeline" chooses that moment.
    await user.click(within(card).getByRole("button", { name: "Show in timeline" }));
    expect(screen.getByRole("tab", { name: "Timeline" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(within(details()).getByText(/invoice-viewer\.exe/)).toBeTruthy();
    expect(localStorage.getItem(CASES_STORAGE_KEY)).toBeNull();
  });
});
