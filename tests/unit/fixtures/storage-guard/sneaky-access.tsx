// Fixture for tests/unit/storage-guard.test.ts: storage reached in roundabout ways.
// The guard must flag every one.
export function sneaky() {
  const session = window.sessionStorage;
  const local = globalThis["localStorage"];
  const { indexedDB } = self;
  document.cookie = "seen=1";
  const cookies = window.document["cookie"];
  return [session, local, indexedDB, cookies];
}
