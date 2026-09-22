/**
 * The Learning Center's public API for client and server code alike. Loading and compiling lessons
 * reads files, so it lives in `@/features/learning/server`.
 */
export { GlossaryBrowser } from "./glossary/glossary-browser";
export { GlossaryText } from "./glossary/glossary-text";
export { Term } from "./glossary/term";
export type { TocEntry } from "./lessons/remark-lesson";
export { ManPage, hasManPage, manPageSummary } from "./reference/man-page";
export { ReferenceDrawer, type ReferenceDrawerProps } from "./reference/reference-drawer";
export {
  commandOf,
  referenceSuggestions,
  type ReferenceContext,
  type ReferenceSuggestions,
} from "./reference/suggest";
