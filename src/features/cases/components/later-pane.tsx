import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { PaneId } from "../workspace-panes";

/**
 * The tab of a pane that isn't built yet, as an empty state (99 §Voice: what will be here, why
 * it's empty right now, one action). Files 09 and 10 register the real panes, and this goes.
 */
const COPY: Readonly<Partial<Record<PaneId, { title: string; description: string }>>> = {
  timeline: {
    title: "Your timeline will be here",
    description:
      "Every file time, log record and process from the evidence, in one line, so you can see what happened in what order. It arrives in a later update. Until then, the terminal and the Evidence tab show each time on its own.",
  },
  board: {
    title: "Your case board will be here",
    description:
      "The findings you pin, laid out so you can see how they connect, ready for your report. It arrives in a later update. Pins you make are already kept with this case.",
  },
};

interface LaterPaneProps {
  id: PaneId;
  /** Show the Objectives tab, the one thing to do instead. */
  onShowObjectives: () => void;
  /** How many findings are pinned so far, for the board. */
  pins: number;
}

export function LaterPane({ id, onShowObjectives, pins }: LaterPaneProps) {
  const copy = COPY[id] ?? {
    title: "This view will be here",
    description: "It arrives in a later update.",
  };
  return (
    <EmptyState
      titleAs="h3"
      title={copy.title}
      description={
        id === "board" && pins > 0
          ? `${copy.description} You've pinned ${pins === 1 ? "1 finding" : `${pins} findings`} so far.`
          : copy.description
      }
      action={
        <Button variant="secondary" onClick={onShowObjectives}>
          Show your objectives
        </Button>
      }
    />
  );
}
