import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRACKS } from "@/content/tracks";
import {
  getLesson,
  getPrerequisiteGraph,
  LessonArticle,
  listLessons,
  renderLesson,
  type Lesson,
  type LessonTrackPosition,
} from "@/features/learning/server";

// Every lesson is built ahead of time. Any other id is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return listLessons().map((lesson) => ({ lessonId: lesson.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/learn/[lessonId]">): Promise<Metadata> {
  const lesson = getLesson((await params).lessonId);
  return lesson ? { title: lesson.title, description: lesson.summary ?? lesson.analogy } : {};
}

const resolve = (ids: readonly string[]): Lesson[] =>
  ids.map(getLesson).filter((lesson) => lesson !== undefined);

/** Where a lesson sits in the first track that includes it, if any. */
function trackPosition(id: string): LessonTrackPosition | undefined {
  const track = TRACKS.find((candidate) => candidate.lessons.includes(id));
  if (!track) return undefined;
  const index = track.lessons.indexOf(id);
  const at = (offset: number) => {
    const neighbour = track.lessons[index + offset];
    return neighbour === undefined ? undefined : getLesson(neighbour);
  };
  const previous = at(-1);
  const next = at(1);
  return {
    title: track.title,
    position: index + 1,
    total: track.lessons.length,
    ...(previous && { previous }),
    ...(next && { next }),
  };
}

export default async function LessonPage({ params }: PageProps<"/learn/[lessonId]">) {
  const lesson = getLesson((await params).lessonId);
  if (!lesson) notFound();

  const graph = getPrerequisiteGraph();
  const { content, toc } = await renderLesson(lesson);

  return (
    <LessonArticle
      lesson={lesson}
      content={content}
      toc={toc}
      prerequisites={resolve(graph.prerequisitesOf(lesson.id))}
      readNext={resolve(graph.dependentsOf(lesson.id))}
      track={trackPosition(lesson.id)}
    />
  );
}
