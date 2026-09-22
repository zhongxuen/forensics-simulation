"use client";

import { useEffect, useId, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cx } from "@/lib/cx";

type MotionMode = "settings" | "full" | "reduce";

const OPTIONS: ReadonlyArray<{ mode: MotionMode; label: string }> = [
  { mode: "settings", label: "Follow my settings" },
  { mode: "full", label: "Full motion" },
  { mode: "reduce", label: "Reduced motion" },
];

/**
 * Simulates the prefers-reduced-motion media query for the whole page, by setting data-motion on
 * <html> (src/styles/motion.css). "Follow my settings" leaves whatever the Animations setting put
 * there (src/lib/settings), and choosing it again, or leaving the page, puts that value back.
 */
export function MotionToggle() {
  const [mode, setMode] = useState<MotionMode>("settings");
  const reduced = useReducedMotion();
  const name = useId();

  useEffect(() => {
    if (mode === "settings") return;
    const root = document.documentElement;
    const saved = root.dataset.motion;
    root.dataset.motion = mode;
    return () => {
      if (saved === undefined) delete root.dataset.motion;
      else root.dataset.motion = saved;
    };
  }, [mode]);

  return (
    <fieldset className="rounded-lg border border-subtle px-4 pt-2 pb-3">
      <legend className="px-1 text-sm font-semibold text-secondary">Motion</legend>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <label
            key={option.mode}
            className={cx(
              "relative cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium",
              "has-checked:border-accent has-checked:bg-accent-subtle has-checked:text-primary",
              "border-subtle text-secondary hover:border-strong hover:text-primary",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.mode}
              checked={mode === option.mode}
              onChange={() => setMode(option.mode)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted" aria-live="polite">
        {reduced
          ? "Decorative motion is off. Celebrations show their finished, still version."
          : "Decorative motion is on."}
      </p>
    </fieldset>
  );
}
