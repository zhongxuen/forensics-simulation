import { parse as parseYaml } from "yaml";
import { LessonFrontmatterSchema, type LessonFrontmatter } from "@/content/schemas/lesson";

/** A lesson file that can't be used, with a message that names the file and what to fix. */
export class LessonSourceError extends Error {
  constructor(
    readonly fileName: string,
    readonly problems: readonly string[],
  ) {
    super(`${fileName}:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    this.name = "LessonSourceError";
  }
}

export interface LessonSource {
  readonly frontmatter: LessonFrontmatter;
  /** The MDX after the frontmatter. */
  readonly body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Splits a lesson file into its YAML frontmatter and MDX body, and validates the frontmatter.
 * `fileName` is the file's base name: the frontmatter id must match it.
 */
export function parseLessonSource(source: string, fileName: string): LessonSource {
  const text = source.replace(/^﻿/, "");
  const match = FRONTMATTER.exec(text);
  if (!match) {
    throw new LessonSourceError(fileName, [
      "Start the file with frontmatter: a line of `---`, the lesson's details in YAML, and another `---`.",
    ]);
  }

  let data: unknown;
  try {
    data = parseYaml(match[1] ?? "");
  } catch (error) {
    throw new LessonSourceError(fileName, [
      `The frontmatter isn't valid YAML: ${(error as Error).message}`,
    ]);
  }

  const result = LessonFrontmatterSchema.safeParse(data);
  if (!result.success) {
    throw new LessonSourceError(
      fileName,
      result.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path === "" ? issue.message : `${path}: ${issue.message}`;
      }),
    );
  }

  const expectedId = fileName.replace(/\.mdx$/, "");
  if (result.data.id !== expectedId) {
    throw new LessonSourceError(fileName, [
      `id is "${result.data.id}", but the file is named ${fileName}. Rename one to match the other.`,
    ]);
  }

  return { frontmatter: result.data, body: text.slice(match[0].length) };
}
