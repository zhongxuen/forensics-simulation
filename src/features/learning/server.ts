/**
 * The Learning Center's server-only API: loading lessons from src/content/lessons and compiling
 * their MDX. It reads files with Node's fs, so import it only from server components, route
 * handlers, build-time functions like generateStaticParams, and tests. Client code uses
 * `@/features/learning`.
 */
export { compileLessonBody, type CompiledLesson } from "./lessons/compile";
export { LESSON_CODE_LANGUAGES } from "./lessons/highlight";
export { LessonSourceError, parseLessonSource, type LessonSource } from "./lessons/frontmatter";
export { LessonArticle, type LessonTrackPosition } from "./lessons/lesson-article";
export {
  getLesson,
  getLessonCatalog,
  getPrerequisiteGraph,
  listLessons,
  loadLessonCatalog,
  LESSONS_DIR,
  type Lesson,
  type LessonCatalog,
  type LessonFilter,
} from "./lessons/loader";
export { renderLesson, renderLessonBody, type RenderedLesson } from "./lessons/render";
export { buildSearchIndex } from "./search/build-index";
export { TableOfContents } from "./lessons/table-of-contents";
