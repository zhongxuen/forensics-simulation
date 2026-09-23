/**
 * The Learning Center's tracks: short, ordered paths through the lessons
 * (docs/plan/13-learning-center.md, "Tracks and lessons"). A track is a recommendation, never a
 * gate: every lesson is open, and a track never nags about lessons skipped.
 *
 * tests/unit/lesson-content.test.ts checks that every id here is a real lesson, that every lesson
 * is in a track, and that no lesson comes before its own prerequisites. The Disk, Memory and Logs
 * and timelines tracks arrive with prompts 13.2 and 13.3.
 */

export interface Track {
  readonly id: string;
  readonly title: string;
  /** One line for someone deciding where to begin. */
  readonly description: string;
  /** Lesson ids, in reading order. */
  readonly lessons: readonly string[];
}

export const FOUNDATIONS: Track = {
  id: "foundations",
  title: "Foundations",
  description:
    "Four lessons on how an investigation works before any tool comes out: what forensics is, what to collect first, how to record who had the evidence, and how to prove a copy is exact.",
  lessons: [
    "foundations-what-forensics-is",
    "foundations-order-of-volatility",
    "foundations-chain-of-custody",
    "foundations-hashing-for-evidence",
  ],
};

export const TRACKS: readonly Track[] = [FOUNDATIONS];
