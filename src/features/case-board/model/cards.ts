import { baseName, browsableImages, formatInstant, parseRef, renderLog, resolveRef } from "@/sim";
import type { EvidenceSet, SimEvent, SimState, ZonedSource } from "@/sim/types";

/**
 * The case board's cards (docs/plan/10-case-board-report-custody.md §Case Board), as pure data:
 * one per pin, with where it came from, its time, the output line or row it was pinned from, the
 * ref, and the player's note. The pane draws these; nothing here touches React.
 */

export type CardSource = "disk" | "memory" | "log";

export interface BoardCard {
  readonly ref: string;
  readonly source: CardSource;
  /** What groups cards when grouped by source: one drive, one memory capture, one log. */
  readonly group: string;
  /** How that group is headed: "Disk qf-lt-03", "security log". */
  readonly groupLabel: string;
  /** The artefact in a few words: a file's path, "security record 57", a process name. */
  readonly title: string;
  /** The output line it was pinned from, or the row that describes it. */
  readonly line: string;
  /** The instant the card is sorted by, if the artefact has one. */
  readonly at?: number;
  /** What that instant is: "Born", "Logged", "Started". */
  readonly timeLabel?: string;
  /** The time in UTC, the way the tools print it. */
  readonly utc?: string;
  /** The same time on the source's own clock, only when it reads differently. */
  readonly local?: string;
  readonly note: string;
  /** Position on the board: 0 for the oldest pin. */
  readonly order: number;
  /** False when the ref names nothing in this case's evidence (an old or hand-edited save). */
  readonly found: boolean;
}

const SOURCE_ORDER: Readonly<Record<CardSource, number>> = { disk: 0, memory: 1, log: 2 };

/**
 * A card for every pin, in pin order. `events` supplies the line each terminal pin came from (the
 * latest `board.pinned` for the ref); a pin from a view gets a line built from the evidence.
 */
export function boardCards(
  pins: readonly string[],
  events: readonly SimEvent[],
  evidence: EvidenceSet | null,
  notes: Readonly<Record<string, string>>,
): BoardCard[] {
  const lines = new Map<string, string>();
  for (const event of events) if (event.type === "board.pinned") lines.set(event.ref, event.line);
  return pins.map((ref, order) => card(ref, order, lines.get(ref), evidence, notes[ref] ?? ""));
}

