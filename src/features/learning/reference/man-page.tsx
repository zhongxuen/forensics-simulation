import { cx } from "@/lib/cx";
import { defaultRegistry, renderManPage } from "@/sim";

/** Whether the terminal has a command by this name (and so a manual page). */
export function hasManPage(name: string): boolean {
  return defaultRegistry.has(name);
}

/** A command's one-line summary, from its manual page, as a sentence of its own. */
export function manPageSummary(name: string): string | undefined {
  const oneLiner = defaultRegistry.get(name)?.help.oneLiner;
  // One-liners are written to follow "netscan - ", so they start in lower case.
  return oneLiner && oneLiner.charAt(0).toUpperCase() + oneLiner.slice(1);
}

/**
 * A command's manual page, exactly as `man <name>` prints it in the terminal: the same words from
 * the same engine, so the reference never drifts from what the terminal says. Every page carries
 * the SIMULATED notice.
 */
export function ManPage({ name, className }: { name: string; className?: string }) {
  const tool = defaultRegistry.get(name);
  if (!tool) return null;
  return (
    <pre
      className={cx(
        "overflow-x-auto rounded-lg border border-subtle bg-term-bg p-4 font-mono text-sm leading-6 whitespace-pre-wrap text-term-fg",
        className,
      )}
    >
      {renderManPage(name, tool.help)
        .map((line) => line.text)
        .join("\n")}
    </pre>
  );
}
