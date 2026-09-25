"use client";

import { useEffect, useState } from "react";
import type { CaseRunSave } from "@/lib/case-storage";

type SavedRuns = Readonly<Record<string, CaseRunSave>>;

/**
 * The case runs saved in this browser, read through src/lib/case-storage's public API: `undefined`
 * until they've been read (the server can't see storage), then the runs. They're read again
 * whenever `key` changes (the shell passes the pathname), so leaving a case shows where it was
 * left. The storage module (and its schema) loads after the page, so it's never in a page's first
 * download.
 */
export function useSavedRuns(key: string): SavedRuns | undefined {
  const [runs, setRuns] = useState<SavedRuns | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void import("@/lib/case-storage").then(({ caseStorage }) => {
      if (live) setRuns(caseStorage.read().runs);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return runs;
}
