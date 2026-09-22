"use client";

import { useEffect, useState } from "react";
import { isSearchIndex, SEARCH_INDEX_PATH, type SearchEntry } from "@/lib/search";

export type SearchIndexStatus =
  | { readonly state: "idle" | "loading" | "failed" }
  | { readonly state: "ready"; readonly entries: readonly SearchEntry[] };

/**
 * One fetch of the search index per page load, shared by every caller. It's a static file built
 * with the app, held in memory like any other page asset and never written to storage.
 */
let pending: Promise<readonly SearchEntry[]> | undefined;

function loadSearchIndex(): Promise<readonly SearchEntry[]> {
  pending ??= fetch(SEARCH_INDEX_PATH)
    .then((response) =>
      response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)),
    )
    .then((data: unknown) => {
      if (!isSearchIndex(data)) throw new Error("The search index isn't in the expected shape.");
      return data.entries;
    })
    .catch((error: unknown) => {
      // Let the next page that asks try again, after a network blip.
      pending = undefined;
      throw error;
    });
  return pending;
}

/**
 * The lessons, glossary words and command manual pages to search. Loads when `enabled` first turns
 * true (the palette or the reference drawer opening), so pages that never search never fetch it.
 */
export function useSearchIndex(enabled: boolean): SearchIndexStatus {
  const [result, setResult] = useState<readonly SearchEntry[] | "failed" | null>(null);

  useEffect(() => {
    if (!enabled || result !== null) return;
    let cancelled = false;
    loadSearchIndex().then(
      (entries) => {
        if (!cancelled) setResult(entries);
      },
      () => {
        if (!cancelled) setResult("failed");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, result]);

  if (result === "failed") return { state: "failed" };
  if (result !== null) return { state: "ready", entries: result };
  return { state: enabled ? "loading" : "idle" };
}
