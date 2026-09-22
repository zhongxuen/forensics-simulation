import type { NodeKind } from "./types";

/** Permission bits beyond read/write/execute. */
export const SETUID = 0o4000;
export const SETGID = 0o2000;
/** On a directory: only a file's owner (or root) may delete or rename it. /tmp has this set. */
export const STICKY = 0o1000;

export const MODE_MASK = 0o7777;
/** The default umask: new files get 0o644 and new directories 0o755. */
export const UMASK = 0o022;
export const DEFAULT_FILE_MODE = 0o666 & ~UMASK;
export const DEFAULT_DIR_MODE = 0o777 & ~UMASK;
export const SYMLINK_MODE = 0o777;

/** "644" or "1777" to a number. Anything that isn't 3-4 octal digits gives `undefined`. */
export function parseOctalMode(text: string): number | undefined {
  return /^[0-7]{3,4}$/.test(text) ? Number.parseInt(text, 8) : undefined;
}

/** 0o644 to "0644". */
export function formatOctal(mode: number): string {
  return (mode & MODE_MASK).toString(8).padStart(4, "0");
}

/** The ten-character mode string `ls -l` shows: "drwxr-xr-x", "-rw-r-----", "drwxrwxrwt". */
export function formatMode(kind: NodeKind, mode: number): string {
  const type = kind === "dir" ? "d" : kind === "symlink" ? "l" : "-";
  const triplet = (shift: number, special: number, specialChar: string) => {
    const bits = (mode >> shift) & 7;
    const r = bits & 4 ? "r" : "-";
    const w = bits & 2 ? "w" : "-";
    const hasX = (bits & 1) !== 0;
    const x = mode & special ? (hasX ? specialChar : specialChar.toUpperCase()) : hasX ? "x" : "-";
    return r + w + x;
  };
  return type + triplet(6, SETUID, "s") + triplet(3, SETGID, "s") + triplet(0, STICKY, "t");
}
