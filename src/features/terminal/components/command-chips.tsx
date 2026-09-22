"use client";

import { useId } from "react";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";

interface CommandChipsProps {
  commands: readonly string[];
  /** Puts the command at the prompt. It never runs it: the learner still presses Enter. */
  onPick: (command: string) => void;
}

/** A row of suggested commands. Clicking one fills the prompt; Enter runs it. */
export function CommandChips({ commands, onPick }: CommandChipsProps) {
  const labelId = useId();
  if (commands.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 font-sans text-xs">
      <span className="text-term-dim" id={labelId}>
        Try:
      </span>
      <ul aria-labelledby={labelId} className="contents">
        {commands.map((command) => (
          <li key={command} className="contents">
            <button
              type="button"
              onClick={() => onPick(command)}
              title={`Put "${command}" at the prompt`}
              className={cx(
                "rounded-md border border-term-bright-black px-2 py-0.5 font-mono text-term-fg hover:border-term-cyan hover:text-term-bright-white",
                FOCUS_RING,
              )}
            >
              {command}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
