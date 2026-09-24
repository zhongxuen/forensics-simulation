import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { PaneId } from "../workspace-panes";

/**
 * The tab of a pane that isn't built yet, as an empty state (99 §Voice: what will be here, why
 * it's empty right now, one action). Every pane in PANE_ORDER is registered now (file 10 the
 * Board, file 09 the Timeline), so this only shows if a new pane id is added before its pane.
 */
const COPY: Readonly<Partial<Record<PaneId, { title: string; description: string }>>> = {};

interface LaterPaneProps {
  id: PaneId;
  /** Show the Objectives tab, the one thing to do instead. */
  onShowObjectives: () => void;
}

export function LaterPane({ id, onShowObjectives }: LaterPaneProps) {
  const copy = COPY[id] ?? {
    title: "This view will be here",
    description: "It arrives in a later update.",
  };
  return (
    <EmptyState
      titleAs="h3"
      title={copy.title}
      description={copy.description}
      action={
        <Button variant="secondary" onClick={onShowObjectives}>
          Show your objectives
        </Button>
      }
    />
  );
}
