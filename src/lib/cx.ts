/** Join class names, skipping falsy parts: `cx("a", isOn && "b")`. */
export function cx(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
