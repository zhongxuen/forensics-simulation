// Fixture for tests/unit/storage-guard.test.ts: localStorage, sessionStorage, indexedDB and
// document.cookie are only mentioned here, in comments and strings. The guard must not flag it.
/* Never call localStorage.setItem outside src/lib/settings. */
export const NOTE = "Settings live in localStorage; progress is never saved to document.cookie.";
export const storageKind = "sessionStorage";
