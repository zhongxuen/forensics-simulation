/**
 * Saved case runs: the second thing the app keeps between visits (after settings), and with
 * src/lib/settings/ the only code allowed to touch browser storage
 * (tests/unit/storage-guard.test.ts). See README.md in this folder.
 */
export {
  CASE_STORE_VERSION,
  CaseRunSaveSchema,
  EMPTY_CASE_STORE,
  HINT_TIERS,
  LogEntrySchema,
  MAX_DRAFT_LENGTH,
  MAX_LINE_LENGTH,
  MAX_LOG_ENTRIES,
  MAX_NOTES_LENGTH,
  MAX_PINS,
  migrate,
  migrateWithReport,
  type CaseRunSave,
  type CaseStore,
  type LogEntry,
  type MigrateReport,
} from "./schema";
export {
  CASES_STORAGE_KEY,
  caseStorage,
  createCaseStorage,
  type CaseStorage,
  type CaseStorageOptions,
  type ImportResult,
  type SaveStatus,
} from "./store";
