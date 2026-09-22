/**
 * The guided first run (md-files/05-terminal-module.md, "Beginner experience"): a short tour that
 * gets someone who has never used a terminal to their first real commands, whoami, ls and cat,
 * in under a minute. Each command step ticks with its success line when that command works.
 *
 * Nothing records that the tour was seen. A mission starts it (the mission's `guidedTour` flag,
 * set on intro-01), and anyone can replay it from the terminal's help menu.
 */
import type { SimEvent } from "@/sim/types";

export interface TourStep {
  readonly id: string;
  /** What the card points at: the whole terminal, or the prompt. */
  readonly target: "terminal" | "prompt";
  readonly title: string;
  readonly body: string;
  /** A command that completes the step when it runs without an error. */
  readonly waitFor?: string;
  /** Shown once the step's command works. `{user}` becomes the account name. */
  readonly success?: string;
}

export const TERMINAL_TOUR: readonly TourStep[] = [
  {
    id: "welcome",
    target: "terminal",
    title: "This is a terminal",
    body: "You talk to the computer by typing commands here instead of clicking. This is a practice computer, so nothing you type can break anything.",
  },
  {
    id: "whoami",
    target: "prompt",
    title: "Your first command",
    body: "Type `whoami` and press Enter. It asks the computer which account you're using.",
    waitFor: "whoami",
    success:
      "That's you! You're `{user}` on this machine. Everyone who uses a computer does it through an account like this.",
  },
  {
    id: "ls",
    target: "prompt",
    title: "Look around",
    body: "Now type `ls` and press Enter. It lists what's in the folder you're in.",
    waitFor: "ls",
    success: "Those are the files and folders here. Folders show in blue.",
  },
  {
    id: "cat",
    target: "prompt",
    title: "Read a file",
    body: "Type `cat`, a space, and the name of a file from the list, then press Enter. Tab finishes the name for you.",
    waitFor: "cat",
    success:
      "You read a file! Reading files is most of what investigators do all day. You're off to a great start.",
  },
];

/** Whether the events from one command complete a tour step. */
export function completesStep(step: TourStep, events: readonly SimEvent[]): boolean {
  if (!step.waitFor) return false;
  return events.some(
    (event) =>
      event.type === "command.run" && event.command === step.waitFor && event.exitCode === 0,
  );
}

/** A step's success line, with the account name filled in. */
export const successText = (step: TourStep, user: string): string =>
  (step.success ?? "").replace("{user}", user);
