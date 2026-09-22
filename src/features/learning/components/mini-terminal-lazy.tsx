"use client";

import { lazy, Suspense } from "react";
import type { MiniTerminalProps } from "@/content/schemas/lesson-components";

/**
 * `<MiniTerminal>` without the terminal and the simulation engine in the lesson's first download
 * (md-files/11-testing-security-deployment.md, prompt 11.3). The server still renders the whole
 * terminal, so the page looks the same and nothing moves; the browser fetches the terminal's code
 * as the page hydrates, and the terminal starts working when it arrives. A lesson with no practice
 * terminal never fetches it at all.
 */
const MiniTerminalView = lazy(() =>
  import("./mini-terminal").then((module) => ({ default: module.MiniTerminalView })),
);

export function LazyMiniTerminal(props: MiniTerminalProps) {
  return (
    <Suspense fallback={<LoadingTerminal />}>
      <MiniTerminalView {...props} />
    </Suspense>
  );
}

/** Shown only when a lesson is opened from a link inside the app, until the terminal arrives. */
function LoadingTerminal() {
  return (
    <figure className="mt-8">
      <figcaption className="mb-3 text-sm font-semibold text-accent">
        Try it in a practice terminal
      </figcaption>
      <div
        role="status"
        className="flex h-72 items-center justify-center rounded-xl border border-subtle bg-term-bg text-sm text-term-dim"
      >
        Starting the practice terminal…
      </div>
    </figure>
  );
}
