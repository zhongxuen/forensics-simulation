/**
 * The Evidence Browser's public API (docs/plan/05-workspace-ui.md §Evidence Browser). The case
 * workspace loads it on demand, when the Evidence pane first opens; nothing on a page's first
 * download may import it statically.
 */
export { EvidenceBrowser } from "./components/evidence-browser";
export { BROWSER_TABS, type BrowserTab, type EvidenceBrowserProps } from "./browser-tabs";
export {
  hexRow,
  hexRowCount,
  textContent,
  BYTES_PER_ROW,
  type HexRow,
  type TextContent,
} from "./model/bytes";
export {
  DEFAULT_SORT,
  filtering,
  matches,
  NO_FILTER,
  showTime,
  sortRecords,
  tableRows,
  wallTimeToInstant,
  type ColumnKey,
  type RecordFilter,
  type SortOrder,
  type TimeField,
} from "./model/table";
export {
  buildTree,
  filePartition,
  flatten,
  visibleNodes,
  type ImageNode,
  type OpenedImage,
  type TreeNode,
} from "./model/tree";
