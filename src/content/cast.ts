/**
 * The story's cast: everyone who can speak in a mission's story beats, from the quick-reference
 * table in md-files/story-bible.md. Mission schemas validate every beat's `speaker` against these
 * ids, and the mission runner renders each beat with `CharacterMessage` using the name, role,
 * initials and tone here.
 *
 * Ids are stable: never rename or reuse one. The prefix states the role (`mentor-`, `teammate-`,
 * `client-`). A new character goes into the story bible first (with a names check), then here.
 * The antagonists, the Hollow Latch, never speak in a beat, so they have no id.
 */

export const CAST_IDS = [
  "mentor-noor",
  "teammate-theo",
  "teammate-kit",
  "teammate-idris",
  "client-roz",
] as const;

export type CastId = (typeof CAST_IDS)[number];

/** How a character relates to the learner. */
export type CastRelation = "mentor" | "teammate" | "client";

/**
 * The speech-bubble style `CharacterMessage` supports. Only the mentor gets the mentor style;
 * teammates and clients share the teammate style.
 */
export type CastTone = "mentor" | "teammate";

export interface CastMember {
  readonly id: CastId;
  /** Full name, shown above each line they say. */
  readonly name: string;
  readonly pronouns: string;
  readonly relation: CastRelation;
  /** Their job, in sentence case, shown after the name: "Noor Halvorsen · Senior analyst". */
  readonly role: string;
  /** Shown in the avatar. */
  readonly initials: string;
  readonly tone: CastTone;
}

export const CAST: Readonly<Record<CastId, CastMember>> = {
  "mentor-noor": {
    id: "mentor-noor",
    name: "Noor Halvorsen",
    pronouns: "she/her",
    relation: "mentor",
    role: "Your mentor, senior analyst",
    initials: "NH",
    tone: "mentor",
  },
  "teammate-theo": {
    id: "teammate-theo",
    name: "Theo Ashgrove",
    pronouns: "he/him",
    relation: "teammate",
    role: "Team lead",
    initials: "TA",
    tone: "teammate",
  },
  "teammate-kit": {
    id: "teammate-kit",
    name: "Kit Nakashima-Reyes",
    pronouns: "they/them",
    relation: "teammate",
    role: "Analyst",
    initials: "KN",
    tone: "teammate",
  },
  "teammate-idris": {
    id: "teammate-idris",
    name: "Idris Fenwick",
    pronouns: "he/him",
    relation: "teammate",
    role: "Defender, reads the logs",
    initials: "IF",
    tone: "teammate",
  },
  "client-roz": {
    id: "client-roz",
    name: "Roz Kowalczyk",
    pronouns: "she/her",
    relation: "client",
    role: "Owner of Tumbleloaf Bakery",
    initials: "RK",
    tone: "teammate",
  },
};

/**
 * The mentor: the in-world face of hints and the AI Mentor (phase 10), and the voice of generic
 * mentor lines like the network map's first-discovery tip. Components use this rather than
 * naming a cast id.
 */
export const MENTOR: CastMember = CAST["mentor-noor"];

/** The cast member with this id, or undefined. */
export function getCastMember(id: string): CastMember | undefined {
  return Object.hasOwn(CAST, id) ? CAST[id as CastId] : undefined;
}
