import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  CUSTODY_LABELS,
  describeCustody,
  type CustodyEntry,
  type CustodyKind,
} from "../../custody";

const TONE: Readonly<Record<CustodyKind, BadgeTone>> = {
  acquired: "info",
  hashed: "info",
  "original-read": "neutral",
  recovered: "accent",
  carved: "accent",
  examined: "neutral",
  pinned: "reward",
  submitted: "success",
};

/** An entry the player should notice: a read that changed the drive, or a hash that didn't match. */
const warns = (entry: CustodyEntry) =>
  (entry.kind === "original-read" && !entry.blocker) ||
  (entry.kind === "hashed" && entry.verified === false);

interface CustodyListProps {
  log: readonly CustodyEntry[];
  /** A heading level for the empty state's title. */
  emptyTitleAs?: "h3" | "h4";
}

/**
 * The chain of custody as a list, oldest first: the Objectives pane's sub-tab during the case,
 * and the debrief's full record. Built by `custodyLog` from the engine's events, so it always
 * says what the engine saw.
 */
export function CustodyList({ log, emptyTitleAs: Title = "h4" }: CustodyListProps) {
  if (log.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-strong px-4 py-6 text-center">
        <Title className="font-semibold">Your chain of custody will be here</Title>
        <p className="mt-1 text-sm leading-6 text-secondary">
          Nothing has been done to the evidence yet. Every copy, hash, read and pin will be listed
          here in the order you did it, so the next person can see the evidence was handled with
          care.
        </p>
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {log.map((entry) => (
        <li
          key={entry.n}
          className={
            warns(entry)
              ? "rounded-md border border-l-4 border-subtle border-l-status-warning bg-surface-raised px-3 py-2"
              : "rounded-md border border-subtle bg-surface-raised px-3 py-2"
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">{entry.n}.</span>
            <Badge tone={warns(entry) ? "warning" : TONE[entry.kind]}>
              {CUSTODY_LABELS[entry.kind]}
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-6 break-words">{describeCustody(entry)}</p>
        </li>
      ))}
    </ol>
  );
}
