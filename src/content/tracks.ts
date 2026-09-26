/**
 * The Learning Center's tracks: short, ordered paths through the lessons
 * (docs/plan/13-learning-center.md, "Tracks and lessons"). A track is a recommendation, never a
 * gate: every lesson is open, and a track never nags about lessons skipped.
 *
 * tests/unit/lesson-content.test.ts checks that every id here is a real lesson, that every lesson
 * is in a track, and that no lesson comes before its own prerequisites.
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

export const DISK: Track = {
  id: "disk",
  title: "Disk",
  description:
    "Four lessons on what a drive holds and what deleting leaves behind: partitions and file systems, the four times on every file, deleted versus overwritten, and carving files with no name.",
  lessons: [
    "disk-partitions-and-filesystems",
    "disk-macb-timestamps",
    "disk-deleted-vs-overwritten",
    "disk-carving",
  ],
};

export const MEMORY: Track = {
  id: "memory",
  title: "Memory",
  description:
    "Four lessons on what a running computer holds and a switched-off one forgets: why memory is captured first, processes and their parents, network connections, and code that hides inside another program.",
  lessons: [
    "memory-why-ram-matters",
    "memory-processes-and-parents",
    "memory-network-artefacts",
    "memory-code-injection",
  ],
};

export const LOGS_AND_TIMELINES: Track = {
  id: "logs-and-timelines",
  title: "Logs and timelines",
  description:
    "Four lessons on putting it all in order and saying what it means: Windows sign-in records, time zones and clocks, one timeline from every source, and a report where every finding points at evidence.",
  lessons: [
    "logs-windows-logon-events",
    "logs-time-zones-and-clocks",
    "logs-super-timelines",
    "report-writing-the-report",
  ],
};

export const TRACKS: readonly Track[] = [FOUNDATIONS, DISK, MEMORY, LOGS_AND_TIMELINES];
