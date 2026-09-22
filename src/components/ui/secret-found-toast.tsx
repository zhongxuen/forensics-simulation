"use client";

import { useRef } from "react";
import { useSkippableEffects } from "@/hooks/use-skippable-effects";
import { cx } from "@/lib/cx";
import { Badge } from "./badge";
import { Button } from "./button";
import { CloseIcon, SparkleIcon } from "./icons";

interface SecretFoundToastProps {
  /** The secret's playful name, 1–3 words: "Hide and seek". */
  name: string;
  /** One plain line about what the learner found: "Found the hidden file." */
  description: string;
  /** Shows a Dismiss button. Leave out to let the page remove the toast itself. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * Shown when the learner finds a hidden secret. The card pops in; under reduced motion it simply
 * appears, badge and all. Any key skips the pop. Put it in a toast area near the edge of the
 * screen: it never takes focus.
 */
export function SecretFoundToast({
  name,
  description,
  onDismiss,
  className,
}: SecretFoundToastProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useSkippableEffects(rootRef);

  return (
    <div
      ref={rootRef}
      role="status"
      className={cx(
        "flex w-full max-w-sm animate-pop items-start gap-3 rounded-lg border border-reward bg-surface-overlay p-4 shadow-[0_12px_32px_-12px_var(--reward-glow)]",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <Badge tone="reward" appearance="solid" icon={<SparkleIcon />}>
          Secret found!
        </Badge>
        <p className="mt-2 font-semibold text-primary">{name}</p>
        <p className="mt-0.5 text-sm leading-6 text-secondary">{description}</p>
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          label="Dismiss"
          icon={<CloseIcon />}
          onClick={onDismiss}
          className="-mt-1 -mr-1"
        />
      )}
    </div>
  );
}
