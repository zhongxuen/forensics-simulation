/**
 * The case feature's server-only API: reading case files from `src/content/cases`, playing their
 * stories, and resolving their answer keys. It reads files with Node's fs and runs the generator,
 * so import it only from server components, route handlers, build-time functions like
 * `generateStaticParams`, scripts and tests. Client code uses `@/features/cases`.
 */
export {
  buildCaseCatalog,
  CASES_DIR,
  getCase,
  getCaseCatalog,
  isFixtureCase,
  listCases,
  loadCaseCatalog,
  type CaseCatalog,
} from "./loader/catalog";
export {
  buildCase,
  CASE_FILE_EXTENSION,
  CaseSourceError,
  FIXTURE_PREFIX,
  parseCaseSource,
  type BuiltCase,
  type CaseFile,
} from "./loader/source";
export { toCaseSpec } from "./loader/spec";
