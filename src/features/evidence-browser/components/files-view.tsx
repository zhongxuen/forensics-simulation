"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatRef, parentPath, parseRef, UTC_ZONE } from "@/sim";
import type { FileRecord } from "@/sim/types";
import type { EvidenceBrowserProps } from "../browser-tabs";
import {
  DEFAULT_SORT,
  filtering,
  NO_FILTER,
  tableRows,
  wallTimeToInstant,
  type ColumnKey,
  type RecordFilter,
  type SortOrder,
  type TimeField,
} from "../model/table";
import {
  ancestorKeys,
  buildTree,
  filePartition,
  findNode,
  folderKey,
  imageKey,
  partitionKey,
  rootRecords,
  type ImageNode,
  type OpenedImage,
  type TreeNode,
} from "../model/tree";
import { EvidenceTree } from "./evidence-tree";
import { ImageDetail, PartitionDetail } from "./image-detail";
import { RecordDetail } from "./record-detail";
import { RecordTable } from "./record-table";

/**
 * The Files view: the tree on one side, the table of the selected folder's records, and the
 * details of the selected record (docs/plan/05-workspace-ui.md §Evidence Browser).
 *
 * Nothing here reads an image. Opening one calls `browse`, which goes through the engine the way
 * the disk tools do (write-blocker and all), and everything on screen is drawn from the view the
 * engine returned. If the image changes after that (the blocker was off, or the machine was
 * reset), the view is marked as changed and has to be opened again, rather than quietly read.
 */
