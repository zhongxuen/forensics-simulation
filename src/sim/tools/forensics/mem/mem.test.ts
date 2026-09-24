import { describe, expect, it } from "vitest";
import { renderManPage, REAL_WORLD_HEADING } from "../../help";
import {
  bareState,
  caseState,
  errorCodes,
  eventTypes,
  refs,
  runAll,
  runCase,
  text,
} from "../__fixtures__/evidence";
import { mem } from ".";
import { BEACON, MEM_IMAGE, memoryState, PIDS, REGIONS } from "./__fixtures__/memory";

const pidRef = (pid: number) => `mem:${MEM_IMAGE}:pid/${pid}`;
const vadRef = (base: number) => `mem:${MEM_IMAGE}:vad/${base}`;

/** The pids on the process rows of a result, in order. */
const pidsShown = (result: ReturnType<typeof runCase>): number[] =>
  refs(result).map((ref) => Number(ref.split("/").pop()));

describe("mem", () => {
  it("lists the case's memory images and the subcommands when run on its own", () => {
    const result = runCase(memoryState(), "mem");
    expect(result.exitCode).toBe(0);
    expect(text(result)).toMatch(/qf-srv-01-mem +qf-srv-01 +2026-04-12T08:40:00Z/);
    for (const sub of [
      "info",
      "ps",
      "psscan",
      "pstree",
      "netscan",
      "cmdline",
      "malfind",
      "strings",
    ]) {
      expect(text(result)).toMatch(new RegExp(`^  ${sub} `, "m"));
    }
    expect(result.events).toEqual([expect.objectContaining({ type: "command.run" })]);
  });

  it("says so when the case has no memory images", () => {
    expect(text(runCase(caseState(), "mem"))).toContain("this case has no memory images");
  });

  it("finds an image by its id or by the host it came from, in any case", () => {
    for (const name of [MEM_IMAGE, "qf-srv-01", "QF-SRV-01-MEM"]) {
      expect(runCase(memoryState(), "mem", "info", name).exitCode, name).toBe(0);
    }
  });

  describe("info", () => {
    it("names the host and the capture time in UTC and on the host's own clock", () => {
      const result = runCase(memoryState(), "mem", "info", MEM_IMAGE);
      const out = text(result);
      expect(out).toContain("mem info (simulated) · qf-srv-01-mem · qf-srv-01");
      expect(out).toContain("2026-04-12T08:40:00Z");
      expect(out).toContain("2026-04-12 09:40:00 +01:00 on the host's clock (Europe/London)");
      expect(out).toContain("12 found by a scan, 10 in the active list");
      expect(result.events[0]).toEqual({
        type: "memory.inspected",
        image: MEM_IMAGE,
        view: "info",
      });
    });
  });

  describe("ps and psscan", () => {
    it("leaves the unlinked process out of ps, and psscan finds it", () => {
      const listed = runCase(memoryState(), "mem", "ps", MEM_IMAGE);
      expect(pidsShown(listed)).not.toContain(PIDS.hidden);
      expect(text(listed)).not.toContain("taskhost-upd.exe");

      const scanned = runCase(memoryState(), "mem", "psscan", MEM_IMAGE);
      expect(pidsShown(scanned)).toContain(PIDS.hidden);
      expect(text(scanned)).toMatch(/4188 +4120 +taskhost-upd\.exe .* unlinked$/m);
    });

    it("leaves an exited process out of ps, and psscan marks it with its exit time", () => {
      expect(pidsShown(runCase(memoryState(), "mem", "ps", MEM_IMAGE))).not.toContain(PIDS.cmd);
      const scanned = text(runCase(memoryState(), "mem", "psscan", MEM_IMAGE));
      expect(scanned).toMatch(/3920 +4120 +cmd\.exe .*2026-04-11T19:44:01Z +exited$/m);
      expect(scanned).toContain("12 processes, 1 unlinked, 1 exited");
    });

    it("puts a process ref on every row, and on no other line", () => {
      const result = runCase(memoryState(), "mem", "ps", MEM_IMAGE);
      expect(refs(result)).toHaveLength(10);
      expect(refs(result)[0]).toBe(pidRef(PIDS.system));
      const rows = result.output.filter((line) => /^ {2}\d/.test(line.text));
      expect(rows.every((line) => line.ref !== undefined)).toBe(true);
    });

    it("emits memory.listed for the list and memory.scanned for the scan", () => {
      expect(runCase(memoryState(), "mem", "ps", MEM_IMAGE).events[0]).toEqual({
        type: "memory.listed",
        image: MEM_IMAGE,
        view: "ps",
        processes: 10,
      });
      expect(runCase(memoryState(), "mem", "psscan", MEM_IMAGE).events[0]).toEqual({
        type: "memory.scanned",
        image: MEM_IMAGE,
        view: "psscan",
        found: 12,
        unlinked: 1,
      });
    });

    it("shows times on the host's own clock with --zone local", () => {
      const result = runCase(memoryState(), "mem", "ps", MEM_IMAGE, "--zone", "local");
      expect(text(result)).toContain("times in Europe/London");
      expect(text(result)).toContain("2026-04-11 20:43:05 +01:00");
    });
  });

  describe("pstree", () => {
    it("puts each process under its parent, so the svchost.exe under explorer.exe shows", () => {
      const out = text(runCase(memoryState(), "mem", "pstree", MEM_IMAGE));
      expect(out).toMatch(/^ {2}explorer\.exe +2044 +1988/m);
      expect(out).toMatch(/^ {4}svchost\.exe +4120 +2044/m);
      expect(out).toMatch(/^ {10}svchost\.exe +812 +628/m);
      expect(out).not.toContain("taskhost-upd.exe");
    });

    it("prints a process whose parent loops back to it rather than losing it", () => {
      const state = memoryState();
      const evidence = state.evidence;
      if (!evidence) throw new Error("fixture has no evidence");
      const image = evidence.set.memory[0];
      if (!image) throw new Error("fixture has no memory image");
      const looped = {
        ...image,
        processes: [
          { ...(image.processes[0] as (typeof image.processes)[number]), pid: 8, ppid: 12 },
          {
            ...(image.processes[0] as (typeof image.processes)[number]),
            pid: 12,
            ppid: 8,
            name: "b.exe",
          },
        ],
      };
      const next = {
        ...state,
        evidence: { ...evidence, set: { ...evidence.set, memory: [looped] } },
      };
      expect(refs(runCase(next, "mem", "pstree", MEM_IMAGE))).toHaveLength(2);
    });
  });

  describe("netscan", () => {
    it("shows the beacon: the same address four times, one minute apart, owned by pid 4120", () => {
      const result = runCase(memoryState(), "mem", "netscan", MEM_IMAGE);
      const beacon = text(result)
        .split("\n")
        .filter((line) => line.includes(BEACON));
      expect(beacon).toHaveLength(4);
      expect(beacon.map((line) => /T08:(\d\d):58Z/.exec(line)?.[1])).toEqual([
        "36",
        "37",
        "38",
        "39",
      ]);
      for (const line of beacon) expect(line).toMatch(/4120 +svchost\.exe/);
    });

    it("carries each connection's index as its ref, whatever order they print in", () => {
      const result = runCase(memoryState(), "mem", "netscan", MEM_IMAGE);
      expect(refs(result)).toEqual(
        [0, 1, 2, 3, 4, 5].map((index) => `mem:${MEM_IMAGE}:conn/${index}`),
      );
    });

    it("narrows to one process with --pid", () => {
      const result = runCase(memoryState(), "mem", "netscan", MEM_IMAGE, "--pid", "2312");
      expect(refs(result)).toEqual([`mem:${MEM_IMAGE}:conn/1`]);
      expect(result.events[0]).toMatchObject({ view: "netscan", found: 1, pid: 2312 });
      const none = runCase(
        memoryState(),
        "mem",
        "netscan",
        MEM_IMAGE,
        "--pid",
        String(PIDS.hidden),
      );
      expect(text(none)).toContain("(no connections for pid 4188)");
    });
  });

  describe("cmdline", () => {
    it("shows where the svchost.exe really lives, and what the hidden process was told", () => {
      const out = text(runCase(memoryState(), "mem", "cmdline", MEM_IMAGE));
      expect(out).toContain("C:\\Users\\dispatch\\AppData\\Roaming\\svchost.exe -k netsvcs");
      expect(out).toMatch(/taskhost-upd\.exe --quiet --stage 2 +\[unlinked\]/);
      expect(out).toContain("(not in memory: the process had exited before the capture)");
    });

    it("finds a hidden process by pid", () => {
      const result = runCase(memoryState(), "mem", "cmdline", MEM_IMAGE, "--pid", "4188");
      expect(refs(result)).toEqual([pidRef(PIDS.hidden)]);
      expect(result.events[0]).toEqual({
        type: "memory.inspected",
        image: MEM_IMAGE,
        view: "cmdline",
        pid: PIDS.hidden,
      });
    });
  });

  describe("malfind", () => {
    it("shows both writable, executable, file-less regions, and neither of the others", () => {
      const result = runCase(memoryState(), "mem", "malfind", MEM_IMAGE);
      const regionRefs = [...new Set(refs(result))];
      expect(regionRefs).toEqual([vadRef(REGIONS.jit), vadRef(REGIONS.injected)]);
      expect(text(result)).not.toContain("0x7ff61000");
      expect(text(result)).not.toContain("0x7ff72000");
      expect(result.events[0]).toMatchObject({ type: "memory.scanned", view: "malfind", found: 2 });
    });

    it("previews 64 bytes as four rows of hex and text, the injected one starting MZ", () => {
      const out = text(runCase(memoryState(), "mem", "malfind", MEM_IMAGE, "--pid", "4120"));
      const rows = out.split("\n").filter((line) => /^ {4}0x/.test(line));
      expect(rows).toHaveLength(4);
      expect(rows[0]).toMatch(/^ {4}0x00520000 {2}4d 5a 90 00 .* {2}MZ\.{14}$/);
      expect(out).toContain("relay cdn-sync.e");
    });

    it("carries the region's ref on its header, its protection and each preview row", () => {
      const result = runCase(memoryState(), "mem", "malfind", MEM_IMAGE, "--pid", "2312");
      expect(refs(result)).toEqual(Array.from({ length: 6 }, () => vadRef(REGIONS.jit)));
    });

    it("says so when a process has none", () => {
      const result = runCase(memoryState(), "mem", "malfind", MEM_IMAGE, "--pid", "812");
      expect(text(result)).toContain("(none in pid 812)");
      expect(refs(result)).toEqual([]);
    });

    it("has a man page that says how to tell the two kinds apart", () => {
      const page = renderManPage("mem", mem.help)
        .map((line) => line.text)
        .join("\n");
      expect(page).toContain("How to read malfind");
      expect(page).toMatch(/MZ/);
      expect(page).toMatch(/JIT/);
    });
  });

  describe("strings", () => {
    it("says it isn't available yet, points at cmdline, and emits no memory event", () => {
      const result = runCase(memoryState(), "mem", "strings", MEM_IMAGE, "--pid", "4120");
      expect(result.exitCode).toBe(0);
      expect(text(result)).toContain("isn't built yet");
      expect(text(result)).toContain(`mem cmdline ${MEM_IMAGE} --pid 4120`);
      expect(eventTypes(result)).toEqual(["command.run"]);
    });
  });

  it("puts a process on the board from a psscan row", () => {
    const { state } = runAll(memoryState(), [["mem", "psscan", MEM_IMAGE]]);
    const row = runCase(state, "pin", "15", "-m", "hidden from the list");
    expect(row.events[0]).toMatchObject({ type: "board.pinned", ref: pidRef(PIDS.hidden) });
  });

  it("has a man page with the teaching-model note and a Real-world equivalent section", () => {
    const page = renderManPage("mem", mem.help).map((line) => line.text);
    expect(page).toContain(REAL_WORLD_HEADING);
    expect(page.join("\n")).toContain("teaching model");
    expect(page.join("\n")).toContain("windows.malfind");
  });

  it("reports what it can't do in words the explainer can pick up", () => {
    const state = memoryState();
    expect(errorCodes(runCase(bareState(), "mem", "ps", MEM_IMAGE))).toEqual([
      "EVIDENCE_NOT_LOADED",
    ]);
    expect(errorCodes(runCase(state, "mem", "list", MEM_IMAGE))).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(runCase(state, "mem", "ps"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(runCase(state, "mem", "ps", MEM_IMAGE, "extra"))).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(runCase(state, "mem", "ps", "qf-lt-99"))).toEqual(["MEMORY_NOT_FOUND"]);
    expect(errorCodes(runCase(state, "mem", "ps", MEM_IMAGE, "--pid", "4"))).toEqual(["BAD_FLAG"]);
    expect(errorCodes(runCase(state, "mem", "cmdline", MEM_IMAGE, "--pid", "x"))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(errorCodes(runCase(state, "mem", "cmdline", MEM_IMAGE, "--pid", "7"))).toEqual([
      "PROCESS_NOT_FOUND",
    ]);
    expect(errorCodes(runCase(state, "mem", "ps", MEM_IMAGE, "--zone", "Mars"))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(text(runCase(state, "mem", "ps", "qf-lt-99"))).toBe(
      "mem: qf-lt-99: no memory image by that name",
    );
    expect(text(runCase(state, "mem", "cmdline", MEM_IMAGE, "--pid", "7"))).toBe(
      "mem: qf-srv-01-mem: no process with pid 7",
    );
  });

  it("changes nothing in the state but what it printed", () => {
    const state = memoryState();
    const result = runCase(state, "mem", "malfind", MEM_IMAGE);
    expect(result.state.evidence?.set).toBe(state.evidence?.set);
    expect(result.state.evidence?.images).toBe(state.evidence?.images);
    expect(result.state.evidence?.lastCommand).toBe(`mem malfind ${MEM_IMAGE}`);
  });
});
