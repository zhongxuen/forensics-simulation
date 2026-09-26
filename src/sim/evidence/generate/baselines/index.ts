import { analystWorkstation } from "./analyst-workstation";
import { officeLaptop } from "./office-laptop";
import { officeServer } from "./office-server";
import { trainingLaptop } from "./training-laptop";
import type { Baseline } from "./types";

/**
 * The clean machine templates a case can build a machine from. Adding one is a new file here plus
 * one line in `BASELINES`.
 */
export const BASELINES: Readonly<Record<string, Baseline>> = {
  [officeLaptop.id]: officeLaptop,
  [officeServer.id]: officeServer,
  [analystWorkstation.id]: analystWorkstation,
  [trainingLaptop.id]: trainingLaptop,
};

/** Every baseline id, sorted, for error messages and the authoring scripts. */
export const BASELINE_IDS: readonly string[] = Object.keys(BASELINES).sort();

export function getBaseline(id: string): Baseline | undefined {
  return Object.hasOwn(BASELINES, id) ? BASELINES[id] : undefined;
}

export type { Baseline, BaselineFile, BaselineHomeFile, BaselineProcess } from "./types";
