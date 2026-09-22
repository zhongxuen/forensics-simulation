// Fixture for tests/unit/storage-guard.test.ts: the browser's other places to keep data (phase 11
// widened the guard to cover them). The guard must flag every one.
export async function otherStorage() {
  const cache = await caches.open("pages");
  const folder = await navigator.storage.getDirectory();
  const worker = window.navigator["serviceWorker"];
  const { openDatabase } = window as unknown as { openDatabase: () => void };
  return [cache, folder, worker, openDatabase];
}
