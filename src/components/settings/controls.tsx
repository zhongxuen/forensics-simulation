"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cx } from "@/lib/cx";
import { updateSettings, type Settings } from "@/lib/settings";

/**
 * The building blocks of /settings: a card per setting, a switch, and a radio group, all with one
 * plain-language line each. Features that own a setting (the terminal's look, say) build their card
 * from these and put it inside SettingsForm, so every row looks and behaves the same.
 */

/** Keyboard focus on a control that's visually hidden inside a label shows on the label. */
export const LABEL_FOCUS_RING =
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring";

/**
 * Changes settings from inside SettingsForm, so the form can say when this browser won't let it
 * save. Outside the form it saves directly.
 */
const ChangeSettingsContext = createContext<(changes: Partial<Settings>) => void>((changes) => {
  updateSettings(changes);
});

export const ChangeSettingsProvider = ChangeSettingsContext.Provider;

export function useChangeSettings(): (changes: Partial<Settings>) => void {
  return useContext(ChangeSettingsContext);
}

export function SettingCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card as="section" padding="lg">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 leading-7 text-secondary">{description}</p>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  detail: string;
}) {
  const id = useId();

  return (
    <label
      className={cx(
        "flex cursor-pointer items-start justify-between gap-6 rounded-lg border border-subtle bg-surface-overlay p-4 hover:border-strong",
        LABEL_FOCUS_RING,
      )}
    >
      <span className="min-w-0">
        <span id={`${id}-label`} className="block font-medium text-primary">
          {label}
        </span>
        <span id={`${id}-detail`} className="mt-1 block text-sm leading-6 text-secondary">
          {detail}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        // Named by the label alone; the detail is its description (the <label> wraps both).
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-detail`}
        className="peer sr-only"
      />
      {/* The track and its knob. The knob is the track's ::after, coloured with currentColor. */}
      <span
        aria-hidden="true"
        className={cx(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full border border-strong bg-surface-raised text-muted",
          "peer-checked:border-accent peer-checked:bg-accent peer-checked:text-surface-base",
          "after:absolute after:top-1 after:left-1 after:size-4.5 after:rounded-full after:bg-current",
          "after:transition-transform after:fx-duration-fast after:ease-(--ease-standard) peer-checked:after:translate-x-5",
        )}
      />
    </label>
  );
}

export interface RadioOption<Value extends string> {
  value: Value;
  label: string;
  detail: string;
  /** A small picture under the words, like a theme's colour swatches. Decorative. */
  sample?: ReactNode;
}

const COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function RadioGroup<Value extends string>({
  legend,
  value,
  options,
  onChange,
  columns = 3,
}: {
  legend: string;
  value: Value;
  options: ReadonlyArray<RadioOption<Value>>;
  onChange: (value: Value) => void;
  columns?: keyof typeof COLUMNS;
}) {
  const name = useId();

  return (
    <fieldset>
      <legend className="mb-3 font-medium text-primary">{legend}</legend>
      <div className={cx("grid gap-3", COLUMNS[columns])}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              "flex cursor-pointer gap-3 rounded-lg border border-subtle bg-surface-overlay p-4 hover:border-strong",
              "has-checked:border-accent has-checked:bg-accent-subtle",
              LABEL_FOCUS_RING,
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            {/* The radio's dot: a ring, filled when chosen. */}
            <span
              aria-hidden="true"
              className="mt-1 grid size-4.5 shrink-0 place-items-center rounded-full border-2 border-strong peer-checked:border-accent peer-checked:after:size-2 peer-checked:after:rounded-full peer-checked:after:bg-accent"
            />
            <span className="min-w-0">
              <span className="block font-medium text-primary">{option.label}</span>
              <span className="mt-1 block text-sm leading-6 text-secondary">{option.detail}</span>
              {option.sample}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
