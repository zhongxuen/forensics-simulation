"use client";

import { lazy, Suspense } from "react";
import { LoadingPracticeComputer } from "@/components/shell/loading-practice-computer";

/**
 * The sandbox without the terminal and the simulation engine in the page's first download (the
 * 200 KB budget). The server renders the whole workspace, so nothing moves; its code arrives as
 * the page hydrates, and it starts working then.
 */
const SandboxWorkspace = lazy(() =>
  import("./sandbox-workspace").then((module) => ({ default: module.SandboxWorkspace })),
);

export function LazySandboxWorkspace() {
  return (
    <Suspense fallback={<LoadingPracticeComputer />}>
      <SandboxWorkspace />
    </Suspense>
  );
}
