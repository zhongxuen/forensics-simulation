/** Helpers for engine tests: a fixture state, a fixed clock, and a one-line way to run a command. */
import { fixedClock } from "../core/clock";
import { createInitialState, scenarioStartMs } from "../core/scenario";
import { step } from "../core/step";
import type { SimContext, SimResult, SimState } from "../core/types";
import { FIXTURE_SCENARIO, FIXTURE_SEED } from "./scenario";

export const FIXTURE_NOW = scenarioStartMs(FIXTURE_SCENARIO) + 60_000;

export const testContext = (overrides: Partial<SimContext> = {}): SimContext => ({
  ...fixedClock(FIXTURE_NOW),
  ...overrides,
});

export const fixtureState = (seed = FIXTURE_SEED): SimState =>
  createInitialState(FIXTURE_SCENARIO, seed);

/** Runs one command line (already split into words) against `state`. */
export const run = (state: SimState, ...argv: string[]): SimResult =>
  step(state, { type: "exec", argv }, testContext());

/** The output as plain text, one line per output line. */
export const text = (result: SimResult): string =>
  result.output.map((line) => line.text).join("\n");

/** The typed error codes reported in the output. */
export const errorCodes = (result: SimResult): string[] =>
  result.output.flatMap((line) => (line.error ? [line.error.code] : []));

export const eventTypes = (result: SimResult): string[] => result.events.map((event) => event.type);
