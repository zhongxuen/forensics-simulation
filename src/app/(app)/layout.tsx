import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { caseSummaries } from "@/features/cases";
import { getCase } from "@/features/cases/server";
import { listLessons } from "@/features/learning/server";
import type { NextStepCase } from "@/lib/next-step-from-runs";

export const metadata: Metadata = {
  title: {
    template: "%s – Candlewright: Incident Room",
    default: "Candlewright: Incident Room",
  },
};

/** The chapter's released cases, in order: what "Start here" and "Continue Case 1" choose from. */
function releasedChapter(): NextStepCase[] {
  return caseSummaries(getCase).flatMap(({ id, number, title, objectives, released }) =>
    number !== undefined && released ? [{ id, number, title, objectives }] : [],
  );
}

/** Each page inside a section, by pathname, with the title the breadcrumb shows. */
function pageTitles(): Record<string, string> {
  return Object.fromEntries([
    ...caseSummaries(getCase).map(({ id, title }) => [`/cases/${id}`, title]),
    ...listLessons().map(({ id, title }) => [`/learn/${id}`, title]),
    ["/learn/glossary", "Glossary"],
    ["/learn/commands", "Command manual"],
  ]);
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell chapter={releasedChapter()} pageTitles={pageTitles()}>
      {children}
    </AppShell>
  );
}
