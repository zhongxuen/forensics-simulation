"use client";

import { Callout } from "@/components/ui/callout";
import { WORKSTATION } from "@/content/sandbox/workstation";
import { CommandCheatSheet, Terminal, useTerminalSession } from "@/features/terminal";

/**
 * The sandbox: the terminal on the analyst workstation, with no objectives. Nothing is kept
 * between visits.
 */
export function SandboxWorkspace() {
  const session = useTerminalSession({ scenario: WORKSTATION.scenario, seed: WORKSTATION.seed });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        <Terminal session={session} outputClassName="h-[28rem]" />
      </div>

      <aside className="space-y-6" aria-label="Help for this machine">
        <Callout kind="tip" title="Nothing can break here. Try anything.">
          <p>
            This is a practice copy of your workstation. Delete things, change things, get lost:
            Reset machine puts everything back.
          </p>
        </Callout>
        <section
          aria-labelledby="try-this-title"
          className="rounded-xl border border-subtle bg-surface-raised p-4"
        >
          <h2 id="try-this-title" className="text-sm font-semibold tracking-wide">
            Try this first
          </h2>
          <ul className="mt-3 space-y-3">
            {WORKSTATION.tryThis.map((idea) => (
              <li key={idea.command}>
                <code className="font-mono text-sm text-accent">{idea.command}</code>
                <p className="text-sm leading-6 text-secondary">{idea.why}</p>
              </li>
            ))}
          </ul>
        </section>
        <CommandCheatSheet />
      </aside>
    </div>
  );
}