function card(
  ref: string,
  order: number,
  pinnedLine: string | undefined,
  evidence: EvidenceSet | null,
  note: string,
): BoardCard {
  const parsed = parseRef(ref);
  const source: CardSource =
    parsed?.kind === "log"
      ? "log"
      : parsed && ["process", "connection", "region"].includes(parsed.kind)
        ? "memory"
        : "disk";
  const group =
    parsed?.kind === "log" ? `log:${parsed.source}` : `${source}:${parsed?.image ?? ""}`;
  const groupLabel =
    parsed?.kind === "log"
      ? `${parsed.source} log`
      : `${source === "memory" ? "Memory" : "Disk"} ${parsed?.image ?? ref}`;
  const base = { ref, source, group, groupLabel, order, note };
  const resolved = evidence ? resolveRef(evidence, ref) : undefined;
  if (!resolved || !evidence) {
    return { ...base, title: ref, line: pinnedLine ?? ref, found: false };
  }

  const timed = (at: number, timeLabel: string, zoned?: ZonedSource) => {
    const utc = formatInstant(at);
    const zone = zoned ? evidence.zones[zoned] : undefined;
    const local = zone ? formatInstant(at, { zone }) : undefined;
    return { at, timeLabel, utc, ...(local && local !== utc && { local }) };
  };

  switch (resolved.kind) {
    case "file": {
      const { file } = resolved;
      return {
        ...base,
        title: file.path,
        line:
          pinnedLine ??
          `record ${file.record} · ${file.kind === "dir" ? "folder" : `${file.size} bytes`}${file.deleted ? " · deleted" : ""} · owner ${file.owner}`,
        ...timed(file.times.b, "Born", "disk"),
        found: true,
      };
    }
    case "carve":
      return {
        ...base,
        title: `Carved from ${resolved.disk.id} at offset ${resolved.offset}`,
        line: pinnedLine ?? `unallocated space, offset ${resolved.offset}`,
        found: true,
      };
    case "process": {
      const { process } = resolved;
      return {
        ...base,
        title: `${process.name} (pid ${process.pid})`,
        line: pinnedLine ?? process.cmdline,
        ...timed(process.createdAt, "Started"),
        found: true,
      };
    }
    case "connection": {
      const { connection } = resolved;
      return {
        ...base,
        title: `${connection.proto} ${connection.local} → ${connection.remote}`,
        line: pinnedLine ?? `${connection.state}, pid ${connection.pid}`,
        ...timed(connection.createdAt, "Opened"),
        found: true,
      };
    }
    case "region": {
      const { region } = resolved;
      return {
        ...base,
        title: `Memory region at 0x${region.base.toString(16)} (pid ${region.pid})`,
        line:
          pinnedLine ??
          `${region.protection}, ${region.size} bytes${region.backedBy ? `, ${baseName(region.backedBy)}` : ", backed by nothing on disk"}`,
        found: true,
      };
    }
    case "log": {
      const { record } = resolved;
      return {
        ...base,
        title: `${record.source} record ${record.seq}${record.eventId !== undefined ? `, event ${record.eventId}` : ""}`,
        line:
          pinnedLine ??
          renderLog(record)
            .slice(0, 2)
            .map((text) => text.trim())
            .join(" · "),
        ...timed(record.at, "Logged", record.source),
        found: true,
      };
    }
  }
}

/** Oldest first; cards without a time after the rest, in pin order. */
export function sortByTime(cards: readonly BoardCard[]): BoardCard[] {
  return [...cards].sort((x, y) => {
    if (x.at !== undefined && y.at !== undefined && x.at !== y.at) return x.at - y.at;
    if (x.at === undefined && y.at !== undefined) return 1;
    if (x.at !== undefined && y.at === undefined) return -1;
    return x.order - y.order;
  });
}

export interface CardGroup {
  readonly key: string;
  readonly label: string;
  readonly cards: readonly BoardCard[];
}

/** Disks, then memory, then logs, each group by name, each card oldest first. */
export function groupBySource(cards: readonly BoardCard[]): CardGroup[] {
  const groups = new Map<string, { label: string; source: CardSource; cards: BoardCard[] }>();
  for (const item of cards) {
    const group = groups.get(item.group) ?? {
      label: item.groupLabel,
      source: item.source,
      cards: [],
    };
    group.cards.push(item);
    groups.set(item.group, group);
  }
  return [...groups.entries()]
    .sort(
      ([keyX, x], [keyY, y]) =>
        SOURCE_ORDER[x.source] - SOURCE_ORDER[y.source] || (keyX < keyY ? -1 : 1),
    )
    .map(([key, group]) => ({ key, label: group.label, cards: sortByTime(group.cards) }));
}

/**
 * The command that shows this artefact in the terminal, for "Show in terminal", or undefined when
 * no tool on the workstation shows it yet. A file record opens with `inode`, on a working copy of
 * its drive when there is one, so the original stays in the bag.
 */
export function terminalCommandFor(ref: string, sim: SimState): string | undefined {
  const parsed = parseRef(ref);
  if (parsed?.kind !== "file") return undefined;
  const images = browsableImages(sim).filter((image) => image.id === parsed.image);
  const image = images.find((candidate) => !candidate.device) ?? images[0];
  if (!image) return undefined;
  return `inode ${image.path} ${parsed.record}`;
}

/** Whether the Evidence Browser can show this artefact. */
export const showsInEvidenceBrowser = (ref: string): boolean => parseRef(ref)?.kind === "file";
