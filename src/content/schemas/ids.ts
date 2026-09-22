import { z } from "zod";

/** Lowercase words joined by single hyphens: `net-ports`, `intro-01`, `ip-address`. */
export const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The id of a lesson, mission, or glossary entry. Ids are stable: links and progress use them. */
export const ContentIdSchema = z
  .string()
  .regex(CONTENT_ID_PATTERN, "Use lowercase letters, digits and single hyphens, like `net-ports`.");

/** A terminal command name as the learner types it: `netscan`, `ls`. */
export const CommandNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, "Use the command exactly as it's typed, like `netscan`.");

/** A list of ids with no repeats. */
export function uniqueIds<T extends z.ZodType<string>>(item: T) {
  return z.array(item).refine((ids) => new Set(ids).size === ids.length, {
    message: "Each id may appear only once.",
  });
}
