import { CHAPTER_ONE, isReleased } from "./cases/chapter";

/**
 * What the landing page promises, in one place so the voice rules can check it
 * (`tests/unit/release-copy.test.ts`) and a release only has to change the chapter's `released`
 * flags (docs/plan/15-quality-and-launch.md). The disclaimers are the drafts in
 * docs/plan/16-portfolio-entry.md, so the site and its portfolio card say the same thing.
 */

/** Hacker Simulation, the sibling game: Candlewright's red team, in the same world. */
export const HACKER_SIMULATION_URL = "https://hacker-simulation.vercel.app";

/** What this is, in one sentence. */
export const PITCH =
  "A story game where you join Candlewright Security's blue team and find out what happened to a client's computer, from a disk, a memory dump and a set of logs, in a simulated terminal. No experience needed.";

/** The line that sits beside the SIMULATED marker. */
export const SIMULATED_LINE = "SIMULATED: every piece of evidence is made up.";

export const DISCLAIMERS: readonly string[] = [
  "Every disk image, memory dump and log is made up and generated from a written story. Nothing here parses a real image or real memory, and the tools have invented names. Each tool's manual names the real tool it imitates.",
  "It teaches the investigator's workflow, not the internals of any one commercial tool, and it isn't preparation for a certification.",
  "No accounts and no database: your cases are saved in your own browser, and you can export or clear them.",
];

/** Case numbers in the chapter that aren't released yet, in chapter order. */
function unreleasedNumbers(): number[] {
  return CHAPTER_ONE.cases.flatMap((id, index) => (isReleased(id) ? [] : [index + 1]));
}

/**
 * "Cases 2 and 3 are still being written.", from the chapter's `released` flags, or undefined once
 * every case is out.
 */
export function stillBeingWritten(): string | undefined {
  const numbers = unreleasedNumbers();
  if (numbers.length === 0) return undefined;
  if (numbers.length === 1) return `Case ${numbers[0]} is still being written.`;
  const last = numbers[numbers.length - 1];
  return `Cases ${numbers.slice(0, -1).join(", ")} and ${last} are still being written.`;
}
