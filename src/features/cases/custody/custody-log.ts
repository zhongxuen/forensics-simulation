import type { RunMark } from "@/lib/case-storage";
import type { SimEvent } from "@/sim/types";

/**
 * The chain of custody (docs/plan/10-case-board-report-custody.md §Chain of Custody): the running
 * record of what the examiner did to the evidence, in order. It is a **pure selector** over the
 * engine's event stream, never a store of its own: the same events always give the same record,
 * so replaying a saved log rebuilds it exactly.
 *
 * Two things the record needs aren't engine events — a pin made from a view (the terminal's `pin`
 * is one) and a report submission — so the run keeps them as `RunMark`s, each placed by how many
 * events came before it (`@/lib/case-storage`).
 */

/** The tools whose successful run counts as examining the evidence. */
const EXAMINING_TOOLS: ReadonlySet<string> = new Set([
  "lsfs",
  "inode",
  "recover",
  "carve",
  "strings",
  "logq",
  "mem",
  "timeline",
]);

/** Reads through these, with the blocker on, are part of their own entry (acquired, hashed). */
const FOLDED_READS: ReadonlySet<string> = new Set(["acquire", "hashsum"]);

/** The Evidence Browser's tool name on an original read (src/sim/tools/forensics/browse.ts). */
export const BROWSER_TOOL = "evidence-browser";

export type CustodyEntry = { readonly n: number } & (
  | {
      readonly kind: "acquired";
      readonly device: string;
      readonly image: string;
      readonly md5: string;
      readonly sha256: string;
    }
  | {
      readonly kind: "hashed";
      readonly target: string;
      readonly algorithm: string;
      readonly digest: string;
      /** Present when it was checked against an expected hash: whether it matched. */
      readonly verified?: boolean;
    }
  | {
      readonly kind: "original-read";
      readonly device: string;
      /** False: read around the write-blocker, which changed the drive. */
      readonly blocker: boolean;
      readonly tool: string;
    }
  | {
      readonly kind: "recovered";
      readonly image: string;
      readonly record: number;
      readonly path: string;
      readonly ref: string;
    }
  | {
      readonly kind: "carved";
      readonly image?: string;
      readonly ref?: string;
      readonly path?: string;
    }
  | {
      /** A tool that looks inside the evidence ran and worked: `lsfs`, `inode`, `strings`… */
      readonly kind: "examined";
      readonly tool: string;
      readonly line: string;
    }
  | {
      readonly kind: "pinned";
      readonly ref: string;
      readonly from: "terminal" | "view";
      readonly note?: string;
    }
  | {
      readonly kind: "submitted";
      readonly supported: number;
      readonly total: number;
    }
);

export type CustodyKind = CustodyEntry["kind"];

/** Every custody entry, oldest first, from the run's events and marks. */
export function custodyLog(
  events: readonly SimEvent[],
  marks: readonly RunMark[] = [],
): CustodyEntry[] {
  const log: CustodyEntry[] = [];
  const add = (entry: DistributiveOmit<CustodyEntry, "n">) =>
    log.push({ ...entry, n: log.length + 1 } as CustodyEntry);
  const pending = [...marks].sort((a, b) => a.after - b.after);
  let nextMark = 0;
  const flushMarks = (upTo: number) => {
    while (nextMark < pending.length && (pending[nextMark]?.after ?? 0) <= upTo) {
      const mark = pending[nextMark++] as RunMark;
      if (mark.kind === "pinned") add({ kind: "pinned", ref: mark.ref, from: "view" });
      else add({ kind: "submitted", supported: mark.supported, total: mark.total });
    }
  };

  // Tools that already have an entry since the last command finished: their `examined` line would
  // say the same thing twice.
  let recorded = new Set<string>();
  events.forEach((event, index) => {
    flushMarks(index);
    switch (event.type) {
      case "evidence.acquired":
        add({
          kind: "acquired",
          device: event.device,
          image: event.image,
          md5: event.md5,
          sha256: event.sha256,
        });
        break;
      case "evidence.hashed":
        add({
          kind: "hashed",
          target: event.target,
          algorithm: event.algorithm,
          digest: event.digest,
          ...(event.verified !== undefined && { verified: event.verified }),
        });
        break;
      case "evidence.readOriginal":
        recorded.add(event.tool);
        if (event.blocker && FOLDED_READS.has(event.tool)) break;
        add({
          kind: "original-read",
          device: event.device,
          blocker: event.blocker,
          tool: event.tool,
        });
        break;
      case "evidence.recovered":
        recorded.add("recover");
        add({
          kind: "recovered",
          image: event.image,
          record: event.record,
          path: event.path,
          ref: event.ref,
        });
        break;
      case "board.pinned":
        add({
          kind: "pinned",
          ref: event.ref,
          from: "terminal",
          ...(event.note !== undefined && { note: event.note }),
        });
        break;
      case "command.run":
        if (
          event.exitCode === 0 &&
          EXAMINING_TOOLS.has(event.command) &&
          !recorded.has(event.command)
        ) {
          add({ kind: "examined", tool: event.command, line: event.line });
        }
        recorded = new Set();
        break;
      default:
        // File 07's carver reports what it found as `evidence.carved`. Read it by shape, so this
        // selector doesn't depend on the order the two land in.
        if ((event.type as string) === "evidence.carved") {
          recorded.add("carve");
          const carved = event as unknown as Readonly<Record<string, unknown>>;
          add({
            kind: "carved",
            ...(typeof carved.image === "string" && { image: carved.image }),
            ...(typeof carved.ref === "string" && { ref: carved.ref }),
            ...(typeof carved.path === "string" && { path: carved.path }),
          });
        }
    }
  });
  flushMarks(Number.POSITIVE_INFINITY);
  return log;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Entries that open the evidence up: anything after one of these isn't "before analysing". */
export function isAnalysis(entry: CustodyEntry): boolean {
  switch (entry.kind) {
    case "original-read":
    case "recovered":
    case "carved":
    case "examined":
    case "pinned":
      return true;
    default:
      return false;
  }
}

/**
 * The "hashed before analysing" bonus (docs/plan/06 §Bonus): a hash was taken before anything
 * opened the evidence, and if it was checked, it matched. An original read around the blocker
 * counts as opening it, even by `hashsum` itself, because that read is what changes the drive.
 */
export function hashedBeforeAnalysing(log: readonly CustodyEntry[]): boolean {
  for (const entry of log) {
    if (isAnalysis(entry)) return false;
    if (entry.kind === "hashed" && entry.verified !== false) return true;
  }
  return false;
}

/** The custody rules a case's objective can check (`CUSTODY_RULES` in the case schema). */
export type CustodyRule = "hashed-before-analysing";

export function custodyRuleHolds(rule: CustodyRule, log: readonly CustodyEntry[]): boolean {
  switch (rule) {
    case "hashed-before-analysing":
      return hashedBeforeAnalysing(log);
  }
}
