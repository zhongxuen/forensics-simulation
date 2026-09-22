import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { PLANNED_CASES } from "../planned-cases";

// Every case page is built ahead of time. Any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return PLANNED_CASES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/cases/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const planned = PLANNED_CASES.find((candidate) => candidate.slug === slug);
  return planned ? { title: planned.title } : {};
}

/** One case: briefing, workspace and debrief (placeholder until files 05 and 06). */
export default async function CasePage({ params }: PageProps<"/cases/[slug]">) {
  const { slug } = await params;
  const planned = PLANNED_CASES.find((candidate) => candidate.slug === slug);
  if (!planned) notFound();

  return (
    <SectionPlaceholder headline={planned.title}>
      <p>
        This is where the case will open: the briefing and the signed letter first, then your
        workstation with the evidence beside it.
      </p>
    </SectionPlaceholder>
  );
}
