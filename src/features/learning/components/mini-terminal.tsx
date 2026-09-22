"use client";

import { useCallback, useState } from "react";
import { ObjectiveTick } from "@/components/ui/objective-tick";
import { getMiniTerminal, type MiniTerminalScenario } from "@/content/mini-terminals";
import type { MiniTerminalProps } from "@/content/schemas/lesson-components";
import { Terminal, useTerminalSession } from "@/features/terminal";
import type { SimEvent } from "@/sim/types";
import { GlossaryText } from "../glossary/glossary-text";

/**
 * A terminal inside a lesson: the real phase 05 terminal, running the real engine, on one of the
 * tiny practice machines in src/content/mini-terminals.ts. There is no second, simpler terminal:
 * whatever a lesson shows here works the same way in a mission.
 *
 * With `expect`, the lesson's small exercise ticks with its success line once that command works.
 * Nothing is kept: leaving the page or pressing Reset machine starts it fresh.
 */
export function MiniTerminalView(props: MiniTerminalProps) {
  const mini = getMiniTerminal(props.scenario);
  if (!mini) throw new Error(`<MiniTerminal> has no practice machine called "${props.scenario}".`);
  return <MiniTerminalSession mini={mini} {...props} />;
}

function MiniTerminalSession({
  mini,
  commands,
  task,
  expect,
  success,
}: MiniTerminalProps & { mini: MiniTerminalScenario }) {
  const [done, setDone] = useState(false);
  const onEvents = useCallback(
    (events: readonly SimEvent[]) => {
      if (
        expect !== undefined &&
        events.some(
          (event) =>
            event.type === "command.run" && event.command === expect && event.exitCode === 0,
        )
      ) {
        setDone(true);
      }
    },
    [expect],
  );
  const session = useTerminalSession({ scenario: mini.scenario, seed: mini.seed, onEvents });

  return (
    <figure className="mt-8">
      <figcaption className="mb-3">
        <p className="text-sm font-semibold text-accent">Try it in a practice terminal</p>
        {task !== undefined && expect === undefined && (
          <p className="mt-1 text-lg leading-8 text-primary">
            <GlossaryText text={task} />
          </p>
        )}
      </figcaption>
      {task !== undefined && expect !== undefined && success !== undefined && (
        <ul className="mb-3">
          <ObjectiveTick
            {...(done
              ? ({
                  status: "done",
                  success: (
                    <span>
                      <GlossaryText text={success} />
                    </span>
                  ),
                } as const)
              : ({ status: "open" } as const))}
          >
            <GlossaryText text={task} />
          </ObjectiveTick>
        </ul>
      )}
      <Terminal session={session} title={mini.title} chips={commands} outputClassName="h-56" />
    </figure>
  );
}
