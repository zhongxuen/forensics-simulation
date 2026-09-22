import type { ReactNode } from "react";

export const SPECIMEN_STATES = [
  "default",
  "hover",
  "focus",
  "disabled",
  "loading",
  "error",
] as const;

export type SpecimenState = (typeof SPECIMEN_STATES)[number];

const STATE_LABELS: Readonly<Record<SpecimenState, string>> = {
  default: "Default · live",
  hover: "Hover",
  focus: "Keyboard focus",
  disabled: "Disabled",
  loading: "Loading",
  error: "Error",
};

/**
 * States drawn by CSS pseudo-classes, frozen with data-force-state (src/styles/globals.css). The
 * others come from the component's own props, through `render`.
 */
const FORCED_STATES: Partial<Record<SpecimenState, string>> = { hover: "hover", focus: "focus" };

export interface SpecimenVariant {
  label: string;
  /**
   * The component in `state`. Hover and focus are applied from outside, so a render only needs to
   * act on the states its props control (disabled, loading, error).
   */
  render: (state: SpecimenState) => ReactNode;
}

/**
 * The same component twice, in full motion and in reduced motion, whatever the page's motion
 * setting: the nearest data-motion attribute wins (src/styles/motion.css).
 */
export function motionVariants(
  render: (state: SpecimenState) => ReactNode,
  label?: string,
): SpecimenVariant[] {
  const prefix = label === undefined ? "" : `${label} · `;
  return [
    {
      label: `${prefix}Full motion`,
      render: (state) => <div data-motion="full">{render(state)}</div>,
    },
    {
      label: `${prefix}Reduced motion`,
      render: (state) => <div data-motion="reduce">{render(state)}</div>,
    },
  ];
}

interface SpecimenProps {
  name: string;
  /** The file the component lives in. */
  source: string;
  /** What it is and where it's used. */
  children: ReactNode;
  variants: readonly SpecimenVariant[];
  /** States the component doesn't have, each with the reason. Every other state is drawn. */
  without: Partial<Record<SpecimenState, string>>;
}

/** One component: each variant drawn in each of its states, and the states it has none of, and why. */
export function Specimen({ name, source, children, variants, without }: SpecimenProps) {
  const drawn = SPECIMEN_STATES.filter((state) => without[state] === undefined);

  // States that share a reason are listed together.
  const skipped = new Map<string, SpecimenState[]>();
  for (const state of SPECIMEN_STATES) {
    const reason = without[state];
    if (reason !== undefined) skipped.set(reason, [...(skipped.get(reason) ?? []), state]);
  }

  return (
    <article className="rounded-xl border border-subtle p-5 sm:p-6">
      <h3 className="text-lg font-semibold">{name}</h3>
      <p className="mt-0.5 font-mono text-xs text-muted">{source}</p>
      <div className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{children}</div>

      {variants.map((variant) => (
        <div key={variant.label} className="mt-6">
          {variants.length > 1 && (
            <h4 className="text-sm font-semibold text-secondary">{variant.label}</h4>
          )}
          <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-6">
            {drawn.map((state) => (
              <figure key={state} className="max-w-full min-w-0">
                <figcaption className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  {STATE_LABELS[state]}
                </figcaption>
                {/* Only the default copy is live. The rest are pictures: out of the tab order and
                    the accessibility tree, and deaf to the pointer. */}
                <div data-force-state={FORCED_STATES[state]} inert={state !== "default"}>
                  {variant.render(state)}
                </div>
              </figure>
            ))}
          </div>
        </div>
      ))}

      {skipped.size > 0 && (
        <dl className="mt-6 space-y-1.5 border-t border-subtle pt-4 text-sm leading-6">
          {[...skipped].map(([reason, states]) => (
            <div key={reason} className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-secondary">
                No {states.map((state) => STATE_LABELS[state].toLowerCase()).join(", ")} state:
              </dt>
              <dd className="text-muted">{reason}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
