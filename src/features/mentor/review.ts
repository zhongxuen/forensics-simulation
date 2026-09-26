import * as z from "zod/mini";
import type { MentorMode } from "./protocol";

/**
 * "Looking back with Noor" on the debrief (docs/plan/14-mentor.md §Spec): Noor looks back at the
 * run with the player. It leads with something they did well, describes their approach, names the
 * steps that went smoothly and any scenic routes, **says something about the order of the chain of
 * custody** (did they hash before they opened anything?), and points at lessons to try next. It is
 * formative feedback, never a grade, and never framed as weaknesses.
 *
 * Vendored from `../hacker-simulation/src/features/mentor/review.ts` (VENDORED.md). What is new
 * here is the custody part — the one thing this game teaches that a mission never had — and the
 * run facts that carry it.
 *
 * This file is client-safe: the review's shape, the facts the debrief gathers, the "at a glance"
 * lines, and the deterministic template the player gets when the model is unavailable. The server
 * side (prompt, output checks) lives in review-prompt.ts and review-handler.ts.
 */

/** A lesson Noor suggests trying next, and why, in one sentence. `why` may be empty. */
export interface MentorReviewLesson {
  readonly lessonId: string;
  readonly why: string;
}

export interface MentorReview {
  /** Something specific the player did well. Always first. */
  readonly wellDone: string;
  /** How they went about it, in a sentence or two. */
  readonly approach: string;
  /**
   * What the order of the chain of custody says: whether a hash came before anything was opened,
   * and what that means next time. One or two sentences, never a telling-off.
   */
  readonly custody: string;
  /** Steps that went smoothly. */
  readonly efficientSteps: readonly string[];
  /** Scenic routes: steps that took a detour, framed as something worth knowing, not a mistake. */
  readonly detours: readonly string[];
  /** Lessons to try next, from the case's own lessons. */
  readonly tryNext: readonly MentorReviewLesson[];
  /** One encouraging closing line. */
  readonly signOff: string;
}

export interface MentorReviewResult {
  readonly mode: MentorMode;
  readonly review: MentorReview;
}

/** How much of each part the player sees, however much the model wrote. */
export const REVIEW_LIMITS = {
  textChars: 600,
  efficientSteps: 3,
  detours: 2,
  tryNext: 3,
} as const;

const reviewText = z.string().check(z.trim(), z.minLength(1), z.maxLength(REVIEW_LIMITS.textChars));

/**
 * The review's shape, checked on both sides: the server checks what the model wrote, and the
 * browser checks what the server sent. Anything that doesn't fit becomes the template review.
 *
 * Written with zod/mini, because the browser runs it: the full Zod build would add about 90 KB to
 * the case pages (docs/plan/01-foundation.md §Browser bundle rules).
 */
export const MentorReviewSchema = z.object({
  wellDone: reviewText,
  approach: reviewText,
  custody: reviewText,
  efficientSteps: z.array(reviewText).check(z.maxLength(6)),
  detours: z.array(reviewText).check(z.maxLength(6)),
  tryNext: z
    .array(
      z.object({
        lessonId: z.string().check(z.trim(), z.minLength(1), z.maxLength(80)),
        why: z.string().check(z.trim(), z.maxLength(REVIEW_LIMITS.textChars)),
      }),
    )
    .check(z.maxLength(6)),
  signOff: reviewText,
});

// ---------------------------------------------------------------------------------------------
// The facts about a run
// ---------------------------------------------------------------------------------------------

/** One objective, as the review sees it. Secrets appear only once found. */
export interface ReviewObjectiveFact {
  readonly id: string;
  /** What the player was asked to do, as the case words it (backticks mark code). */
  readonly description: string;
  /** The playful name of a bonus objective or secret. */
  readonly name?: string;
  readonly kind: "main" | "bonus" | "secret";
  readonly done: boolean;
  /** Hint tiers opened for it. Hints are free: this is never a mark against anyone. */
  readonly hintsOpened: number;
}

/**
 * What the chain of custody looked like, as facts (docs/plan/14 §Spec: "mentioning the custody
 * log's order (did they hash first?)"). Only the **order and shape** of the record travels: the
 * kinds, in order, and whether the rule held. Never a digest, a path, a record number or a ref —
 * those are evidence, and the model has no business holding them.
 */
