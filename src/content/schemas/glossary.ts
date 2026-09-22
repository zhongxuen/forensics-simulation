import { z } from "zod";
import { LESSON_TOPIC_IDS } from "../topics";
import { ContentIdSchema, uniqueIds } from "./ids";

/**
 * One glossary entry (md-files/09-learning-center.md, prompt 09.3).
 *
 * The rules a schema can't express (the short definition is one sentence with no other jargon in
 * it, related ids exist) are checked over the whole glossary in tests/unit/glossary.test.ts.
 */
export const GlossaryEntrySchema = z.strictObject({
  /** Stable id used by <Term id="…"> and lesson frontmatter: `ip-address`. */
  id: ContentIdSchema,
  /** The entry's heading, in sentence case: "IP address", "Port". */
  term: z.string().trim().min(1).max(40),
  /** Other names people use for it, like the acronym on its own. */
  aka: z.array(z.string().trim().min(1)).default([]),
  topic: z.enum(LESSON_TOPIC_IDS),
  /**
   * One sentence a complete beginner understands, with no other jargon in it. Shown in the
   * hover card, so it has to stand on its own.
   */
  short: z.string().trim().min(1).max(200),
  /** A few more sentences: how it works, an example, where the learner will meet it. */
  long: z.string().trim().min(1),
  /**
   * A word most people already use (computer, password). Other entries' short definitions may use
   * it without counting it as jargon.
   */
  everyday: z.boolean().default(false),
  relatedTerms: uniqueIds(ContentIdSchema).default([]),
  relatedLessons: uniqueIds(ContentIdSchema).default([]),
});

export const GlossarySchema = z.array(GlossaryEntrySchema).superRefine((entries, ctx) => {
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.id)) {
      ctx.addIssue({ code: "custom", path: [index, "id"], message: `Duplicate id "${entry.id}".` });
    }
    seen.add(entry.id);
  });
});

export type GlossaryEntryInput = z.input<typeof GlossaryEntrySchema>;
export type GlossaryEntry = z.output<typeof GlossaryEntrySchema>;
