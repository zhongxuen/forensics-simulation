import type { Metadata } from "next";
import { CASE_LISTINGS, CaseList } from "@/features/cases";
import { getAppSection } from "@/lib/app-sections";

export const metadata: Metadata = { title: getAppSection("cases").label };

/** The case list. */
export default function CasesPage() {
  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Your cases
        </h1>
        <p className="mt-4 text-lg leading-8 text-secondary">
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
