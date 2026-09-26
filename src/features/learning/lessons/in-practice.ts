/**
 * The case a lesson's "In practice" section sends the player to: the first `/cases/<id>` link in
 * that section, so the button at the foot of the lesson always matches what the section says.
 * Undefined when the section is missing or names no case.
 */
export function inPracticeCaseId(body: string): string | undefined {
  const section = body
    .split(/^## /m)
    .find((part) => /^In practice\s*$/.test(part.split("\n")[0] ?? ""));
  return section?.match(/\]\(\/cases\/([a-z0-9-]+)\)/)?.[1];
}
