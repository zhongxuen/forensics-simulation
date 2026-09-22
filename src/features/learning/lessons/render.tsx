import type { ReactElement } from "react";
import { compileLessonBody } from "./compile";
import { LESSON_COMPONENTS } from "./lesson-components";
import type { Lesson } from "./loader";
import type { TocEntry } from "./remark-lesson";

export interface RenderedLesson {
  readonly content: ReactElement;
  readonly toc: readonly TocEntry[];
}

/** Compiles MDX and renders it with the lesson components. `label` names it in errors. */
export async function renderLessonBody(body: string, label: string): Promise<RenderedLesson> {
  const { Content, toc } = await compileLessonBody(body, label);
  return { content: <Content components={LESSON_COMPONENTS} />, toc };
}

/** A lesson's body, ready to put on the page, with its table of contents. */
export function renderLesson(lesson: Lesson): Promise<RenderedLesson> {
  return renderLessonBody(lesson.body, `"${lesson.id}"`);
}
