/**
 * Carving, strings and log queries end to end (docs/plan/07-carve-strings-logq.md, "Done when"):
 * a committed transcript of one pass over a drive with a deleted, partly overwritten PDF and a
 * recoverable ZIP, and a server log with forty failed logons from one address. It has to be the
 * same bytes every run. Refs are written at the end of the line that carries them, so the
 * transcript shows what `pin` would store.
 *
 * Never edit the golden file by hand: delete it and rerun the test after an intentional change.
 */
import { describe, expect, it } from "vitest";
import type { ReplayStep } from "../../core/replay";
import { renderTranscript } from "../../core/transcript";
import type { SimResult, SimState } from "../../core/types";
import { sh } from "../../__fixtures__/shell";
import { BURST, CARVE_OUT, carveState, DEVICE, RECORDS, runLine } from "./__fixtures__/carve-logs";
import { CASE_DIR, IMAGE_PATH } from "./__fixtures__/evidence";

const LINES: readonly string[] = [
  `acquire ${DEVICE} --out ${IMAGE_PATH}`,
  `recover qf-lt-07 ${RECORDS.invoice0413} --out ${CASE_DIR}/export/inv-0413.pdf`,
  `recover qf-lt-07 ${RECORDS.statements} --out ${CASE_DIR}/export/statements-april.zip`,
  `carve qf-lt-07 --out ${CARVE_OUT}`,
  "strings disk:qf-lt-07:carve/512",
  "strings -o disk:qf-lt-07:carve/1024",
  "strings -n 8 qf-srv-01-mem",
  "logq --source security --id 4625 --count-by IpAddress",
  `logq --source security --id 4625 --where IpAddress=${BURST.from} --to 2026-04-11T19:02:07Z`,
  `logq --source security --id 4625 | grep ${BURST.from}`,
  "pin 1 -m 'the_first_of_forty'",
  "logq --id 4624 --where LogonType=10 --zone local",
  "pin",
];

function run(): { steps: ReplayStep[]; results: SimResult[]; state: SimState } {
  let state = carveState();
  const steps: ReplayStep[] = [];
  const results: SimResult[] = [];
  for (const line of LINES) {
    const result = runLine(state, line);
    results.push(result);
    steps.push({
      command: sh(line),
      output: result.output.map((out) =>
        out.ref ? { ...out, text: `${out.text}  [${out.ref}]` } : out,
      ),
      events: result.events,
      exitCode: result.exitCode,
    });
    state = result.state;
  }
  return { steps, results, state };
}

describe("carve, strings and logq, end to end", () => {
  it("matches the committed transcript", async () => {
    await expect(renderTranscript(run().steps)).toMatchFileSnapshot(
      "./__fixtures__/golden/carve-strings-logq.txt",
    );
  });

  it("is byte-identical when run twice", () => {
    expect(renderTranscript(run().steps)).toBe(renderTranscript(run().steps));
  });

  it("refuses the overwritten PDF, recovers the ZIP, and carves what is left of the PDF", () => {
    const { results } = run();
    expect(results[1]?.exitCode).toBe(1);
    expect(results[2]?.exitCode).toBe(0);
    expect(results[3]?.events.filter((e) => e.type === "evidence.carved")).toHaveLength(4);
    expect(results[3]?.events).toContainEqual(
      expect.objectContaining({ type: "evidence.carved", fileType: "pdf", complete: false }),
    );
  });

  it("pins lines that came through grep, with the record they belong to", () => {
    const { results } = run();
    const pins = results.flatMap((r) => r.events.filter((e) => e.type === "board.pinned"));
    expect(pins.map((pin) => pin.type === "board.pinned" && pin.ref)).toEqual([
      "log:security/3",
      "log:security/43",
    ]);
  });
});
