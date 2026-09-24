import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { CASE_LISTINGS, CaseRunner, findCaseListing } from "@/features/cases";
import { getRunnableCase } from "@/features/cases/server";

// Every case page is built ahead of time. Any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return CASE_LISTINGS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/cases/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const listing = findCaseListing(slug);
  return listing ? { title: listing.title } : {};
}

/**
 * One case: briefing, workspace, report and debrief, all in the case runner. The briefing is
 * rendered here on the server; the workstation and everything after Start case load on demand.
 * A playable case file is turned into the runner's shape here, at build time. A case still being
 * written gets a placeholder.
 */
export default async function CasePage({ params }: PageProps<"/cases/[slug]">) {
  const { slug } = await params;
  const listing = findCaseListing(slug);
  if (!listing) notFound();

  const caseDef =
    listing.caseDef ?? (listing.status === "playable" ? getRunnableCase(slug) : undefined);
  if (!caseDef) {
    return (
      <SectionPlaceholder
        headline={listing.title}
        status={
          listing.status === "written"
            ? "This case is written, and the workspace that runs it is being finished. It needs the case board to pin evidence to and the report that points at it, and both arrive in the next update."
            : "This case is still being written. It arrives in a later update."
        }
        nextStep={{
          href: "/cases/practice",
          title: "Try the practice case",
          detail: "Five minutes, and a feel for the workspace",
        }}
      >
        <p>{listing.summary}</p>
      </SectionPlaceholder>
    );
  }

  return <CaseRunner caseDef={caseDef} />;
}
