/**
 * SimState to text and back. The format is versioned and byte-stable (sorted keys), so a snapshot
 * is a diffable, shareable JSON blob: the same state always serializes to the same bytes.
 */
import { freezeInDev } from "./freeze";
import { err, ok, type Result } from "./result";
import { stableStringify } from "./stable-json";
import type { SimState } from "./types";
import { validateState } from "./validate";

export const STATE_FORMAT = "hacker-sim/state";
export const STATE_VERSION = 1;

/** Snapshots bigger than this are refused rather than parsed. */
export const MAX_SNAPSHOT_BYTES = 5_000_000;

export interface SnapshotError {
  readonly code: "BAD_SNAPSHOT";
  readonly reason: string;
}

export function serializeState(
  state: SimState,
  options: { readonly pretty?: boolean } = {},
): string {
  return stableStringify(
    { format: STATE_FORMAT, version: STATE_VERSION, state },
    options.pretty ? 2 : 0,
  );
}

export function deserializeState(text: string): Result<SimState, SnapshotError> {
  const envelope = parseEnvelope(text, STATE_FORMAT, STATE_VERSION);
  if (!envelope.ok) return envelope;
  const checked = validateState(envelope.value.state);
  if (!checked.ok) return err({ code: "BAD_SNAPSHOT", reason: checked.reason });
  return ok(freezeInDev(checked.state));
}

/** Parses `{ format, version, ... }` JSON, checking the format name and version. */
export function parseEnvelope(
  text: string,
  format: string,
  version: number,
): Result<Record<string, unknown>, SnapshotError> {
  const bad = (reason: string) => err<SnapshotError>({ code: "BAD_SNAPSHOT", reason });
  if (text.length > MAX_SNAPSHOT_BYTES) return bad(`larger than ${MAX_SNAPSHOT_BYTES} characters`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return bad("not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return bad("not a JSON object");
  const envelope = parsed as Record<string, unknown>;
  if (envelope.format !== format) return bad(`format should be "${format}"`);
  if (envelope.version !== version) {
    return bad(`version ${String(envelope.version)} is not supported (expected ${version})`);
  }
  return ok(envelope);
}
