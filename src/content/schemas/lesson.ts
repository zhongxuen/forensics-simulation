import { z } from "zod";
import {
  BEGINNER_LEVEL_MAX,
  BEGINNER_READING_MINUTES_MAX,
  LESSON_LEVELS,
  LESSON_TOPIC_IDS,
} from "../topics";
import { CommandNameSchema, ContentIdSchema, uniqueIds } from "./ids";

/** Lesson ids that would collide with a page under /learn. */
export const RESERVED_LESSON_IDS: readonly string[] = ["glossary", "commands"];

/**
 * A lesson's YAML frontmatter (md-files/09-learning-center.md, "Content model").
 *
 * Unknown keys are rejected, so a typo like `prerequisite:` fails loudly instead of being ignored.
 * Whether the ids in the reference lists point at something real is checked across the whole
 * catalog by findDeadReferences (src/content/references.ts), not here.
 */
export const LessonFrontmatterSchema = z
  .strictObject({
    /** Must match the file name: `net-ports` lives in `net-ports.mdx`. */
    id: ContentIdSchema.refine((id) => !RESERVED_LESSON_IDS.includes(id), {
      message: `That id is taken by a page. Reserved: ${RESERVED_LESSON_IDS.join(", ")}.`,
    }),
    title: z.string().trim().min(1).max(80),
    topic: z.enum(LESSON_TOPIC_IDS),
    level: z.union(LESSON_LEVELS.map((level) => z.literal(level))),
    readingMinutes: z.number().int().min(1).max(30),
    /** Required at levels 0 and 1: the familiar thing the idea is like. */
    analogy: z.string().trim().min(1).optional(),
    /** One plain sentence for lesson cards. Leave out to show the analogy instead. */
    summary: z.string().trim().min(1).max(160).optional(),
    /** Lessons worth reading first. */
    prerequisites: uniqueIds(ContentIdSchema).default([]),
    /** Missions that put this lesson into practice. */
    relatedMissions: uniqueIds(ContentIdSchema).default([]),
    /** Simulated commands the lesson explains. */
    relatedCommands: uniqueIds(CommandNameSchema).default([]),
    /** Glossary entries the lesson defines with <Term>. */
    glossaryTerms: uniqueIds(ContentIdSchema).default([]),
  })
  .superRefine((lesson, ctx) => {
    if (lesson.level <= BEGINNER_LEVEL_MAX) {
      if (lesson.analogy === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["analogy"],
          message: `Level ${lesson.level} lessons need an analogy: start from something familiar.`,
        });
      }
      if (lesson.readingMinutes > BEGINNER_READING_MINUTES_MAX) {
        ctx.addIssue({
          code: "custom",
          path: ["readingMinutes"],
          message: `Level ${lesson.level} lessons take ${BEGINNER_READING_MINUTES_MAX} minutes or less. Split it into two lessons.`,
        });
      }
    }
    if (lesson.prerequisites.includes(lesson.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["prerequisites"],
        message: "A lesson can't be its own prerequisite.",
      });
    }
  });

/** Frontmatter as written in the file. */
export type LessonFrontmatterInput = z.input<typeof LessonFrontmatterSchema>;

/** Frontmatter after validation, with every list filled in. */
export type LessonFrontmatter = z.output<typeof LessonFrontmatterSchema>;
