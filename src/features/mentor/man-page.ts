import { defaultRegistry } from "@/sim";
import type { ExplainManPage } from "./prompts/explain.v1";

/**
 * A tool's manual page, as plain text for the "Explain this" prompt (docs/plan/14-mentor.md §Spec:
 * it "sends the line's rendered text and the tool's man page, not the evidence set").
 *
 * This is the forensics game's own addition to the vendored mentor (VENDORED.md): the sibling's
 * "Explain this" gave the model the mission's title and the learner's line, and nothing about the
 * tool. Here a line of `lsfs` or `logq` output is mostly columns, and the words that explain those
 * columns already exist — in the tool's own `help`, written for a beginner, with a "Real-world
 * equivalent" section (docs/plan/04-disk-tools.md). Handing over that instead of the evidence means
 * the model is reading documentation, not the case.
 *
 * It is read from the registry by name, so nothing a player types is evaluated and an unknown
 * command simply has no page. Only the tool's own words travel: never a case, never an evidence
 * set, never an answer.
 */

/** The first word of a command line, if it looks like a command name at all. */
export function commandName(line: string): string | undefined {
  const name = line.trim().split(/\s+/)[0];
  return name !== undefined && /^[a-z][a-z0-9-]{0,31}$/.test(name) ? name : undefined;
}

/**
 * How much of a man page travels, in characters. Long enough for the columns and the real-world
 * names, short enough to stay cheap: a hint costs a fraction of a cent, and an explanation should
 * too.
 */
const MAX_MAN_CHARS = 2_400;

const BREAK = "\n\n";

/** Cuts a section to `max` characters, on a paragraph break where it can, marking that it was cut. */
function fit(text: string, max: number): string {
  if (max <= 0) return "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const paragraph = cut.lastIndexOf(BREAK);
  return `${(paragraph > max / 2 ? cut.slice(0, paragraph) : cut).trimEnd()}…`;
}

/**
 * The man page for the tool a command line ran, rendered as plain text. Undefined when the line
 * names no tool this workstation has.
 *
 * `renderManPage` (src/sim/tools/help.ts) is the terminal's own renderer and returns coloured
 * output lines; this builds the same sections as plain text, because a prompt wants words, not
 * colour codes.
 *
 * The short, high-value sections — what it does, how to run it, its options, its examples and the
 * **Real-world equivalent** — are always kept whole. Only the two prose sections are trimmed, and
 * only by as much as the budget needs, so the part a beginner most wants ("this stands in for
 * Autopsy's file view") is never the thing that falls off the end.
 */
export function manPageFor(commandLine: string): ExplainManPage | undefined {
  const name = commandName(commandLine);
  if (name === undefined) return undefined;
  const tool = defaultRegistry.get(name);
  if (!tool) return undefined;

  const { help } = tool;
  const oneLiner = `${name} — ${help.oneLiner}`;
  const usage =
    help.usage.length > 0 ? `Usage:\n${help.usage.map((line) => `  ${line}`).join("\n")}` : "";

  const reference: string[] = [];
  if (help.options && help.options.length > 0) {
    reference.push(
      `Options:\n${help.options.map((option) => `  ${option.flags}  ${option.text}`).join("\n")}`,
    );
  }
  if (help.examples && help.examples.length > 0) {
    reference.push(
      `Examples:\n${help.examples
        .map((example) => `  ${example.command}\n    ${example.text}`)
        .join("\n")}`,
    );
  }
  if (help.realWorld && help.realWorld.length > 0) {
    reference.push(
      `Real-world equivalent:\n${help.realWorld.map((line) => `  ${line}`).join("\n")}`,
    );
  }

  // Whatever the always-kept sections leave over, shared between the two prose ones. Both can end
  // up empty on a tool with a very long options table, and the page is still worth sending.
  const kept = [oneLiner, usage, ...reference].filter(Boolean).join(BREAK);
  const spare = Math.max(0, MAX_MAN_CHARS - kept.length);
  const description = fit(help.description.join("\n"), Math.floor(spare * 0.6));
  const concept = fit(help.concept.join("\n"), spare - description.length);

  // What it does, how to run it, what it means, then the reference sections.
  const parts = [
    oneLiner,
    usage,
    description,
    concept.trim() === "" ? "" : `Why it matters:\n${concept}`,
    ...reference,
  ];
  return {
    command: name,
    text: parts
      .filter((part) => part.trim() !== "")
      .join(BREAK)
      .trim(),
  };
}
