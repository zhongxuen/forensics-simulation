import type { Metadata } from "next";
import { CHAPTER, CaseList, caseSummaries } from "@/features/cases";
import { getCase } from "@/features/cases/server";
import { getAppSection } from "@/lib/app-sections";

export const metadata: Metadata = { title: getAppSection("cases").label };

/** How every case goes, in four short steps under the chapter's lede. */
const HOW_A_CASE_WORKS = [
  "A client asks for help and signs a letter saying what you may examine.",
  "You look at a disk, a memory dump and logs in a simulated terminal.",
  "You pin what you find to a case board.",
  "You write a report where every answer points at a pin.",
];

/**
 * The case list: the chapter's cases in its own order (a case not released yet, per `released`
 * in src/content/cases/chapter.ts, stays on the list without a button), then the practice case in
 * its own row. Each case's state comes from the run saved in this browser.
 */
export default function CasesPage() {
  return (
    <div className="space-y-12">
      <div className="max-w-3xl">
        <p className="type-eyebrow">{CHAPTER.client}</p>
        <h1 className="mt-2 type-page-title">{CHAPTER.title}</h1>
        <p className="mt-4 max-w-prose text-lg leading-8 text-secondary">{CHAPTER.opening}</p>
        <h2 className="mt-8 type-eyebrow">How a case works</h2>
        <ol className="mt-3 max-w-prose space-y-2">
          {HOW_A_CASE_WORKS.map((step, index) => (
            <li key={step} className="flex gap-3 type-body text-secondary">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-accent/40 bg-accent-subtle text-xs font-semibold text-accent"
              >
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-4 type-small text-muted">
          Your work on each case is saved in this browser only.
        </p>
      </div>
      <CaseList summaries={caseSummaries(getCase)} />
    </div>
  );
}
