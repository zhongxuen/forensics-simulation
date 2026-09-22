import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { getAppSection } from "@/lib/app-sections";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = { title: getAppSection("cases").label };

/** The case list (placeholder until file 05). */
export default function CasesPage() {
  return (
    <SectionPlaceholder headline="Your cases" nextStep={FIRST_STEP}>
      <p>
        Each case starts with a client who asked for help and signed a letter saying what you may
        examine. You&apos;ll look at a disk, a memory dump and logs, pin what you find to a case
        board, and write a report that points at the evidence.
      </p>
    </SectionPlaceholder>
  );
}
