import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRACKS } from "@/content/tracks";
import { CHAPTER, findCaseListing } from "@/features/cases";
import {
  getLesson,
  getPrerequisiteGraph,
  inPracticeCaseId,
  LessonArticle,
  listLessons,
  renderLesson,
  type Lesson,
  type LessonPracticeCase,
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

/**
 * The released chapter case a lesson's "In practice" section names first, for the "Try it in
 * Case N" button at its foot.
 */
function practiceCase(lesson: Lesson): LessonPracticeCase | undefined {
  const id = inPracticeCaseId(lesson.body);
  if (id === undefined) return undefined;
  const index = CHAPTER.cases.indexOf(id);
  const listing = findCaseListing(id);
  if (index === -1 || !listing || CHAPTER.released[id] !== true) return undefined;
  return { href: `/cases/${id}`, number: index + 1, title: listing.title };
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
      practiceCase={practiceCase(lesson)}
    />
  );
}
