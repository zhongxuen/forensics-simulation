/**
 * The Learning Center's lesson topics, in display order (md-files/09-learning-center.md, "Content
 * model"). Lessons and glossary entries are each filed under one.
 *
 * `foundations` covers the absolute basics, security fundamentals, and ethics and law. Topics are
 * not the fixed skill taxonomy that missions are tagged with (improvement #9): a topic files
 * reading material, a skill names something a learner practises.
 */

export const LESSON_TOPIC_IDS = [
  "foundations",
  "linux",
  "networking",
  "web",
  "crypto",
  "forensics",
  "blue-team",
] as const;

export type LessonTopic = (typeof LESSON_TOPIC_IDS)[number];

export interface LessonTopicInfo {
  readonly id: LessonTopic;
  /** Shown on filters, badges and section headings. */
  readonly label: string;
  /** What the topic covers, in words a beginner already knows. */
  readonly description: string;
}

export const LESSON_TOPICS: Readonly<Record<LessonTopic, LessonTopicInfo>> = {
  foundations: {
    id: "foundations",
    label: "Foundations",
    description: "The very basics, how security works, and the rules every ethical hacker follows",
  },
  linux: {
    id: "linux",
    label: "Linux",
    description: "Files, folders, users and commands on the computers most servers run",
  },
  networking: {
    id: "networking",
    label: "Networking",
    description: "How computers find each other and pass messages",
  },
  web: {
    id: "web",
    label: "The web",
    description: "How websites work, and how they get attacked and protected",
  },
  crypto: {
    id: "crypto",
    label: "Cryptography",
    description: "How secrets and passwords are scrambled, stored and checked",
  },
  forensics: {
    id: "forensics",
    label: "Forensics",
    description: "Finding out what happened on a computer after the fact",
  },
  "blue-team": {
    id: "blue-team",
    label: "Defending",
    description: "Spotting attacks early and keeping systems safe",
  },
};

/**
 * How deep a lesson goes. 0 is for someone who has never heard of the idea; lessons at 0 and 1
 * must open with an analogy and take 5 minutes or less.
 */
export const LESSON_LEVELS = [0, 1, 2, 3] as const;

export type LessonLevel = (typeof LESSON_LEVELS)[number];

export const LESSON_LEVEL_LABELS: Readonly<Record<LessonLevel, string>> = {
  0: "First steps",
  1: "Primer",
  2: "Working knowledge",
  3: "Deep dive",
};

/** Lessons at or below this level need an analogy and a short reading time. */
export const BEGINNER_LEVEL_MAX: LessonLevel = 1;

/** The longest a beginner (level 0–1) lesson may take to read, in minutes. */
export const BEGINNER_READING_MINUTES_MAX = 5;
