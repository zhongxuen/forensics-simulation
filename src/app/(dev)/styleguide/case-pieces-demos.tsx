"use client";

/**
 * Live demos for the "Case pieces" and "Motion" sections (UIUX.md, prompt UX.1). They need state
 * or callbacks, which a server component can't hand to client components.
 */

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { SplitPane } from "@/components/ui/split-pane";
import { cx } from "@/lib/cx";

/** The "⋯ Case" overflow menu, with what the player last picked written beneath it. */
export function MenuDemo({ withDisabled = false }: { withDisabled?: boolean }) {
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const items: MenuItem[] = [
    { id: "copy", label: "Copy transcript", onSelect: () => setPicked("Copy transcript") },
    {
      id: "export",
      label: "Export chain of custody",
      onSelect: () => setPicked("Export chain of custody"),
      disabled: withDisabled,
    },
    {
      id: "restart",
      label: "Start the case again",
      tone: "danger",
      onSelect: () => setPicked("Start the case again (its confirm dialog would open here)"),
    },
  ];

  return (
    <div className="flex min-h-48 flex-col items-start gap-3">
      <Menu label="Case" items={items} align="start" variant="secondary" />
      <p className="type-small text-muted" aria-live="polite">
        {picked === undefined ? "Nothing picked yet." : `Picked: ${picked}`}
      </p>
    </div>
  );
}

/** Two panes with a handle, and the handle's value written beneath them. */
export function SplitPaneDemo() {
  const [ratio, setRatio] = useState(50);

  return (
    <div className="w-2xl max-w-full">
      <SplitPane
        label="Resize the terminal and the case views"
        ratio={ratio}
        onRatioChange={setRatio}
        className="h-48 rounded-lg border border-subtle"
        start={
          <div className="h-full bg-term-bg p-3 font-mono text-sm text-term-fg">
            <p>
              <span className="text-term-green">examiner@ir-ws-01</span>:
              <span className="text-term-blue">~</span>$ blocker status
            </p>
            <p>write-blocker: on</p>
          </div>
        }
        end={
          <div className="h-full p-3">
            <p className="type-eyebrow">Objectives</p>
            <p className="mt-1 type-small text-secondary">Check the write-blocker.</p>
          </div>
        }
      />
      <p className="mt-2 type-small text-muted tabular-nums">Terminal width: {ratio}%</p>
    </div>
  );
}

/** A tab label with a count that pops each time it goes up. */
export function BadgePopDemo() {
  const [count, setCount] = useState(2);
  const [changed, setChanged] = useState(false);

  return (
    <div className="flex items-center gap-4">
      <span className="inline-flex items-center gap-2 type-small font-medium text-primary">
        Board
        <Badge tone="accent" popKey={changed ? count : undefined}>
          {count}
        </Badge>
      </span>
      <Button
        size="sm"
        onClick={() => {
          setCount(count + 1);
          setChanged(true);
        }}
      >
        Pin one more
      </Button>
    </div>
  );
}

/** Replays a one-off effect by remounting whatever it wraps. */
function Again({ children, label }: { children: (run: number) => ReactNode; label: string }) {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col items-start gap-3">
      {children(run)}
      <Button size="sm" variant="ghost" onClick={() => setRun(run + 1)}>
        {label}
      </Button>
    </div>
  );
}

/** A terminal line that flashes amber, as `pin` makes it do. */
export function LineFlashDemo() {
  return (
    <Again label="Pin it again">
      {(run) => (
        <div className="w-md max-w-full rounded-lg bg-term-bg p-3 font-mono text-sm text-term-fg">
          <p className="text-term-dim">$ lsfs /dev/evidence/qf-lt-03 --deleted</p>
          <p key={run} className={cx("rounded-sm px-1", run > 0 && "animate-line-flash")}>
            * 1234 Users/yard/Desktop/note.txt
          </p>
          <p className="px-1 text-term-dim">
            {run > 0 ? "Pinned to the board." : "Press the button to pin the line above."}
          </p>
        </div>
      )}
    </Again>
  );
}

/** The MATCH line, with its one pass of light. */
export function SweepDemo() {
  return (
    <Again label="Verify again">
      {(run) => (
        <div className="w-md max-w-full rounded-lg bg-term-bg p-3 font-mono text-sm text-term-fg">
          <p className="text-term-dim">$ hashsum --verify qf-lt-03.img</p>
          <p
            key={run}
            className="animate-sweep rounded-sm fx-sweep px-1 text-term-green [--sweep-colour:var(--status-success)]"
          >
            MATCH ✓ sha256 agrees with the handover form
          </p>
        </div>
      )}
    </Again>
  );
}