export interface ReviewCustodyFacts {
  /**
   * Every custody entry's kind, oldest first: "hashed", "original-read", "examined", "pinned"…
   * `src/features/cases/custody` builds the record; this is that record with the detail removed.
   */
  readonly order: readonly string[];
  /** Whether a hash was taken (and matched, if checked) before anything opened the evidence. */
  readonly hashedFirst: boolean;
  /** Whether an original was ever read with its write-blocker off, which changes the drive. */
  readonly readAroundBlocker: boolean;
}

/** Everything the debrief knows about the run, gathered by the cases feature. */
export interface ReviewFacts {
  readonly caseTitle: string;
  readonly objectives: readonly ReviewObjectiveFact[];
  /** From Start case to the debrief, in minutes, or null when unknown. */
  readonly minutes: number | null;
  /** Every command line run in this attempt, oldest first. */
  readonly commandLines: readonly string[];
  /**
   * The commands the workstation knows, so a typo (`lfs`) is never listed as a command the player
   * used. Leave out to list every word-shaped name.
   */
  readonly knownCommands?: readonly string[];
  /** How many pieces of evidence are on the case board. */
  readonly pinCount: number;
  /** The chain of custody, as order alone. */
  readonly custody: ReviewCustodyFacts;
  /** "n of m findings supported" from the report, or null for a case with no questions. */
  readonly findings: { readonly supported: number; readonly total: number } | null;
  /** Reset machine presses. */
  readonly resets: number;
  /** The case's lessons: its concepts, then its further reading, without repeats. */
  readonly lessonIds: readonly string[];
}

