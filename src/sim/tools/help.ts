import { stdout } from "../core/output";
import type { OutputLine } from "../core/types";
import type { ToolHelp } from "./types";

/** Every tool's help carries the same simulation notice. */
export const SIMULATED_NOTICE =
  "SIMULATED: this tool only works inside Incident Room's practice network. It never contacts a real computer.";

/** Renders a tool's help as terminal lines: one-liner first, then detail, then the concept. */
export function renderHelp(name: string, help: ToolHelp): OutputLine[] {
  const lines: string[] = [`${name} - ${help.oneLiner}`, "", SIMULATED_NOTICE, "", "USAGE"];
  lines.push(...help.usage.map((usage) => `  ${usage}`));
  lines.push("", "WHAT IT DOES", ...help.description.map((paragraph) => `  ${paragraph}`));
  if (help.options?.length) {
    const width = Math.max(...help.options.map((option) => option.flags.length));
    lines.push("", "OPTIONS");
    for (const option of help.options)
      lines.push(`  ${option.flags.padEnd(width + 3)}${option.text}`);
  }
  if (help.examples?.length) {
    lines.push("", "EXAMPLES");
    for (const example of help.examples)
      lines.push(`  ${example.command}`, `      ${example.text}`);
  }
  lines.push("", "WHY IT MATTERS", ...help.concept.map((paragraph) => `  ${paragraph}`));
  return lines.map(stdout);
}

const INDENT = "       ";
const DEEP_INDENT = "              ";

/**
 * Renders a tool's manual page, laid out like `man`: NAME (the plain-language one-liner, readable
 * in five seconds), SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, and CONCEPT, which says why the
 * command matters in security work. That last section is what makes it a teaching tool.
 */
export function renderManPage(name: string, help: ToolHelp): OutputLine[] {
  const title = `${name.toUpperCase()}(1)`;
  const middle = "Candlewright: Incident Room manual";
  const gap = Math.max(2, Math.floor((72 - title.length * 2 - middle.length) / 2));
  const lines: string[] = [
    `${title}${" ".repeat(gap)}${middle}${" ".repeat(gap)}${title}`,
    "",
    "NAME",
    `${INDENT}${name} - ${help.oneLiner}`,
    "",
    "SYNOPSIS",
    ...help.usage.map((usage) => `${INDENT}${usage}`),
    "",
    "DESCRIPTION",
  ];
  help.description.forEach((paragraph, i) => {
    if (i > 0) lines.push("");
    lines.push(`${INDENT}${paragraph}`);
  });
  if (help.options?.length) {
    lines.push("", "OPTIONS");
    help.options.forEach((option, i) => {
      if (i > 0) lines.push("");
      lines.push(`${INDENT}${option.flags}`, `${DEEP_INDENT}${option.text}`);
    });
  }
  if (help.examples?.length) {
    lines.push("", "EXAMPLES");
    help.examples.forEach((example, i) => {
      if (i > 0) lines.push("");
      lines.push(`${INDENT}${example.command}`, `${DEEP_INDENT}${example.text}`);
    });
  }
  lines.push("", "CONCEPT");
  help.concept.forEach((paragraph, i) => {
    if (i > 0) lines.push("");
    lines.push(`${INDENT}${paragraph}`);
  });
  lines.push(
    "",
    "SIMULATED",
    `${INDENT}${SIMULATED_NOTICE.replace(/^SIMULATED: /, "")}`,
    "",
    title,
  );
  return lines.map(stdout);
}
