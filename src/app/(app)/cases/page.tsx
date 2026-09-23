import type { Metadata } from "next";
import { CASE_LISTINGS, CHAPTER, CaseList } from "@/features/cases";
import { getAppSection } from "@/lib/app-sections";

export const metadata: Metadata = { title: getAppSection("cases").label };

/** The case list: the chapter in its own order, then the practice case. */
export default function CasesPage() {
  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <p className="text-sm font-medium tracking-wide text-secondary uppercase">
          {CHAPTER.client}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {CHAPTER.title}
        </h1>
        <p className="mt-4 text-lg leading-8 text-secondary">{CHAPTER.opening}</p>
        <p className="mt-4 text-base leading-7 text-secondary">
          Each case starts with a client who asked for help and signed a letter saying what you may
          examine. You&apos;ll look at a disk, a memory dump and logs, pin what you find to a case
          board, and write a report that points at the evidence. Your work on each case is saved in
          this browser only.
        </p>
      </div>
      <CaseList listings={CASE_LISTINGS} />
    </div>
  );
}
