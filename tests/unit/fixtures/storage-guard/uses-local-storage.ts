// Fixture for tests/unit/storage-guard.test.ts: a file that saves progress in browser storage.
// The guard must flag it.
export function saveProgress(missionId: string) {
  localStorage.setItem("progress", missionId);
}
