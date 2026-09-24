import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { CloseIcon } from "@/components/ui/icons";
import { MENTOR } from "@/content/cast";
import { cx } from "@/lib/cx";
import { MENTOR_FIRST_NAME } from "./mentor-bubble";

interface NudgeChipProps {
  /** The player said yes: open the mentor panel on the step they're on. */
  onAccept: () => void;
  /** Hide the chip until the player's next tick. */
  onDismiss: () => void;
  className?: string;
}

/**
 * "Want a nudge?" (docs/plan/14-mentor.md): a small, dismissible offer that appears
 * when the player seems stuck. It never takes focus and never opens anything by itself; pressing it
 * is the player asking. Put it in the ToastViewport, so it's read out politely and never covers
 * the terminal's prompt. The setting on /settings turns it off.
 */
export function NudgeChip({ onAccept, onDismiss, className }: NudgeChipProps) {
  return (
    <div
      className={cx(
        "pointer-events-auto flex animate-fade-in items-center gap-1 rounded-full border border-accent bg-surface-overlay py-1 pr-1 pl-1 text-primary shadow-xl",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-accent bg-accent-subtle font-mono text-xs font-semibold text-accent"
      >
        {MENTOR.initials}
      </span>
      <button
        type="button"
        onClick={onAccept}
        className={cx(
          "rounded-full px-2 py-1 font-semibold whitespace-nowrap hover:text-accent",
          FOCUS_RING,
        )}
      >
        Want a nudge?
        <span className="sr-only"> {MENTOR_FIRST_NAME} can give you a hint. Hints are free.</span>
      </button>
      <Button
        variant="ghost"
        size="sm"
        label="No thanks, hide this"
        icon={<CloseIcon />}
        onClick={onDismiss}
        className="rounded-full"
      />
    </div>
  );
}