/** One row of "Your run at a glance". `value` marks commands with backticks. */
export interface RunFactLine {
  readonly label: string;
  readonly value: string;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** "`lsfs`, `inode` and `hashsum`". */
function codeList(names: readonly string[]): string {
  const coded = names.map((name) => `\`${name}\``);
  if (coded.length <= 1) return coded.join("");
  return `${coded.slice(0, -1).join(", ")} and ${coded.at(-1)}`;
}

/** The most distinct command names listed, in the order they were first used. */
export const MAX_LISTED_COMMANDS = 6;

/**
 * The commands used, by name, in the order first used: `lsfs image | grep pdf` counts `lsfs` and
 * `grep`. Only word-shaped names count, and with `known`, only commands the workstation has, so a
 * typo never shows as a command the player used.
 */
export function commandNames(lines: readonly string[], known?: readonly string[]): string[] {
  const names: string[] = [];
  for (const line of lines) {
    for (const segment of line.split(/\|\||&&|[|;]/)) {
      const name = segment.trim().split(/\s+/)[0] ?? "";
      if (!/^[a-z][\w.-]*$/i.test(name) || names.includes(name)) continue;
      if (known && !known.includes(name)) continue;
      names.push(name);
    }
  }
  return names;
}

function minutesText(minutes: number): string {
  if (minutes < 1) return "under a minute";
  const rounded = Math.round(minutes);
  return `about ${plural(rounded, "minute")}`;
}

/**
 * How the chain of custody read, in one plain sentence. Pure and deterministic, so the same run
 * always gets the same line, whether the model wrote the review or the template did. It is the
 * sentence the template uses, and the fact the prompt hands the model.
 */
export function custodySentence(custody: ReviewCustodyFacts): string {
  if (custody.order.length === 0) {
    return "Your chain of custody is empty this time: nothing you did touched the evidence yet. It fills itself in as you work, in the order you work.";
  }
  const around = custody.readAroundBlocker
    ? " One read went around a write-blocker, which is what moves a drive's times and its hash with them: the record shows that too, and showing it is the point."
    : "";
  return custody.hashedFirst
    ? `Your chain of custody starts with a hash, before anything opened the evidence. That is the order that makes everything after it hold up: the hash proves the copy you worked on is the copy you were handed.${around}`
    : `Your chain of custody shows the evidence being opened before a hash was taken. Nothing is lost — you can still hash it — but next time, hashing first is what lets you prove the copy never moved under you.${around}`;
}

/**
 * "Your run at a glance": objectives, time, hints opened, pins, findings and commands run, in plain
 * words. Pure and deterministic, so it shows the same with or without the model.
 */
export function runFactLines(facts: ReviewFacts): RunFactLine[] {
  const main = facts.objectives.filter((objective) => objective.kind === "main");
  const bonus = facts.objectives.filter((objective) => objective.kind === "bonus");
  const secretsFound = facts.objectives.filter(
    (objective) => objective.kind === "secret" && objective.done,
  );
  const hints = facts.objectives.reduce((sum, objective) => sum + objective.hintsOpened, 0);
  const names = commandNames(facts.commandLines, facts.knownCommands);
  const lines: RunFactLine[] = [
    {
      label: "Main objectives",
      value: `${main.filter((objective) => objective.done).length} of ${main.length} done`,
    },
  ];
  if (bonus.length > 0 || secretsFound.length > 0) {
    const parts: string[] = [];
    if (bonus.length > 0) {
      parts.push(`${bonus.filter((objective) => objective.done).length} of ${bonus.length} bonus`);
    }
    if (secretsFound.length > 0) parts.push(plural(secretsFound.length, "secret") + " found");
    lines.push({ label: "For the curious", value: parts.join(", ") });
  }
  if (facts.findings) {
    lines.push({
      label: "Findings supported",
      value: `${facts.findings.supported} of ${facts.findings.total}`,
    });
  }
  lines.push({
    label: "Evidence pinned",
    value:
      facts.pinCount === 0
        ? "nothing on the board"
        : plural(facts.pinCount, "piece") + " on the case board",
  });
  lines.push({
    label: "Hashed first",
    value: facts.custody.hashedFirst
      ? "yes: the hash came before anything was opened"
      : "not this time",
  });
  if (facts.minutes !== null) lines.push({ label: "Time", value: minutesText(facts.minutes) });
  lines.push({
    label: "Hints opened",
    value: hints === 0 ? "none this time" : `${hints}, and they're always free`,
  });
  lines.push({
    label: "Commands run",
    value:
      facts.commandLines.length === 0
        ? "none: you worked it out from the briefing and the views"
        : `${facts.commandLines.length}, using ${codeList(names.slice(0, MAX_LISTED_COMMANDS))}${
            names.length > MAX_LISTED_COMMANDS ? " and more" : ""
          }`,
  });
  return lines;
}

/**
 * The review written ahead of time, for when the model is unavailable, switched off or busy. It
 * still leads with what the player did, still says how their chain of custody read, and still
 * points at the case's own lessons, in Noor's voice. It never judges an approach it can't see, so
 * it has no smooth steps or scenic routes.
 */
export function buildFallbackReview(facts: ReviewFacts): MentorReview {
  const main = facts.objectives.filter((objective) => objective.kind === "main");
  const doneMain = main.filter((objective) => objective.done).length;
  const extras = facts.objectives
    .filter((objective) => objective.kind !== "main" && objective.done && objective.name)
    .map((objective) => objective.name as string);
  const names = commandNames(facts.commandLines, facts.knownCommands);

  const wellDone = [
    doneMain === main.length
      ? `You finished every main objective in ${facts.caseTitle}.`
      : `You finished ${doneMain} of ${main.length} main objectives in ${facts.caseTitle}.`,
    extras.length > 0
      ? `You found ${extras.length === 1 ? "a bonus, too" : "some extras, too"}: ${extras.join(", ")}.`
      : "",
    facts.findings && facts.findings.total > 0
      ? `Your report had ${facts.findings.supported} of ${facts.findings.total} findings supported by evidence you pinned.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const approach =
    facts.commandLines.length === 0
      ? "You worked this one from the briefing and the investigator views, one question at a time."
      : `You ran ${plural(facts.commandLines.length, "command")}, using ${codeList(
          names.slice(0, MAX_LISTED_COMMANDS),
        )}. Every command you tried taught you something about the evidence, including the ones that didn't work the first time.`;

  return {
    wellDone,
    approach,
    custody: custodySentence(facts.custody),
    efficientSteps: [],
    detours: [],
    tryNext: facts.lessonIds.slice(0, REVIEW_LIMITS.tryNext).map((lessonId) => ({
      lessonId,
      why: "",
    })),
    signOff: "Every case you close makes the next one make more sense. See you on the next one.",
  };
}
