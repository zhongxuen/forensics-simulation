import type { CSSProperties, ReactNode } from "react";
import { LOOP_STEPS } from "@/content/release";

/** Each step lights up this long after the one before it (the whole strip ends in 1.2 s). */
const STEP_DELAY_MS = 160;

/** Line drawings, 48 × 48, in the step's own colour. Decorative: each step's name says it. */
const PICTURES: readonly ReactNode[] = [
  // An evidence bag: a sealed pouch with a tag.
  <>
    <path d="M12 12h24l-2 28H14z" />
    <path d="M12 18h24" strokeDasharray="3 2" />
    <rect x="18" y="24" width="12" height="9" rx="1.5" />
    <path d="M21 28h6" />
  </>,
  // A terminal: a window with a prompt and a cursor.
  <>
    <rect x="7" y="10" width="34" height="28" rx="3" />
    <path d="M7 16h34" />
    <path d="m13 23 4 3-4 3" />
    <path d="M21 30h8" />
  </>,
  // A case board: a board with three pinned cards.
  <>
    <rect x="6" y="9" width="36" height="30" rx="3" />
    <rect x="11" y="15" width="10" height="8" rx="1" />
    <rect x="27" y="15" width="10" height="8" rx="1" />
    <rect x="19" y="27" width="10" height="8" rx="1" />
    <circle cx="16" cy="15" r="1.5" />
    <circle cx="32" cy="15" r="1.5" />
    <circle cx="24" cy="27" r="1.5" />
  </>,
  // A report: a page with lines and a tick.
  <>
    <path d="M13 7h16l7 7v27H13z" />
    <path d="M29 7v7h7" />
    <path d="M18 21h13M18 26h13M18 31h7" />
    <path d="m26 35 2.5 2.5L33 33" />
  </>,
];

/**
 * The game's loop in four pictures, evidence → terminal → case board → report (UIUX.md §2.2):
 * the one picture of the game a visitor sees before they start. Static SVG, no script. The steps
 * light up in order once and then stay lit (`animate-light-up`, UIUX.md §5); under reduced motion
 * they're lit from the start.
 */
export function LoopStrip() {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {LOOP_STEPS.map((step, index) => (
        <li
          key={step.title}
          className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface-raised p-4"
        >
          <span className="flex items-center justify-between">
            {/* Only the picture lights up: text never fades, so it's readable (and passes the
                contrast check) at every moment. */}
            <span
              style={{ "--light-delay": `${index * STEP_DELAY_MS}ms` } as CSSProperties}
              className="grid size-14 animate-light-up place-items-center rounded-lg border border-accent/40 bg-accent-subtle"
            >
              <svg
                viewBox="0 0 48 48"
                aria-hidden="true"
                focusable="false"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-10 text-accent"
              >
                {PICTURES[index]}
              </svg>
            </span>
            <span aria-hidden="true" className="type-data text-muted">
              {index + 1}
            </span>
          </span>
          <span>
            <span className="block font-semibold text-primary">{step.title}</span>
            <span className="mt-1 block type-small text-secondary">{step.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
