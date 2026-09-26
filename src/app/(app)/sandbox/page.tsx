import type { Metadata } from "next";
import { MINI_TERMINALS } from "@/content/mini-terminals";
import { TRACKS } from "@/content/tracks";
import { buildSandbox, loadSandbox, sandboxWorkstation } from "@/features/cases/server";
import { getLesson, type Lesson } from "@/features/learning/server";
import { getAppSection } from "@/lib/app-sections";
import { LazySandboxWorkspace } from "./lazy-sandbox-workspace";

export const metadata: Metadata = { title: getAppSection("sandbox").label };

/** The practice machines that carry evidence under /dev/evidence. */
const EVIDENCE_MACHINES = new Set(
  MINI_TERMINALS.filter((mini) => mini.evidence !== undefined).map((mini) => mini.id),
);

/**
 * For a player who wants a guide: the first lesson in each track whose practice terminal has
 * evidence attached (UIUX.md §2.8), in track order.
 */
function guidedLessons(): { readonly track: string; readonly lesson: Lesson }[] {
  return TRACKS.flatMap((track) => {
    const lesson = track.lessons
      .map(getLesson)
      .find(
        (candidate) =>
          candidate !== undefined &&
          [...candidate.body.matchAll(/<MiniTerminal\b[^>]*\bscenario="([^"]+)"/g)].some((match) =>
            EVIDENCE_MACHINES.has(match[1] ?? ""),
          ),
      );
    return lesson ? [{ track: track.title, lesson }] : [];
  });
}

/**
 * The sandbox (docs/plan/15-quality-and-launch.md, part B): the practice kit from
 * `src/content/cases/sandbox.yaml` on the analyst workstation, with no goals. The workstation is
 * built here, at build time, from the same story the evidence was generated from; the evidence
 * itself loads in the browser, on demand.
 */
export default function SandboxPage() {
  const sandbox = loadSandbox();
  const { scenario, seed, startsAt } = sandboxWorkstation(sandbox, buildSandbox(sandbox).evidence);

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <p className="type-eyebrow">Sandbox</p>
        <h1 className="mt-2 type-page-title">{sandbox.banner}</h1>
        <p className="mt-4 max-w-prose text-lg leading-8 text-secondary">{sandbox.summary}</p>
      </div>
      <LazySandboxWorkspace
        scenario={scenario}
        seed={seed}
        startsAt={startsAt}
        tryThis={sandbox.tryThis}
        guided={guidedLessons().map(({ track, lesson }) => ({
          track,
          title: lesson.title,
          href: `/learn/${lesson.id}`,
        }))}
      />
    </div>
  );
}
