/** POSIX-style path helpers. Purely lexical: nothing here looks at a filesystem or follows links. */

export const MAX_NAME_LENGTH = 255;

export const isAbsolute = (path: string): boolean => path.startsWith("/");

/** "/a//b/./c/" becomes ["a", "b", ".", "c"]. Keeps "." and ".." for the resolver to handle. */
export function splitPath(path: string): string[] {
  return path.split("/").filter((part) => part.length > 0);
}

/** ["a", "b"] becomes "/a/b"; [] becomes "/". */
export function joinPath(parts: readonly string[]): string {
  return `/${parts.join("/")}`;
}

/**
 * Lexically normalizes to an absolute path: relative paths start at `cwd`, "." is dropped and ".."
 * steps up, never above "/". Symlinks are not followed; use the resolver for that.
 */
export function normalizePath(path: string, cwd = "/"): string {
  const parts: string[] = isAbsolute(path) ? [] : splitPath(cwd);
  for (const part of splitPath(path)) {
    if (part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return joinPath(parts);
}

export function basename(path: string): string {
  const parts = splitPath(path);
  return parts[parts.length - 1] ?? "/";
}

export function dirname(path: string): string {
  const parts = splitPath(path);
  if (parts.length <= 1) return isAbsolute(path) ? "/" : ".";
  const parent = parts.slice(0, -1).join("/");
  return isAbsolute(path) ? `/${parent}` : parent;
}

/** A name a new file or directory may have: not empty, ".", or "..", and no "/" or NUL. */
export function isValidName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= MAX_NAME_LENGTH &&
    name !== "." &&
    name !== ".." &&
    !name.includes("/") &&
    !name.includes("\0")
  );
}
