/**
 * The Evidence Browser's way in (docs/plan/05-workspace-ui.md §Evidence Browser).
 *
 * The browser is a view, not a second disk tool: it never reads an image itself. Listing what it
 * can open reads only the session, and opening an image goes through exactly the calls the disk
 * tools make (`findImage`, then `openImage`), so an original is read the way its write-blocker
 * says. With the blocker off, opening the original in the browser changes it just as `lsfs` would,
 * and says so. The view it hands back is the one thing the browser draws from.
 */
import { err, ok, type Result } from "../../core/result";
import type { SimError } from "../../core/errors";
import { sessionFs } from "../../core/session";
import type { SimEvent, SimState } from "../../core/types";
import type { DiskView } from "../../evidence/disk";
import { isEvidencePath, type AttachedItem } from "../../evidence/session";
import type { DiskImage, Instant } from "../../evidence/types";
import { findImage, openImage, requireEvidence } from "./shared";

/** What the browser calls itself in the events it causes, where a tool would give its name. */
export const BROWSER_TOOL = "evidence-browser";

/** One image the browser can open: an original device, or a working copy `acquire` wrote. */
export interface BrowsableImage {
  /** Canonical workstation path: what `browseImage` takes. */
  readonly path: string;
  /** The image's id, which is the device's name: "qf-lt-07". */
  readonly id: string;
  /** The device and its write-blocker, when this is the original rather than a copy. */
  readonly device?: AttachedItem;
  /** The image as it stands right now. Compare it with a view's `image` to tell a stale view. */
  readonly image: DiskImage;
}

/**
 * Every image the browser can open, originals first, then working copies, each group in path
 * order. Reads the session only: nothing is opened, so nothing changes.
 */
export function browsableImages(state: SimState): readonly BrowsableImage[] {
  const session = state.evidence;
  if (!session) return [];
  const entries = Object.entries(session.images).map(([path, image]): BrowsableImage => {
    const device = Object.values(session.attached).find((item) => item.path === path);
    return { path, id: image.id, image, ...(device ? { device } : {}) };
  });
  const byPath = (x: BrowsableImage, y: BrowsableImage) => (x.path < y.path ? -1 : 1);
  return [
    ...entries.filter((entry) => isEvidencePath(entry.path)).sort(byPath),
    ...entries.filter((entry) => !isEvidencePath(entry.path)).sort(byPath),
  ];
}

/** An image opened for browsing, and what opening it cost. */
export interface BrowsedImage {
  /** The state after the read: unchanged, unless an original was read with its blocker off. */
  readonly state: SimState;
  /** The read view the browser draws from. */
  readonly view: DiskView;
  readonly events: readonly SimEvent[];
  /** Set when the read went around the write-blocker: the tools' own warning, line by line. */
  readonly warning?: readonly string[];
}

/**
 * Opens the image at `path` for browsing, at in-world time `now`, the same way a disk tool would.
 * Fails with the tools' own errors: no evidence attached, or nothing to open at that path.
 */
export function browseImage(
  state: SimState,
  path: string,
  now: Instant,
): Result<BrowsedImage, SimError> {
  const session = requireEvidence(state);
  if (!session.ok) return err(session.error);
  const fs = sessionFs(state, now);
  const target = findImage(session.value, fs.vfs, fs.ctx, path);
  if (!target.ok) return err(target.error);
  const opened = openImage(state, target.value, BROWSER_TOOL, now);
  return ok({
    state: opened.state,
    view: opened.view,
    events: opened.events,
    ...(opened.warning ? { warning: opened.warning } : {}),
  });
}