export function FilesView({
  sim,
  evidence,
  browse,
  pins,
  onPin,
  onUnpin,
  showInTerminal,
  reveal,
}: EvidenceBrowserProps) {
  const [opened, setOpened] = useState<Readonly<Record<string, OpenedImage>>>({});
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string>();
  const [selectedRecord, setSelectedRecord] = useState<number>();
  const [sort, setSort] = useState<SortOrder>(DEFAULT_SORT);
  const [filter, setFilter] = useState<RecordFilter>(NO_FILTER);
  const [range, setRange] = useState({ from: "", to: "" });
  const [localTimes, setLocalTimes] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const [focusDetail, setFocusDetail] = useState(0);
  const baseId = useId();

  const tree = useMemo(() => buildTree(sim, opened), [sim, opened]);
  const node = (selectedKey && findNode(tree, selectedKey)) || tree[0];
  const imageNode = node && tree.find((image) => image.image.path === imagePathOf(node));
  const view = imageNode?.opened && !imageNode.stale ? imageNode.opened.view : undefined;

  const diskZone = evidence.zones.disk;
  const zone = localTimes && diskZone ? diskZone : UTC_ZONE;

  // Moving focus to the details after Enter on a row, once they're on screen.
  useEffect(() => {
    if (focusDetail > 0) detailHeading.current?.focus();
  }, [focusDetail]);

  const announce = (text: string) =>
    setAnnouncement((previous) => (previous === text ? `${text} ` : text));

  // A request from the case board to show a record: select it on a drive that's already open
  // (adjusting state while rendering, once per request). A working copy is preferred to the
  // original, and nothing is opened here.
  const [revealed, setRevealed] = useState<number>();
  if (reveal && reveal.id !== revealed) {
    setRevealed(reveal.id);
    const parsed = parseRef(reveal.ref);
    if (parsed?.kind === "file") {
      const open = tree.filter(
        (image) => image.image.id === parsed.image && image.opened && !image.stale,
      );
      const target = open.find((image) => !image.image.device) ?? open[0];
      const found = target?.opened?.view.record(parsed.record);
      if (!target || !found) {
        announce(
          `To see record ${parsed.record}, open a drive from ${parsed.image} in the tree first. Opening your working copy keeps the original as it arrived.`,
        );
      } else {
        const path = target.image.path;
        const folder = target.opened?.view
          .atPath(parentPath(found.path) ?? "")
          .find((record) => record.kind === "dir");
        const key =
          folder && findNode(tree, folderKey(path, folder.record))
            ? folderKey(path, folder.record)
            : imageKey(path);
        setExpanded(new Set([...expanded, ...ancestorKeys(tree, key), key]));
        setFilter(NO_FILTER);
        setRange({ from: "", to: "" });
        setSelectedKey(key);
        setSelectedRecord(found.record);
        setFocusDetail((n) => n + 1);
        announce(`Showing ${found.path} (record ${found.record}) on ${path}.`);
      }
    }
  }

  const refFor = (record: FileRecord) =>
    imageNode ? formatRef({ kind: "file", image: imageNode.image.id, record: record.record }) : "";
  const isPinned = (record: FileRecord) => pins.includes(refFor(record));
  const togglePin = (record: FileRecord) => {
    const ref = refFor(record);
    if (!ref) return;
    const label = `${record.path.slice(record.path.lastIndexOf("\\") + 1) || record.path} (record ${record.record})`;
    if (pins.includes(ref)) {
      onUnpin(ref);
      announce(`Took ${label} off the case board.`);
    } else {
      onPin(ref);
      announce(`Pinned ${label} to the case board.`);
    }
  };

  const openImage = (path: string) => {
    const result = browse(path);
    if (!result) {
      announce("That drive isn't attached any more, so there's nothing to open.");
      return;
    }
    setOpened({
      ...opened,
      [path]: { view: result.view, ...(result.warning && { warning: result.warning }) },
    });
    // Show the partitions, and the folders on the one that holds the files.
    const holding = filePartition(result.view.image.partitions);
    const next = new Set(expanded);
    next.add(imageKey(path));
    if (holding) {
      next.add(partitionKey(path, holding.index));
      for (const root of rootRecords(result.view)) next.add(folderKey(path, root.record));
    }
    setExpanded(next);
    setSelectedKey(imageKey(path));
    setSelectedRecord(undefined);
    announce(
      result.warning
        ? `Opened ${result.view.image.id}, around its write-blocker. The original drive has changed.`
        : `Opened ${result.view.image.id}. Its partitions and folders are in the tree.`,
    );
  };

  const expand = (key: string, open: boolean) => {
    const next = new Set(expanded);
    if (open) next.add(key);
    else next.delete(key);
    setExpanded(next);
  };

  const selectNode = (key: string) => {
    setSelectedKey(key);
    setSelectedRecord(undefined);
  };

  /** Enter on a row: into a folder (in the tree too), or over to a file's details. */
  const openRecord = (record: FileRecord) => {
    if (!imageNode) return;
    if (record.kind === "dir") {
      const key = folderKey(imageNode.image.path, record.record);
      if (findNode(tree, key)) {
        setExpanded(new Set([...expanded, ...ancestorKeys(tree, key)]));
        setFilter(NO_FILTER);
        setRange({ from: "", to: "" });
        selectNode(key);
        announce(`Opened the folder ${record.path}.`);
        return;
      }
    }
    setSelectedRecord(record.record);
    setFocusDetail((n) => n + 1);
  };

  const onSort = (column: ColumnKey) =>
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "ascending" ? "descending" : "ascending" }
        : { column, direction: "ascending" },
    );

  const setWindow = (next: { from: string; to: string }, field = filter.field) => {
    setRange(next);
    const from = next.from ? wallTimeToInstant(next.from, zone) : undefined;
    const to = next.to ? wallTimeToInstant(next.to, zone) : undefined;
    // A time typed to the minute covers the whole of that minute.
    const toEnd = to !== undefined && next.to.length <= 16 ? to + 59_999 : to;
    setFilter({
      deletedOnly: filter.deletedOnly,
      field,
      ...(from !== undefined && { from }),
      ...(toEnd !== undefined && { to: toEnd }),
    });
  };

  // What the table lists: the selected folder, or the whole drive while a filter is on.
  const folder =
    node?.kind === "folder"
      ? node.record.path
      : node?.kind === "partition" && node.holdsFiles
        ? undefined
        : null;
  const rows =
    view && (folder !== null || filtering(filter))
      ? tableRows(view, folder ?? undefined, filter, sort)
      : [];
  const caption = filtering(filter)
    ? `Records on the whole drive that match your filters, ${rows.length} of them`
    : node?.kind === "folder"
      ? `Files in ${node.record.path}`
      : "The top of the drive";

  const record =
    view && selectedRecord !== undefined
      ? view.record(selectedRecord)
      : view && node?.kind === "folder"
        ? view.record(node.record.record)
        : undefined;

  const imagePathLabel = imageNode?.image.path ?? "";
  const filtersId = `${baseId}-filters`;

  if (tree.length === 0) {
    return (
      <p className="text-secondary">
        No disk images are attached to your workstation right now. Reset machine brings the evidence
        back.
      </p>
    );
  }

  return (
    <div className="@container space-y-5">
      <div className="grid gap-5 @3xl:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)]">
        <section aria-labelledby={`${baseId}-tree`} className="min-w-0">
          <h4 id={`${baseId}-tree`} className="text-sm font-semibold text-secondary">
            Drives and folders
          </h4>
          <div className="mt-2 max-h-80 overflow-auto rounded-md border border-subtle p-1.5">
            <EvidenceTree
              nodes={tree}
              expanded={expanded}
              selected={node?.key}
              onSelect={selectNode}
              onExpand={expand}
              onOpenImage={openImage}
              onTogglePin={(treeNode) => treeNode.kind === "folder" && togglePin(treeNode.record)}
              isPinned={(treeNode) => treeNode.kind === "folder" && isPinned(treeNode.record)}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Arrow keys move; Right or Enter opens a drive or folder; P pins a folder.
          </p>
        </section>

        <section aria-labelledby={`${baseId}-table`} className="min-w-0 space-y-3">
          <h4 id={`${baseId}-table`} className="text-sm font-semibold text-secondary">
            Records
          </h4>
          <fieldset
            id={filtersId}
            className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-md border border-subtle px-3 pt-1 pb-3 text-sm"
          >
            <legend className="px-1 text-xs font-semibold text-secondary">
              Filters (they search the whole drive)
            </legend>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filter.deletedOnly}
                onChange={(event) => setFilter({ ...filter, deletedOnly: event.target.checked })}
                className="size-4 accent-accent"
              />
              Deleted only
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-secondary">Which time</span>
              <select
                value={filter.field}
                onChange={(event) => setWindow(range, event.target.value as TimeField)}
                className="rounded-md border border-strong bg-surface-base px-2 py-1"
              >
                <option value="any">Any of M, A, C, B</option>
                <option value="m">M: modified</option>
                <option value="a">A: accessed</option>
                <option value="c">C: changed</option>
                <option value="b">B: born</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-secondary">Between ({zone})</span>
              <input
                type="datetime-local"
                step={1}
                value={range.from}
                onChange={(event) => setWindow({ ...range, from: event.target.value })}
                className="rounded-md border border-strong bg-surface-base px-2 py-1 font-mono text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-secondary">And</span>
              <input
                type="datetime-local"
                step={1}
                value={range.to}
                onChange={(event) => setWindow({ ...range, to: event.target.value })}
                className="rounded-md border border-strong bg-surface-base px-2 py-1 font-mono text-xs"
              />
            </label>
            {filtering(filter) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFilter(NO_FILTER);
                  setRange({ from: "", to: "" });
                }}
              >
                Clear filters
              </Button>
            )}
          </fieldset>

          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <legend className="sr-only">Show times in</legend>
            <span aria-hidden="true" className="text-xs font-semibold text-secondary">
              Times in
            </span>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name={`${baseId}-zone`}
                checked={!localTimes || !diskZone}
                onChange={() => setLocalTimes(false)}
                className="accent-accent"
              />
              UTC
            </label>
            {diskZone ? (
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`${baseId}-zone`}
                  checked={localTimes}
                  onChange={() => setLocalTimes(true)}
                  className="accent-accent"
                />
                Local: {diskZone}, the drive&apos;s own clock
              </label>
            ) : (
              <span className="text-xs text-muted">
                This drive&apos;s computer kept its clock on UTC, so local time is the same.
              </span>
            )}
          </fieldset>

          <RecordTable
            caption={caption}
            rows={rows}
            selected={record?.record}
            onSelect={(row) => setSelectedRecord(row.record)}
            onOpen={openRecord}
            onTogglePin={togglePin}
            isPinned={isPinned}
            sort={sort}
            onSort={onSort}
            zone={zone}
            showFolder={filtering(filter)}
            empty={tableEmpty(imageNode, view, filtering(filter), folder)}
          />
        </section>
      </div>

      <section aria-labelledby={`${baseId}-detail`} className="min-w-0">
        <h4 id={`${baseId}-detail`} className="sr-only">
          Details
        </h4>
        <div className="rounded-lg border border-subtle bg-surface-base p-4">
          {record && view && imageNode ? (
            <RecordDetail
              view={view}
              record={record}
              artefactRef={refFor(record)}
              pinned={isPinned(record)}
              onTogglePin={() => togglePin(record)}
              terminalCommand={`inode ${imagePathLabel} ${record.record}`}
              onShowInTerminal={() => showInTerminal(`inode ${imagePathLabel} ${record.record}`)}
              zone={zone}
              headingRef={detailHeading}
            />
          ) : node?.kind === "partition" ? (
            <PartitionDetail node={node} />
          ) : imageNode ? (
            <ImageDetail
              node={imageNode}
              evidence={evidence}
              onOpen={() => openImage(imageNode.image.path)}
            />
          ) : null}
        </div>
      </section>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

/** The workstation path of the image a node belongs to. */
function imagePathOf(node: TreeNode): string {
  return node.kind === "image" ? node.image.path : node.imagePath;
}

/** What the table says instead of rows, following the empty-state template (99 §Voice). */
function tableEmpty(
  image: ImageNode | undefined,
  view: unknown,
  filtered: boolean,
  folder: string | null | undefined,
): string {
  if (!image?.opened) return "The records will be listed here once you open a drive in the tree.";
  if (!view)
    return "This drive has changed since you opened it. Open it again to see it as it is now.";
  if (filtered) return "Nothing on this drive matches your filters. Clear one to see more.";
  if (folder === null)
    return "Pick a folder in the tree to list what's in it, or turn on Deleted only to see every deleted record on the drive.";
  return "This folder is empty.";
}
