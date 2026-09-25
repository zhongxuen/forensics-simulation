import type { Metadata } from "next";
import Link from "next/link";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { GLOSSARY } from "@/content/glossary";
import { GlossaryBrowser } from "@/features/learning";
import { listLessons } from "@/features/learning/server";
import { cx } from "@/lib/cx";

export const metadata: Metadata = {
  title: "Glossary",
  description: "Every forensics and security word in Incident Room, in plain language.",
};

/** Every glossary word on one page: where <Term> and search results for a word land. */
export default function GlossaryPage() {
  const lessonTitles = Object.fromEntries(listLessons().map((lesson) => [lesson.id, lesson.title]));

  return (
    <div className="mx-auto max-w-3xl">
      <p className="type-small text-secondary">
        <Link
          href="/learn"
          className={cx("rounded-sm font-medium text-accent hover:underline", FOCUS_RING)}
        >
          Learn
        </Link>
        <span aria-hidden="true"> / </span>
        Glossary
      </p>
      <h1 className="mt-3 type-page-title">Every word, in plain language</h1>
      <p className="mt-4 max-w-prose text-lg leading-8 text-secondary">
        Investigations have a lot of jargon. Each word here gets one sentence you can read without
        knowing any other jargon, then a little more detail. Wherever you see a word with a dotted
        underline, hover over it or tap it to see its definition without leaving the page.
      </p>

      <div className="mt-8">
        <GlossaryBrowser entries={GLOSSARY} lessonTitles={lessonTitles} />
      </div>
    </div>
  );
}
