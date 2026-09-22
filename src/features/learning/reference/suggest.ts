import type { SearchEntry } from "@/lib/search";

/**
 * What the in-mission reference drawer suggests before the learner searches
 * (md-files/09-learning-center.md, prompt 09.5): the lessons behind the current mission, and the
 * lessons about the last command they ran. Pure, over the search index.
 */

export interface ReferenceContext {
  readonly missionId: string;
  /** Lesson ids the mission lists: its `concepts`, then its further reading. */
  readonly missionLessonIds: readonly string[];
  /** The last command the learner ran, like `netscan`. */
  readonly lastCommand?: string;
}

export interface ReferenceSuggestions {
  /** Lessons that explain the last command, best first. */
  readonly forCommand: readonly SearchEntry[];
  /** Lessons for this mission: the ones it names first, then others that point at it. */
  readonly forMission: readonly SearchEntry[];
}

const lessonId = (entry: SearchEntry) => entry.id.replace(/^lesson:/, "");

export function referenceSuggestions(
  entries: readonly SearchEntry[],
  { missionId, missionLessonIds, lastCommand }: ReferenceContext,
): ReferenceSuggestions {
  const lessons = entries.filter((entry) => entry.kind === "lesson");
  const byId = new Map(lessons.map((entry) => [lessonId(entry), entry]));
  // A lesson can be both a concept and further reading: list it once, where it first appears.
  const named = [...new Set(missionLessonIds)].flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
  const namedIds = new Set(named.map(lessonId));
  const pointing = lessons.filter(
    (entry) => !namedIds.has(lessonId(entry)) && (entry.missions ?? []).includes(missionId),
  );
  const forCommand =
    lastCommand === undefined
      ? []
      : lessons.filter((entry) => (entry.commands ?? []).includes(lastCommand)).slice(0, 4);
  return { forCommand, forMission: [...named, ...pointing] };
}

/** The command a line starts with: `sudo cat x` → `sudo`, `  ls -l` → `ls`. */
export function commandOf(line: string | undefined): string | undefined {
  const word = line?.trim().split(/\s+/)[0];
  return word === undefined || word === "" ? undefined : word;
}
