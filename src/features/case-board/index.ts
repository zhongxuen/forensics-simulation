/**
 * The Case Board's public API (docs/plan/10-case-board-report-custody.md §Case Board). The case
 * workspace registers `CaseBoardPane` in its pane registry (`src/features/cases/workspace-panes.ts`)
 * and loads this module when the Board tab first opens, so nothing on a page's first download may
 * import it statically.
 */
export { CaseBoardPane } from "./components/case-board-pane";
export {
  boardCards,
  groupBySource,
  showsInEvidenceBrowser,
  sortByTime,
  terminalCommandFor,
  type BoardCard,
  type CardGroup,
  type CardSource,
} from "./model/cards";
