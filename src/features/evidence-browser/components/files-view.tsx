"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";
import { useElementWidth } from "@/hooks/use-element-width";
import { formatRef, parentPath, parseRef, UTC_ZONE } from "@/sim";
import type { FileRecord } from "@/sim/types";
import type { EvidenceBrowserProps } from "../browser-tabs";
import {
  DEFAULT_SORT,
  filtering,
  formatSize,
  MACB_KEYS,
  MACB_NAMES,
  NO_FILTER,
  recordName,
  showTime,
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
  nodeLabel,
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
 * Below this many pixels of pane width the view drills in, one level at a time; from it up (Focus
 * pane on a laptop) it shows Autopsy's three columns side by side.
 */
export const DRILL_IN_BELOW_PX = 900;

/** The levels of the drill-in layout, top to bottom. */
type Step = "tree" | "records" | "detail";

/**
 * One record as a row of plain words: what the table shows, said as a sentence. It is both what
 * "Explain this" sends to the mentor and the explanation shown when the mentor is unavailable, so
 * the player always gets an answer whether or not a key is set (docs/plan/14-mentor.md).
 */
export function explainRowFor(record: FileRecord, zone: string) {
  const name = recordName(record);
  const times = MACB_KEYS.map(
    (key) => `${MACB_NAMES[key].toLowerCase()} ${showTime(record.times[key], zone)}`,
  ).join(", ");
  const text = `${name} — ${record.path} — ${record.kind === "dir" ? "folder" : "file"}, ${
    record.deleted ? "deleted" : "in use"
  }, ${formatSize(record)}, owner ${record.owner}, record ${record.record}, ${times}`;
  return {
    text,
    title: name,
    fallback: `This row is the record for \`${record.path}\`. The drive keeps one record per file, and this one says the file is ${
      record.deleted ? "deleted: its record is still there, which is why you can read it" : "in use"
    }, that it is ${formatSize(record)}, that it belongs to ${record.owner}, and that its record number is ${record.record}. The four times on it are ${times}, shown in ${zone === UTC_ZONE ? "UTC" : `${zone}, the drive's own clock`}.`,
  };
}

/** A form field on the pane's surfaces: the date and time inputs and the select. */
const FIELD = cx(
  "h-8 rounded-md border border-strong bg-surface-base px-2 text-primary hover:border-accent",
  "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70",
  FOCUS_RING,
);

/**
 * The Files view: the tree of drives and folders, the table of the selected folder's records, and
 * the details of the selected record (docs/plan/05-workspace-ui.md §Evidence Browser).
 *
 * How it's laid out depends on the room the pane has, not the screen. With 900 px or more (Focus
 * pane on a laptop, or a wide screen) the three sit side by side, like Autopsy. With less, it
 * drills in: drives and folders, then a folder's records, then one record, with a breadcrumb and
 * Back, so nothing is squeezed into a third of a column. The keys are the same in both.
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
  explainRow,
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
  const [step, setStep] = useState<Step>("tree");
  // Where focus goes once a level is on screen: its heading. A new request has a new id.
  const [focusRequest, setFocusRequest] = useState<{ step: Step; id: number }>();
  const rootRef = useRef<HTMLDivElement>(null);
  const treeHeading = useRef<HTMLHeadingElement>(null);
  const recordsHeading = useRef<HTMLHeadingElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const baseId = useId();

  // Unmeasured (no layout, as in a test) counts as wide: everything on screen at once.
  const width = useElementWidth(rootRef);
  const drill = width !== undefined && width < DRILL_IN_BELOW_PX;

  const tree = useMemo(() => buildTree(sim, opened), [sim, opened]);
  const node = (selectedKey && findNode(tree, selectedKey)) || tree[0];
  const imageNode = node && tree.find((image) => image.image.path === imagePathOf(node));
  const view = imageNode?.opened && !imageNode.stale ? imageNode.opened.view : undefined;

  const diskZone = evidence.zones.disk;
  const zone = localTimes && diskZone ? diskZone : UTC_ZONE;

  useEffect(() => {
    if (!focusRequest) return;
    const heading = { tree: treeHeading, records: recordsHeading, detail: detailHeading }[
      focusRequest.step
    ];
    heading.current?.focus();
  }, [focusRequest]);

  const announce = (text: string) =>
    setAnnouncement((previous) => (previous === text ? `${text} ` : text));

  /** Shows a level (drill-in only; side by side they're all showing) and puts focus on it. */
  const goTo = (next: Step, focus = true) => {
    setStep(next);
    if (focus) setFocusRequest((previous) => ({ step: next, id: (previous?.id ?? 0) + 1 }));
  };

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
        goTo("detail");
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
    setStep("tree");
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

  /** Whether a tree node lists records: a folder, or the partition that holds the files. */
  const listsRecords = (treeNode: TreeNode | undefined) =>
    treeNode?.kind === "folder" || (treeNode?.kind === "partition" && treeNode.holdsFiles);

  /** A click on a folder's name in the drill-in tree goes in to its records. */
  const activateNode = (treeNode: TreeNode) => {
    if (!drill || !listsRecords(treeNode)) return;
    const image = tree.find((item) => item.image.path === imagePathOf(treeNode));
    if (!image?.opened || image.stale) return;
    goTo("records");
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
    goTo("detail");
  };

  const onSort = (column: ColumnKey) =>
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "ascending" ? "descending" : "ascending" }
        : { column, direction: "ascending" },
    );

  /** A filter changed. Drilled in, the records it finds come into view (focus stays put). */
  const applyFilter = (next: RecordFilter) => {
    setFilter(next);
    if (drill && filtering(next) && step === "tree") goTo("records", false);
  };

  const setWindow = (next: { from: string; to: string }, field = filter.field) => {
    setRange(next);
    const from = next.from ? wallTimeToInstant(next.from, zone) : undefined;
    const to = next.to ? wallTimeToInstant(next.to, zone) : undefined;
    // A time typed to the minute covers the whole of that minute.
    const toEnd = to !== undefined && next.to.length <= 16 ? to + 59_999 : to;
    applyFilter({
      deletedOnly: filter.deletedOnly,
      field,
      ...(from !== undefined && { from }),
      ...(toEnd !== undefined && { to: toEnd }),
    });
  };

  const clearFilters = () => {
    applyFilter(NO_FILTER);
    setRange({ from: "", to: "" });
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

  // Drilled in, a level that has nothing to show steps back to one that does (a drive that
  // changed, a reset): adjusting state while rendering.
  const shownStep: Step = !drill
    ? step
    : step === "detail" && !record
      ? view
        ? "records"
        : "tree"
      : step === "records" && !view
        ? "tree"
        : step;
  if (drill && shownStep !== step) setStep(shownStep);

  if (tree.length === 0) {
    return (
      <p className="text-secondary">
        No disk images are attached to your workstation right now. Reset machine brings the evidence
        back.
      </p>
    );
  }

  // Before any drive is open, one button opens the one to start with: a working copy if there
  // is one, otherwise an original behind a blocker that's on. An original with its blocker off
  // is never offered here; its own details say why, and how to turn the blocker on.
  const nothingOpen = tree.every((image) => !image.opened);
  const starter = nothingOpen ? startingImage(tree, imageNode) : undefined;

  const treeSection = (
    <section aria-labelledby={`${baseId}-tree`} className="min-w-0 space-y-2">
      <h4
        id={`${baseId}-tree`}
        ref={treeHeading}
        tabIndex={-1}
        className="type-small font-semibold text-secondary outline-none"
      >
        Drives and folders
      </h4>
      <div
        className={cx(
          "overflow-auto rounded-md border border-subtle p-1.5",
          drill ? "max-h-[60dvh]" : "max-h-[calc(100dvh-18rem)] min-h-40",
        )}
      >
        <EvidenceTree
          nodes={tree}
          expanded={expanded}
          selected={node?.key}
          onSelect={selectNode}
          onActivate={activateNode}
          onExpand={expand}
          onOpenImage={openImage}
          onTogglePin={(treeNode) => treeNode.kind === "folder" && togglePin(treeNode.record)}
          isPinned={(treeNode) => treeNode.kind === "folder" && isPinned(treeNode.record)}
        />
      </div>
      <p className="text-xs text-muted">
        Arrow keys move; Right or Enter opens a drive or folder; P pins a folder.
      </p>
      {drill && view && listsRecords(node) && node && (
        <Button size="sm" variant="primary" onClick={() => goTo("records")}>
          Show the files in {nodeLabel(node)}
        </Button>
      )}
    </section>
  );

  const openEmpty = starter && (
    <EmptyState
      titleAs="h4"
      className="py-6"
      title="A drive's files will be listed here"
      description={
        starter.image.device
          ? `You haven't opened a drive yet. Its write-blocker is on, so opening the original changes nothing on it.`
          : `You haven't opened a drive yet. This opens your working copy, so the original stays as it arrived.`
      }
      action={
        <Button variant="primary" onClick={() => openImage(starter.image.path)}>
          Open {starter.image.id}
        </Button>
      }
    />
  );

  const filterBar = view && (
    <FilterBar
      baseId={baseId}
      filter={filter}
      range={range}
      zone={zone}
      diskZone={diskZone}
      localTimes={localTimes}
      onDeletedOnly={(deletedOnly) => applyFilter({ ...filter, deletedOnly })}
      onField={(field) => setWindow(range, field)}
      onRange={setWindow}
      onLocalTimes={setLocalTimes}
      onClear={clearFilters}
    />
  );

  const recordsSection = (
    <section aria-labelledby={`${baseId}-table`} className="min-w-0 space-y-3">
      <h4
        id={`${baseId}-table`}
        ref={recordsHeading}
        tabIndex={-1}
        className="type-small font-semibold text-secondary outline-none"
      >
        Records
      </h4>
      {openEmpty ?? (
        <RecordTable
          caption={caption}
          rows={rows}
          selected={record?.record}
          onSelect={(row) => setSelectedRecord(row.record)}
          onOpen={openRecord}
          openOnClick={drill}
          onTogglePin={togglePin}
          isPinned={isPinned}
          sort={sort}
          onSort={onSort}
          zone={zone}
          showFolder={filtering(filter)}
          empty={tableEmpty(imageNode, view, filtering(filter), folder)}
        />
      )}
    </section>
  );

  const detailBody =
    record && view && imageNode ? (
      <RecordDetail
        view={view}
        record={record}
        artefactRef={refFor(record)}
        pinned={isPinned(record)}
        onTogglePin={() => togglePin(record)}
        terminalCommand={`inode ${imagePathLabel} ${record.record}`}
        onShowInTerminal={() => showInTerminal(`inode ${imagePathLabel} ${record.record}`)}
        {...(explainRow && {
          // The row exactly as the table draws it, and the browser's own sentence as the
          // fallback. The evidence set never travels (docs/plan/14-mentor.md §Spec).
          onExplain: () => explainRow(explainRowFor(record, zone)),
        })}
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
        // The empty state beside it already has this drive's Open button.
        showOpen={starter?.image.path !== imageNode.image.path}
      />
    ) : null;

  const detailSection = (
    <section aria-labelledby={`${baseId}-detail`} className="min-w-0">
      <h4 id={`${baseId}-detail`} className="sr-only">
        Details
      </h4>
      <div className="rounded-lg border border-subtle bg-surface-base p-4">{detailBody}</div>
    </section>
  );

  return (
    <div ref={rootRef} data-layout={drill ? "drill-in" : "columns"} className="space-y-4">
      {drill ? (
        <>
          {shownStep !== "tree" && (
            <DrillNav
              step={shownStep}
              records={
                filtering(filter)
                  ? "Filtered records"
                  : node && listsRecords(node)
                    ? nodeLabel(node)
                    : "Records"
              }
              record={record ? recordName(record) : undefined}
              onGo={(next) => goTo(next)}
            />
          )}
          {shownStep !== "detail" && filterBar}
          {shownStep === "tree" && (
            <div className="space-y-4">
              {openEmpty}
              {treeSection}
              {node?.kind !== "folder" && detailSection}
            </div>
          )}
          {shownStep === "records" && recordsSection}
          {shownStep === "detail" && detailSection}
        </>
      ) : (
        <div className="grid grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)_minmax(18rem,26rem)] items-start gap-5">
          {treeSection}
          <div className="min-w-0 space-y-3">
            {filterBar}
            {recordsSection}
          </div>
          <div className="sticky top-0 max-h-[calc(100dvh-14rem)] min-w-0 overflow-y-auto">
            {detailSection}
          </div>
        </div>
      )}

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

/** The image to offer in the empty state: one whose opening changes nothing. */
function startingImage(tree: readonly ImageNode[], selected: ImageNode | undefined) {
  const safe = (image: ImageNode) => !image.image.device || image.image.device.blocker;
  if (selected && safe(selected)) return selected;
  return tree.find((image) => !image.image.device) ?? tree.find(safe);
}

/** Where you are, drilled in: Back, and a breadcrumb whose earlier levels are links back. */
function DrillNav({
  step,
  records,
  record,
  onGo,
}: {
  step: Step;
  records: string;
  record: string | undefined;
  onGo: (step: Step) => void;
}) {
  const crumbs: { step: Step; label: string }[] = [
    { step: "tree", label: "Drives and folders" },
    { step: "records", label: records },
    ...(step === "detail" && record ? [{ step: "detail" as const, label: record }] : []),
  ];
  const back = step === "detail" ? "records" : "tree";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button size="sm" variant="secondary" onClick={() => onGo(back)}>
        <span aria-hidden="true">←</span>
        {back === "tree" ? "Back to the drives" : "Back to the records"}
      </Button>
      <nav aria-label="Where you are in the drive" className="min-w-0">
        <ol className="flex flex-wrap items-center gap-x-1.5 text-sm">
          {crumbs.map((crumb, index) => {
            const current = crumb.step === step;
            return (
              <li key={crumb.step} className="flex min-w-0 items-center gap-1.5">
                {index > 0 && (
                  <span aria-hidden="true" className="text-muted">
                    /
                  </span>
                )}
                {current ? (
                  <span aria-current="location" className="font-mono break-all text-primary">
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onGo(crumb.step)}
                    className={cx(
                      "rounded font-mono break-all text-secondary underline-offset-2 hover:text-primary hover:underline",
                      FOCUS_RING,
                    )}
                  >
                    {crumb.label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

/**
 * The filters, once a drive is open: Deleted only and the clock are always in the bar; the time
 * window folds away behind its own button, and opens by itself while it's in use.
 */
function FilterBar({
  baseId,
  filter,
  range,
  zone,
  diskZone,
  localTimes,
  onDeletedOnly,
  onField,
  onRange,
  onLocalTimes,
  onClear,
}: {
  baseId: string;
  filter: RecordFilter;
  range: { from: string; to: string };
  zone: string;
  diskZone: string | undefined;
  localTimes: boolean;
  onDeletedOnly: (on: boolean) => void;
  onField: (field: TimeField) => void;
  onRange: (range: { from: string; to: string }) => void;
  onLocalTimes: (local: boolean) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const windowOn = Boolean(range.from || range.to);
  const showWindow = open || windowOn;
  const windowId = `${baseId}-window`;

  return (
    <div
      role="group"
      aria-labelledby={`${baseId}-filters`}
      className="space-y-3 rounded-md border border-subtle bg-surface-raised px-3 py-2 text-sm"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span id={`${baseId}-filters`} className="text-xs font-semibold text-secondary">
          Filters <span className="font-normal text-muted">(they search the whole drive)</span>
        </span>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filter.deletedOnly}
            onChange={(event) => onDeletedOnly(event.target.checked)}
            className="size-4 accent-accent"
          />
          Deleted only
        </label>
        <button
          type="button"
          aria-expanded={showWindow}
          aria-controls={windowId}
          // While a time is set the window stays open: Clear filters folds it away.
          aria-disabled={windowOn}
          onClick={() => !windowOn && setOpen(!open)}
          className={cx(
            "flex items-center gap-1.5 rounded px-1 text-secondary hover:text-primary aria-disabled:cursor-default aria-disabled:hover:text-secondary",
            FOCUS_RING,
          )}
        >
          <span
            aria-hidden="true"
            className={cx(
              "inline-block transition-transform fx-duration-fast",
              showWindow && "rotate-90",
            )}
          >
            ▸
          </span>
          Time window{windowOn && ": on"}
        </button>
        {filtering(filter) && (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear filters
          </Button>
        )}
        <fieldset className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          <legend className="sr-only">Show times in</legend>
          <span aria-hidden="true" className="text-xs font-semibold text-secondary">
            Times in
          </span>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`${baseId}-zone`}
              checked={!localTimes || !diskZone}
              onChange={() => onLocalTimes(false)}
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
                onChange={() => onLocalTimes(true)}
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
      </div>

      <fieldset
        id={windowId}
        hidden={!showWindow}
        className="flex animate-fade-in flex-wrap items-end gap-x-4 gap-y-2 border-t border-subtle pt-2"
      >
        <legend className="sr-only">Time window</legend>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-secondary">Which time</span>
          <select
            value={filter.field}
            onChange={(event) => onField(event.target.value as TimeField)}
            className={cx(FIELD, "text-sm")}
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
            onChange={(event) => onRange({ ...range, from: event.target.value })}
            className={cx(FIELD, "font-mono text-xs")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-secondary">And</span>
          <input
            type="datetime-local"
            step={1}
            value={range.to}
            onChange={(event) => onRange({ ...range, to: event.target.value })}
            className={cx(FIELD, "font-mono text-xs")}
          />
        </label>
      </fieldset>
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
