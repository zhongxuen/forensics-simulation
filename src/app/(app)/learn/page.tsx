import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { getAppSection } from "@/lib/app-sections";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = { title: getAppSection("learn").label };

/** The Learning Center (placeholder until file 13). */
export default function LearnPage() {
  return (
    <SectionPlaceholder headline="Every idea, explained in plain words" nextStep={FIRST_STEP}>
      <p>
        Short lessons on how investigators work: why you copy a disk before you look at it, what a
        hash proves, how to read a timeline, and what a computer&apos;s memory can tell you.
      </p>
    </SectionPlaceholder>
  );
}
