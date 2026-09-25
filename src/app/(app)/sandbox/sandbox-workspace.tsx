"use client";

import { use, useMemo } from "react";
import { Callout } from "@/components/ui/callout";
import { CommandCheatSheet, Terminal, useTerminalSession } from "@/features/terminal";
import { attachEvidence } from "@/sim";
import type { EvidenceSet, ScenarioSpec } from "@/sim/types";

export interface SandboxWorkspaceProps {
  /** The workstation with the sandbox's folder, built on the server from `sandbox.yaml`. */
  readonly scenario: ScenarioSpec;
  readonly seed: number;
  /** When the kit was handed over: the workstation's clock, and the evidence's `now`. */
  readonly startsAt: number;
  readonly tryThis: readonly { readonly command: string; readonly why: string }[];
}

let pending: Promise<EvidenceSet> | undefined;

/**
 * The sandbox's evidence (src/content/sandbox/evidence.json, built by `pnpm evidence:build`), in
 * a chunk of its own that only this page asks for (00 §4 row 12). One promise, shared by every
 * render.
 */
function sandboxEvidence(): Promise<EvidenceSet> {
  pending ??= import("@/content/sandbox/evidence.json").then((loaded: unknown) => {
    // A JSON module is the value itself under `default`, whichever way the bundler wrapped it.
    const set =
      typeof loaded === "object" && loaded !== null && "default" in loaded
        ? loaded.default
        : loaded;
    return set as EvidenceSet;
  });
  return pending;
}

/**
 * The sandbox: the terminal on the analyst workstation with the practice kit attached under
 * `/dev/evidence`, every write-blocker on, and no objectives. Reset machine attaches it again, as
 * it arrived. Nothing is kept between visits.
 */
export function SandboxWorkspace({ scenario, seed, startsAt, tryThis }: SandboxWorkspaceProps) {
  const evidence = use(sandboxEvidence());
  const setup = useMemo(
    () => (sim: Parameters<typeof attachEvidence>[0]) =>
      attachEvidence(sim, evidence, { now: startsAt }),
    [evidence, startsAt],
  );
  const session = useTerminalSession({ scenario, seed, setup });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        <Terminal session={session} outputClassName="h-[28rem]" />
      </div>

      <aside className="space-y-6" aria-label="Help for this machine">
        <Callout kind="tip" title="Nothing can break here. Try anything.">
          <p>
            Turn a write-blocker off, read the original, change the drive&apos;s hash: Reset machine
            puts the evidence back as it arrived.
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
            {tryThis.map((idea) => (
              <li key={idea.command}>
                <code className="font-mono text-sm break-words text-accent">{idea.command}</code>
                <p className="text-sm leading-6 text-secondary">{idea.why}</p>
              </li>
            ))}
          </ul>
        </section>
        <CommandCheatSheet leadWith="Investigate" />
      </aside>
    </div>
  );
}
