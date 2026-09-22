import { evaluate } from "@mdx-js/mdx";
import type { MDXContent } from "mdx/types";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { lessonHighlighting } from "./highlight";
import { remarkLesson, type LessonAnalysis, type TocEntry } from "./remark-lesson";

export interface CompiledLesson {
  /** The lesson body as a component. Pass it the lesson components to render. */
  readonly Content: MDXContent;
  readonly toc: readonly TocEntry[];
  /** Glossary ids used by <Term> in the body. */
  readonly termIds: readonly string[];
  /** Mission ids used by <TryIt> in the body. */
  readonly missionIds: readonly string[];
}

/**
 * Compiles a lesson's MDX body on the server: GitHub-style tables and lists, heading anchors and
 * a table of contents, highlighted code, and the lesson house rules (remark-lesson.ts).
 *
 * `label` names the lesson in error messages. Compiling runs the MDX as code, which is fine for
 * lessons in this repo and never for anything a visitor wrote.
 */
export async function compileLessonBody(body: string, label: string): Promise<CompiledLesson> {
  const analysis: LessonAnalysis = { toc: [], termIds: [], missionIds: [] };
  const highlighting = await lessonHighlighting();
  try {
    const { default: Content } = await evaluate(body, {
      ...runtime,
      development: false,
      remarkPlugins: [remarkGfm, [remarkLesson, analysis, highlighting.languages]],
      rehypePlugins: [highlighting.plugin],
    });
    return {
      Content,
      toc: analysis.toc,
      termIds: analysis.termIds,
      missionIds: analysis.missionIds,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Couldn't build the lesson ${label}. ${reason}`, { cause: error });
  }
}
