"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ReplayProps {
  children: ReactNode;
  label?: string;
}

/** Shows `children`, with a button that mounts them again, so a one-off effect can be watched twice. */
export function Replay({ children, label = "Play again" }: ReplayProps) {
  const [run, setRun] = useState(0);

  return (
    <div className="flex flex-col items-start gap-3">
      <Fragment key={run}>{children}</Fragment>
      <Button size="sm" variant="ghost" onClick={() => setRun(run + 1)}>
        {label}
      </Button>
    </div>
  );
}
