import type { Metadata } from "next";
import { buildSandbox, loadSandbox, sandboxWorkstation } from "@/features/cases/server";
import { getAppSection } from "@/lib/app-sections";
import { LazySandboxWorkspace } from "./lazy-sandbox-workspace";

export const metadata: Metadata = { title: getAppSection("sandbox").label };

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
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {sandbox.banner}
        </h1>
        <p className="mt-4 text-lg leading-8 text-secondary">{sandbox.summary}</p>
      </div>
      <LazySandboxWorkspace
        scenario={scenario}
        seed={seed}
        startsAt={startsAt}
        tryThis={sandbox.tryThis}
      />
    </div>
  );
}
