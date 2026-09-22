import { afterEach, describe, expect, it, vi } from "vitest";
import { GOLDEN_RUN } from "./__fixtures__/golden-run";
import { FIXTURE_SCENARIO } from "./__fixtures__/scenario";
import { replay, type ReplayResult } from "./core/replay";
import { serializeState } from "./core/serialize";
import { renderTranscript } from "./core/transcript";

const scenarios = { [FIXTURE_SCENARIO.id]: FIXTURE_SCENARIO };

/** Everything observable about a replay, as bytes: the transcript plus the final state. */
const fingerprint = (result: ReplayResult) =>
  `${renderTranscript(result.steps)}\n${serializeState(result.state, { pretty: true })}`;

describe("golden replay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("matches the committed transcript", async () => {
    const result = replay(GOLDEN_RUN, scenarios);
    await expect(renderTranscript(result.steps)).toMatchFileSnapshot(
      "./__fixtures__/golden/fixture-run.transcript.txt",
    );
  });

  it("matches the committed final state", async () => {
    const result = replay(GOLDEN_RUN, scenarios);
    await expect(`${serializeState(result.state, { pretty: true })}\n`).toMatchFileSnapshot(
      "./__fixtures__/golden/fixture-run.state.json",
    );
  });

  it("is byte-identical when replayed twice", () => {
    expect(fingerprint(replay(GOLDEN_RUN, scenarios))).toBe(
      fingerprint(replay(GOLDEN_RUN, scenarios)),
    );
  });

  it("depends on the seed, so the determinism checks aren't vacuous", () => {
    const other = replay({ ...GOLDEN_RUN, seed: GOLDEN_RUN.seed + 1 }, scenarios);
    expect(fingerprint(other)).not.toBe(fingerprint(replay(GOLDEN_RUN, scenarios)));
  });

  it("fails loudly if the engine reads real time or randomness", () => {
    const trap = (what: string) => () => {
      throw new Error(
        `Non-determinism: ${what} was called during a replay. src/sim must use the injected clock and seeded RNG.`,
      );
    };
    vi.spyOn(Math, "random").mockImplementation(trap("Math.random()"));
    vi.spyOn(Date, "now").mockImplementation(trap("Date.now()"));
    vi.spyOn(performance, "now").mockImplementation(trap("performance.now()"));
    const RealDate = Date;
    vi.stubGlobal(
      "Date",
      new Proxy(RealDate, {
        construct(target, args: unknown[]) {
          if (args.length === 0) trap("new Date()")();
          return Reflect.construct(target, args);
        },
      }),
    );

    let result: ReplayResult | undefined;
    let thrown: unknown;
    try {
      result = replay(GOLDEN_RUN, scenarios);
    } catch (error) {
      thrown = error;
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
    expect(thrown).toBeUndefined();
    expect(result && fingerprint(result)).toBe(fingerprint(replay(GOLDEN_RUN, scenarios)));
  });
});
