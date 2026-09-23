"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { cx } from "@/lib/cx";
import { flatten, nodeLabel, visibleNodes, type ImageNode, type TreeNode } from "../model/tree";

interface EvidenceTreeProps {
  nodes: readonly ImageNode[];
  expanded: ReadonlySet<string>;
  /** The selected node's key. Selection follows focus, so it's also the one tab stop. */
  selected: string | undefined;
  onSelect: (key: string) => void;
  onExpand: (key: string, open: boolean) => void;
  /** Opens (reads) an image that hasn't been opened, or has changed since. */
  onOpenImage: (path: string) => void;
  /** `p` on a folder. */
  onTogglePin: (node: TreeNode) => void;
  /** The pinned refs, so a pinned folder says so. */
  isPinned: (node: TreeNode) => boolean;
}

/** Whether a node can open to show more: an image always can (opening it reads it). */
const expandable = (node: TreeNode) => node.kind === "image" || node.children.length > 0;

/** An image that needs reading before it can show anything. */
const needsOpening = (node: TreeNode) => node.kind === "image" && (!node.opened || node.stale);

/**
 * The data source tree: images, partitions, folders. It follows the ARIA tree pattern: Tab reaches
 * the selected node; Up and Down move; Right opens a node (reading an image the first time) or
 * moves to its first child; Left closes it or moves to its parent; Home and End jump to the ends;
 * Enter and Space open an image; `p` pins a folder. Selection follows focus, and the table beside
 * it lists what's in the selected folder.
 *
 * Deleted folders are struck through and say "deleted" in words, never by strike-through or
 * colour alone.
 */
export function EvidenceTree({
  nodes,
  expanded,
  selected,
  onSelect,
  onExpand,
  onOpenImage,
  onTogglePin,
  isPinned,
}: EvidenceTreeProps) {
  const items = useRef(new Map<string, HTMLLIElement>());
  const baseId = useId();
  // Each node's label gets an id, so the node is named by its own line and not by everything in
  // the folders under it.
  const labelIds = new Map(flatten(nodes).map((node, i) => [node.key, `${baseId}-label-${i}`]));
  const visible = visibleNodes(nodes, expanded);
  const current = visible.find((node) => node.key === selected)?.key ?? visible[0]?.key;

  const move = (node: TreeNode | undefined) => {
    if (!node) return;
    onSelect(node.key);
    items.current.get(node.key)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = visible.findIndex((node) => node.key === current);
    const node = visible[index];
    if (!node) return;
    const open = expanded.has(node.key);
    let handled = true;
    switch (event.key) {
      case "ArrowDown":
        move(visible[index + 1]);
        break;
      case "ArrowUp":
        move(visible[index - 1]);
        break;
      case "Home":
        move(visible[0]);
        break;
      case "End":
        move(visible.at(-1));
        break;
      case "ArrowRight":
        if (needsOpening(node) && node.kind === "image") onOpenImage(node.image.path);
        else if (expandable(node) && !open) onExpand(node.key, true);
        else if (open) move(node.children[0]);
        break;
      case "ArrowLeft":
        if (open) onExpand(node.key, false);
        else move(visible.find((other) => other.key === node.parent));
        break;
      case "Enter":
      case " ":
        if (needsOpening(node) && node.kind === "image") onOpenImage(node.image.path);
        else if (expandable(node)) onExpand(node.key, !open);
        break;
      case "p":
      case "P":
        if (node.kind === "folder") onTogglePin(node);
        else handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  };

  const renderNode = (node: TreeNode, level: number, position: number, size: number) => {
    const open = expanded.has(node.key);
    const isSelected = node.key === current;
    return (
      <li
        key={node.key}
        ref={(element) => {
          if (element) items.current.set(node.key, element);
          else items.current.delete(node.key);
        }}
        role="treeitem"
        aria-level={level}
        aria-posinset={position}
        aria-setsize={size}
        aria-selected={isSelected}
        {...(expandable(node) && { "aria-expanded": open && !needsOpening(node) })}
        aria-labelledby={labelIds.get(node.key)}
        tabIndex={isSelected ? 0 : -1}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.key);
        }}
        // The ring goes round the node's own line, not the folders under it.
        className="outline-none [&:focus-visible>div]:outline-2 [&:focus-visible>div]:outline-focus-ring"
      >
        <div
          className={cx(
            "flex items-baseline gap-1.5 rounded-md py-1 pr-2 text-sm",
            isSelected
              ? "bg-surface-overlay text-primary"
              : "text-secondary hover:bg-surface-raised",
          )}
          style={{ paddingLeft: `${(level - 1) * 1}rem` }}
        >
          <span
            aria-hidden="true"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(node.key);
              if (needsOpening(node) && node.kind === "image") onOpenImage(node.image.path);
              else if (expandable(node)) onExpand(node.key, !open);
            }}
            className={cx(
              "w-4 shrink-0 cursor-pointer text-center text-muted",
              !expandable(node) && "invisible",
            )}
          >
            {open && !needsOpening(node) ? "▾" : "▸"}
          </span>
          <NodeText id={labelIds.get(node.key)} node={node} pinned={isPinned(node)} />
        </div>
        {open && node.children.length > 0 && !needsOpening(node) && (
          <ul role="group">
            {node.children.map((child, i) =>
              renderNode(child, level + 1, i + 1, node.children.length),
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <ul role="tree" aria-label="Evidence" onKeyDown={onKeyDown} className="space-y-0.5">
      {nodes.map((node, i) => renderNode(node, 1, i + 1, nodes.length))}
    </ul>
  );
}

/** A node's name and, in words, anything a reader needs to know about it. */
function NodeText({ id, node, pinned }: { id?: string; node: TreeNode; pinned: boolean }) {
  const label = nodeLabel(node);
  switch (node.kind) {
    case "image":
      return (
        <span id={id} className="min-w-0">
          <span className="font-mono font-medium text-primary">{label}</span>{" "}
          <span className="text-xs text-muted">
            {node.image.device
              ? `original, write-blocker ${node.image.device.blocker ? "on" : "off"}`
              : "working copy"}
            {!node.opened && ", not opened yet"}
            {node.stale && ", changed since you opened it"}
          </span>
        </span>
      );
    case "partition":
      return (
        <span id={id} className="min-w-0">
          {label}
          {!node.holdsFiles && (
            <>
              {" "}
              <span className="text-xs text-muted">(no files here)</span>
            </>
          )}
        </span>
      );
    case "folder":
      return (
        <span id={id} className="min-w-0 font-mono">
          <span className={cx(node.record.deleted && "line-through")}>{label}</span>
          {node.record.deleted && (
            <>
              {" "}
              <span className="font-sans text-xs text-status-danger">deleted</span>
            </>
          )}
          {pinned && (
            <>
              {" "}
              <span className="font-sans text-xs text-accent">pinned</span>
            </>
          )}
        </span>
      );
  }
}
