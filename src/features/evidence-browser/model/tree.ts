import { baseName, browsableImages, parentPath } from "@/sim";
import type { BrowsableImage, DiskView, FileRecord, Partition, SimState } from "@/sim/types";

/**
 * The browser's tree (docs/plan/05-workspace-ui.md §Evidence Browser): images, then partitions,
 * then folders, the way Autopsy's data source tree reads. Pure: it is built from the engine's
 * state (which images exist, and their write-blockers) and from the views the engine handed back
 * when the player opened an image. An image that hasn't been opened has no children yet, because
 * nothing has read it.
 */

/** An image the player has opened, and the view the engine gave back. */
export interface OpenedImage {
  readonly view: DiskView;
  /** The tools' warning, when opening it went around the write-blocker. */
  readonly warning?: readonly string[];
}

export type TreeNode = ImageNode | PartitionNode | FolderNode;

interface NodeBase {
  /** Unique within the tree, and stable while the image stays open. */
  readonly key: string;
  /** The key of the node above, or undefined for an image. */
  readonly parent?: string;
  readonly children: readonly TreeNode[];
}

export interface ImageNode extends NodeBase {
  readonly kind: "image";
  readonly image: BrowsableImage;
  /** Undefined until the player opens it. */
  readonly opened?: OpenedImage;
  /**
   * True when the image changed after it was opened (a read with the write-blocker off, or Reset
   * machine), so what's on screen is no longer what's on the drive. It has to be opened again.
   */
  readonly stale: boolean;
}

export interface PartitionNode extends NodeBase {
  readonly kind: "partition";
  readonly imagePath: string;
  readonly partition: Partition;
  /** True for the partition the file records live on. */
  readonly holdsFiles: boolean;
}

export interface FolderNode extends NodeBase {
  readonly kind: "folder";
  readonly imagePath: string;
  readonly record: FileRecord;
}

export const imageKey = (path: string): string => `image:${path}`;
export const partitionKey = (path: string, index: number): string => `partition:${path}#${index}`;
export const folderKey = (path: string, record: number): string => `folder:${path}#${record}`;

/**
 * The partition the file records belong to. The simulated drives keep one file system, with
 * Windows-style paths, on their largest partition (the "Windows" one); the small ones before it,
 * such as "System reserved", hold boot files the simulation leaves out.
 */
export function filePartition(partitions: readonly Partition[]): Partition | undefined {
  return partitions.reduce<Partition | undefined>(
    (largest, partition) => (!largest || partition.sectors > largest.sectors ? partition : largest),
    undefined,
  );
}

/** By name (ignoring case), live before deleted when two share a name, then by record. */
export function byName(x: FileRecord, y: FileRecord): number {
  const a = baseName(x.path).toLowerCase();
  const b = baseName(y.path).toLowerCase();
  if (a !== b) return a < b ? -1 : 1;
  if (x.deleted !== y.deleted) return x.deleted ? 1 : -1;
  return x.record - y.record;
}

/** The records at the top of the file system: the drive's root folder, "C:\". */
export function rootRecords(view: DiskView): readonly FileRecord[] {
  return view.records.filter((record) => parentPath(record.path) === undefined).sort(byName);
}

/**
 * A folder and the folders inside it, live and deleted. A deleted folder keeps its children: the
 * records survive deletion, and still name it as their parent.
 */
function folderNode(
  view: DiskView,
  imagePath: string,
  record: FileRecord,
  parent: string,
): FolderNode {
  const key = folderKey(imagePath, record.record);
  const children = view
    .children(record.path)
    .filter((child) => child.kind === "dir")
    .sort(byName)
    .map((child) => folderNode(view, imagePath, child, key));
  return { kind: "folder", key, parent, imagePath, record, children };
}

/**
 * The whole tree for the workstation's current state. `opened` holds the views the engine returned,
 * by image path; a view for an image that has since gone (a working copy, after Reset machine) is
 * ignored.
 */
export function buildTree(
  sim: SimState,
  opened: Readonly<Record<string, OpenedImage>>,
): readonly ImageNode[] {
  return browsableImages(sim).map((image) => {
    const key = imageKey(image.path);
    const open = Object.hasOwn(opened, image.path) ? opened[image.path] : undefined;
    if (!open) return { kind: "image", key, image, stale: false, children: [] };
    const stale = open.view.image !== image.image;
    const holding = filePartition(open.view.image.partitions);
    const partitions = [...open.view.image.partitions].sort((x, y) => x.index - y.index);
    const children: PartitionNode[] = partitions.map((partition) => {
      const partKey = partitionKey(image.path, partition.index);
      const holdsFiles = partition === holding;
      return {
        kind: "partition",
        key: partKey,
        parent: key,
        imagePath: image.path,
        partition,
        holdsFiles,
        children: holdsFiles
          ? rootRecords(open.view)
              .filter((record) => record.kind === "dir")
              .map((record) => folderNode(open.view, image.path, record, partKey))
          : [],
      };
    });
    return { kind: "image", key, image, opened: open, stale, children };
  });
}

/** Every node, depth first, in the order the tree shows them. */
export function flatten(nodes: readonly TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/** The nodes a reader sees: children only under expanded nodes. */
export function visibleNodes(
  nodes: readonly TreeNode[],
  expanded: ReadonlySet<string>,
): TreeNode[] {
  return nodes.flatMap((node) =>
    expanded.has(node.key) ? [node, ...visibleNodes(node.children, expanded)] : [node],
  );
}

/** The node with this key, anywhere in the tree. */
export function findNode(nodes: readonly TreeNode[], key: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.key === key) return node;
    const found = findNode(node.children, key);
    if (found) return found;
  }
  return undefined;
}

/** The keys of every node above `key`, nearest last: what to expand to show it. */
export function ancestorKeys(nodes: readonly TreeNode[], key: string): string[] {
  const keys: string[] = [];
  let node = findNode(nodes, key);
  while (node?.parent) {
    keys.unshift(node.parent);
    node = findNode(nodes, node.parent);
  }
  return keys;
}

/** What a node is called in the tree. */
export function nodeLabel(node: TreeNode): string {
  switch (node.kind) {
    case "image":
      return node.image.device
        ? node.image.id
        : node.image.path.slice(node.image.path.lastIndexOf("/") + 1);
    case "partition":
      return `${node.partition.label} (partition ${node.partition.index + 1})`;
    case "folder":
      return baseName(node.record.path);
  }
}
