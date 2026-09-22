import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPrerequisiteGraph, type PrerequisiteGraph } from "@/content/lesson-graph";
import type { LessonFrontmatter } from "@/content/schemas/lesson";
import { LESSON_TOPIC_IDS, type LessonLevel, type LessonTopic } from "@/content/topics";
import { parseLessonSource } from "./frontmatter";

/**
 * Loads lessons from `src/content/lessons/*.mdx` (md-files/09-learning-center.md, prompt 09.1).
 *
 * Server only: it reads the files with Node's fs. Lesson pages are generated at build time, so in
 * production this runs during `next build`, not per request.
 */

/** Where lesson files live, relative to the project root. */
export const LESSONS_DIR = join(process.cwd(), "src", "content", "lessons");

export interface Lesson extends LessonFrontmatter {
  /** The MDX after the frontmatter. */
  readonly body: string;
}

export interface LessonCatalog {
  /** Every lesson, grouped by topic in display order, each after its prerequisites. */
  readonly lessons: readonly Lesson[];
  readonly graph: PrerequisiteGraph;
  getLesson(id: string): Lesson | undefined;
}

export interface LessonFilter {
  topic?: LessonTopic;
  level?: LessonLevel;
  /** Lessons at this level or below. */
  maxLevel?: LessonLevel;
}

/** Reads and validates every lesson in `dir`. Throws a LessonSourceError on the first bad file. */
export function loadLessonCatalog(dir: string = LESSONS_DIR): LessonCatalog {
  const fileNames = readdirSync(dir)
    .filter((name) => name.endsWith(".mdx"))
    .sort();
  const parsed: Lesson[] = fileNames.map((fileName) => {
    const { frontmatter, body } = parseLessonSource(
      readFileSync(join(dir, fileName), "utf8"),
      fileName,
    );
    return { ...frontmatter, body };
  });

  const topicIndex = (lesson: Lesson) => LESSON_TOPIC_IDS.indexOf(lesson.topic);
  parsed.sort(
    (a, b) =>
      topicIndex(a) - topicIndex(b) || a.level - b.level || a.title.localeCompare(b.title, "en"),
  );

  const graph = buildPrerequisiteGraph(parsed);
  const readingPosition = new Map(graph.order.map((id, index) => [id, index]));
  const lessons = [...parsed].sort(
    (a, b) =>
      topicIndex(a) - topicIndex(b) ||
      (readingPosition.get(a.id) ?? 0) - (readingPosition.get(b.id) ?? 0),
  );
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  return { lessons, graph, getLesson: (id) => byId.get(id) };
}

let cached: LessonCatalog | undefined;

/**
 * The catalog for src/content/lessons. Cached in production. In development it's read again on
 * every call, so an edited lesson shows up on reload.
 */
export function getLessonCatalog(): LessonCatalog {
  if (process.env.NODE_ENV !== "production") return loadLessonCatalog();
  cached ??= loadLessonCatalog();
  return cached;
}

/** The lesson with this id, or undefined. */
export function getLesson(id: string): Lesson | undefined {
  return getLessonCatalog().getLesson(id);
}

/** Lessons matching `filter`, in catalog order. */
export function listLessons(filter: LessonFilter = {}): readonly Lesson[] {
  return getLessonCatalog().lessons.filter(
    (lesson) =>
      (filter.topic === undefined || lesson.topic === filter.topic) &&
      (filter.level === undefined || lesson.level === filter.level) &&
      (filter.maxLevel === undefined || lesson.level <= filter.maxLevel),
  );
}

/** Which lessons are worth reading before which. */
export function getPrerequisiteGraph(): PrerequisiteGraph {
  return getLessonCatalog().graph;
}
