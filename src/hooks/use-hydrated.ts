"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/**
 * False while the page is server-rendered HTML (and during hydration), true once React has taken
 * over in the browser. For controls that are drawn by the server but only work once their code has
 * run: a terminal whose code arrives after the page (md-files/11-testing-security-deployment.md,
 * prompt 11.3) stays read-only until then, so nothing a quick typist enters is lost.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}
