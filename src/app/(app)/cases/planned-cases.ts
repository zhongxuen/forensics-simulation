/**
 * The three v1 cases, by id, until file 03 adds the case loader. Their placeholder pages are built
 * ahead of time from this list, so any other slug is a 404. File 05 replaces this with the loader.
 */
export const PLANNED_CASES = [
  { slug: "case-01", title: "The clean copy" },
  { slug: "case-02", title: "The deleted invoice" },
  { slug: "case-03", title: "Something is still running" },
] as const;
