import { GLOSSARY } from "@/content/glossary";
import { LESSON_LEVEL_LABELS, LESSON_TOPICS } from "@/content/topics";
import type { SearchEntry, SearchIndex } from "@/lib/search";
import { defaultRegistry, listTools, TOOL_CATEGORY_LABELS } from "@/sim";
import { listLessons, type Lesson } from "../lessons/loader";

/**
 * The search index (md-files/09-learning-center.md, prompt 09.5): every lesson, glossary word and
 * command manual page as a small entry, built once at build time from the content itself and
 * served as a static file (src/app/search-index.json). Server only: it reads the lesson files.
 *
 * Kept small on purpose: titles, one-line summaries and a few keywords, not whole lessons.
 */

/** The prose of a lesson's section headings, which make good keywords. */
function headings(body: string): string[] {
  return [...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) =>
    (match[1] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/[`*_]/g, "")
      .trim(),
  );
}

function lessonEntry(lesson: Lesson): SearchEntry {
  return {
    id: `lesson:${lesson.id}`,
    kind: "lesson",
    title: lesson.title,
    summary: lesson.summary ?? lesson.analogy ?? "",
    href: `/learn/${lesson.id}`,
    keywords: [
      LESSON_TOPICS[lesson.topic].label,
      LESSON_LEVEL_LABELS[lesson.level],
      ...lesson.glossaryTerms.map((id) => id.replace(/-/g, " ")),
      ...lesson.relatedCommands,
      ...headings(lesson.body).filter(
        (heading) =>
          !/^(The one-sentence version|Why it matters|How it actually works|See it|Try it|In practice|Common misconceptions)/.test(
            heading,
          ),
      ),
    ],
    commands: lesson.relatedCommands,
    missions: lesson.relatedMissions,
    terms: lesson.glossaryTerms,
  };
}

/** The first sentences of a manual page's description: enough words to find a command by. */
function describe(paragraphs: readonly string[], max = 280): string {
  const text = paragraphs.join(" ");
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
}

export function buildSearchIndex(lessons: readonly Lesson[] = listLessons()): SearchIndex {
  const entries: SearchEntry[] = [
    ...lessons.map(lessonEntry),
    ...GLOSSARY.map((entry): SearchEntry => ({
      id: `term:${entry.id}`,
      kind: "term",
      title: entry.term,
      summary: entry.short,
      href: `/learn/glossary#${entry.id}`,
      keywords: [...entry.aka, LESSON_TOPICS[entry.topic].label],
    })),
    ...listTools().map((tool): SearchEntry => {
      const help = defaultRegistry.get(tool.name)?.help;
      return {
        id: `command:${tool.name}`,
        kind: "command",
        title: tool.name,
        // One-liners are written to follow "ls - ": capitalised here to stand on their own.
        summary: tool.summary.charAt(0).toUpperCase() + tool.summary.slice(1),
        href: `/learn/commands#${tool.name}`,
        keywords: [
          TOOL_CATEGORY_LABELS[tool.category],
          "command",
          ...(help ? [describe(help.description)] : []),
        ],
      };
    }),
  ];
  return { version: 1, entries };
}
