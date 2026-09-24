import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PRACTICE_CASE } from "@/features/cases";
import { EvidenceBrowser } from "@/features/evidence-browser";
import { attachEvidence, build, createInitialState, fixedClock, step } from "@/sim";
import type { EvidenceSet, SimState } from "@/sim/types";

/**
 * The Evidence Browser's Processes tab (docs/plan/08-memory-tools.md): every process a scan finds,
 * with whether the active list has it, sortable, pinnable, and in agreement with the terminal's
 * `mem ps` and `mem psscan`.
 */

const IMAGE = "qf-srv-01-mem";

/** A server with a service, a hidden process, and one that exited before the capture. */
function server(withDisk = false): EvidenceSet {
  const memory = build
    .memory("qf-srv-01", { capturedAt: "2026-04-12T08:40:00Z" })
    .process("services.exe", { pid: 628, ppid: 496, createdAt: "2026-04-09T05:58:21Z" })
    .process("svchost.exe", {
      pid: 4120,
      ppid: 2044,
      path: "C:\\Users\\dispatch\\AppData\\Roaming\\svchost.exe",
      createdAt: "2026-04-11T19:43:05Z",
      user: "QUILLFEN\\dispatch",
    })
    .process("cmd.exe", {
      pid: 3920,
      ppid: 4120,
      createdAt: "2026-04-11T19:44:00Z",
      exitedAt: "2026-04-11T19:44:01Z",
    })
    .process("taskhost-upd.exe", {
      pid: 4188,
      ppid: 4120,
      path: "C:\\ProgramData\\taskhost-upd.exe",
      createdAt: "2026-04-11T19:45:12Z",
      unlinked: true,
    });
  const set = build.evidence("processes-test", { host: "qf-srv-01" }).memory(memory);
  if (withDisk) set.disk(build.disk("qf-lt-09").file("C:\\a.txt", { content: "a" }));
  return set.zone("disk", "Europe/London").build();
}

const workstation = (evidence: EvidenceSet): SimState =>
  attachEvidence(createInitialState(PRACTICE_CASE.scenario, PRACTICE_CASE.seed), evidence);

function Harness({
  evidence = server(),
  onPin,
  showInTerminal,
}: {
  evidence?: EvidenceSet;
  onPin?: (ref: string) => void;
  showInTerminal?: (line: string) => void;
}) {
  const [pins, setPins] = useState<readonly string[]>([]);
  return (
    <EvidenceBrowser
      sim={workstation(evidence)}
      evidence={evidence}
      browse={() => undefined}
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

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const pidsInOrder = () =>
  bodyRows().map((row) => Number(within(row).getAllByRole("cell")[0]?.textContent));
const rowFor = (pid: number) =>
  bodyRows().find(
    (row) => within(row).getAllByRole("cell")[0]?.textContent === String(pid),
  ) as HTMLElement;

/** The pids on a terminal command's lines, from their refs. */
function terminalPids(argv: string[]): number[] {
  const result = step(workstation(server()), { type: "exec", argv }, fixedClock(0));
  return result.output.flatMap((line) => (line.ref ? [Number(line.ref.split("/").pop())] : []));
}

describe("the Processes tab", () => {
  it("lists every process psscan finds, in the same order, and says which ps leaves out", () => {
    render(<Harness />);
    expect(pidsInOrder()).toEqual(terminalPids(["mem", "psscan", IMAGE]));

    const listed = terminalPids(["mem", "ps", IMAGE]);
    expect(listed).not.toContain(4188);
    for (const pid of pidsInOrder()) {
      const cell = within(rowFor(pid)).getAllByRole("cell")[6];
      expect(cell?.textContent, String(pid)).toMatch(listed.includes(pid) ? /^Yes$/ : /^No/);
    }
    expect(within(rowFor(4188)).getByText("No: unlinked (hidden while running)")).toBeTruthy();
    expect(within(rowFor(3920)).getByText("No: exited before the capture")).toBeTruthy();
  });

  it("sorts by any column from its header, and turns round on a second press", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /^PID/ }));
    expect(pidsInOrder()).toEqual([628, 3920, 4120, 4188]);
    expect(screen.getByRole("columnheader", { name: /^PID/ }).getAttribute("aria-sort")).toBe(
      "ascending",
    );
    await user.click(screen.getByRole("button", { name: /^PID/ }));
    expect(pidsInOrder()).toEqual([4188, 4120, 3920, 628]);
    await user.click(screen.getByRole("button", { name: /In active list/ }));
    expect(pidsInOrder().slice(-2)).toEqual([4188, 3920]);
  });

  it("pins a process's ref to the case board and takes it off again, saying so", async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();
    render(<Harness onPin={onPin} />);
    await user.click(within(rowFor(4188)).getByRole("button", { name: /^Pin/ }));
    expect(onPin).toHaveBeenCalledWith(`mem:${IMAGE}:pid/4188`);
    expect(screen.getByText("Pinned taskhost-upd.exe (pid 4188) to the case board.")).toBeTruthy();
    await user.click(within(rowFor(4188)).getByRole("button", { name: /^Unpin/ }));
    expect(screen.getByText("Took taskhost-upd.exe (pid 4188) off the case board.")).toBeTruthy();
  });

  it("shows times in UTC, or on the computer's own clock", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(within(rowFor(4120)).getByText("2026-04-11T19:43:05Z")).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: /own clock \(Europe\/London\)/ }));
    expect(within(rowFor(4120)).getByText("2026-04-11 20:43:05 +01:00")).toBeTruthy();
  });

  it("puts the matching command at the terminal's prompt", async () => {
    const user = userEvent.setup();
    const showInTerminal = vi.fn();
    render(<Harness showInTerminal={showInTerminal} />);
    await user.click(screen.getByRole("button", { name: "Show in terminal" }));
    expect(showInTerminal).toHaveBeenCalledWith(`mem psscan ${IMAGE}`);
  });

  it("sits beside Files as a tab when a case has both a drive and a memory image", async () => {
    const user = userEvent.setup();
    render(<Harness evidence={server(true)} />);
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Files", "Processes"]);
    await user.click(screen.getByRole("tab", { name: "Processes" }));
    expect(pidsInOrder()).toHaveLength(4);
  });
});
