"use client";

import { lazy, Suspense } from "react";
import { LoadingPracticeComputer } from "@/components/shell/loading-practice-computer";
import type { SandboxWorkspaceProps } from "./sandbox-workspace";

/**
 * The sandbox without the terminal, the simulation engine or the evidence in the page's first
 * download (the 200 KB budget). The server renders the whole workspace, so nothing moves; its code
 * and the evidence arrive as the page hydrates, and it starts working then.
 */
const SandboxWorkspace = lazy(() =>
  import("./sandbox-workspace").then((module) => ({ default: module.SandboxWorkspace })),
);

export function LazySandboxWorkspace(props: SandboxWorkspaceProps) {
  return (
    <Suspense fallback={<LoadingPracticeComputer />}>
      <SandboxWorkspace {...props} />
    </Suspense>
  );
}
