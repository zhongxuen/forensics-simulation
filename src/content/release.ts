import { CHAPTER_ONE, isReleased } from "./cases/chapter";

/**
 * What the landing page promises, in one place so the voice rules can check it
 * (`tests/unit/release-copy.test.ts`) and a release only has to change the chapter's `released`
 * flags (docs/plan/15-quality-and-launch.md). The disclaimers are the drafts in
 * docs/plan/16-portfolio-entry.md, so the site and its portfolio card say the same thing.
 */

/** Hacker Simulation, the sibling game: Candlewright's red team, in the same world. */
export const HACKER_SIMULATION_URL = "https://hacker-simulation.vercel.app";

/** The landing page's eyebrow and H1: the studio small, the game's name large (UIUX.md §2.2). */
export const EYEBROW = "Candlewright";
export const TITLE = "Incident Room";

/** What this is, in one sentence. */
export const PITCH =
  "A story game where you join Candlewright Security's blue team and find out what happened to a client's computer, from a disk, a memory dump and a set of logs, in a simulated terminal. No experience needed.";

/** How long the chapter is, under the button. The minutes are each case file's `estimatedMinutes`. */
export const CHAPTER_LENGTH =
  "Three cases at one made-up haulage yard: Case 1 takes about 15 minutes, and Cases 2 and 3 about 30 each.";

/** Under the button: what it costs to start. */
export const START_NOTE =
  "No sign-up, nothing to install, and your work is saved in this browser only.";

/** The line that sits beside the SIMULATED marker, which already says "Simulated". */
export const SIMULATED_LINE = "Every piece of evidence here is made up.";

/** One step of a list on the landing page: a short name, then a sentence. */
export interface LandingStep {
  readonly title: string;
  readonly detail: string;
}

/**
 * The loop every case follows, drawn as a strip of four pictures (UIUX.md §2.2): the evidence
 * comes in, you examine it, you pin what you find, and the report points at the pins.
 */
export const LOOP_STEPS: readonly LandingStep[] = [
  { title: "Evidence", detail: "A disk, a memory dump and logs, signed for by the client." },
  { title: "Terminal", detail: "Examine them with investigator tools, one command at a time." },
  { title: "Case board", detail: "Pin each finding that proves something." },
  { title: "Report", detail: "Answer who, what and when, pointing at your pins." },
];

/** "What you'll do in Case 1", in three steps: Case 1's objectives in plain words. */
export const CASE_ONE_STEPS: readonly LandingStep[] = [
  {
    title: "Check the paperwork",
    detail: "Read the client's signed letter and the handover form that came with the laptop.",
  },
  {
    title: "Make a copy you can prove",
    detail:
      "Keep the drive safe from changes, copy it, and check the copy's fingerprint against the form.",
  },
  {
    title: "Find the note",
    detail: "Find the message someone left on the laptop's desktop, and pin it to your case board.",
  },
];

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
