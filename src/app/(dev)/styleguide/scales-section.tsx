import { cx } from "@/lib/cx";
import { Code, Section } from "./styleguide-ui";

/** Tailwind theme variables, keyed without the dashes (`text-sm`, `spacing`). */
type ThemeValues = ReadonlyMap<string, string>;

// Class names are spelled out in full so Tailwind finds and generates them.
const TYPE_STEPS = [
  { step: "xs", className: "text-xs" },
  { step: "sm", className: "text-sm" },
  { step: "base", className: "text-base" },
  { step: "lg", className: "text-lg" },
  { step: "xl", className: "text-xl" },
  { step: "2xl", className: "text-2xl" },
  { step: "3xl", className: "text-3xl" },
  { step: "4xl", className: "text-4xl" },
  { step: "5xl", className: "text-5xl" },
  { step: "6xl", className: "text-6xl" },
  { step: "7xl", className: "text-7xl" },
  { step: "8xl", className: "text-8xl" },
  { step: "9xl", className: "text-9xl" },
] as const;

/** The monospace range: terminal output, hostnames, ports, hashes. */
const MONO_STEPS = TYPE_STEPS.slice(0, 6);

const WEIGHTS = [
  { name: "normal", className: "font-normal" },
  { name: "medium", className: "font-medium" },
  { name: "semibold", className: "font-semibold" },
  { name: "bold", className: "font-bold" },
] as const;

/** Tailwind's conventional spacing steps. Any multiple of --spacing works; these are the usual. */
const SPACING_STEPS = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44,
  48, 52, 56, 60, 64, 72, 80, 96,
] as const;

/** Browsers' default root font size, which the app doesn't change. */
const ROOT_PX = 16;

/** `0.875rem` → 0.875. Undefined for any other form. */
function remValue(value: string | undefined): number | undefined {
  const [, rem] = /^(\d*\.?\d+)rem$/.exec(value ?? "") ?? [];
  return rem === undefined ? undefined : Number(rem);
}

/** A unitless line height, as Tailwind writes them: `1` or `calc(1.25 / 0.875)`. */
function lineHeightRatio(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const [, top, bottom] = /^calc\(\s*(\d*\.?\d+)\s*\/\s*(\d*\.?\d+)\s*\)$/.exec(value) ?? [];
  if (top !== undefined && bottom !== undefined) return Number(top) / Number(bottom);
  return /^\d*\.?\d+$/.test(value) ? Number(value) : undefined;
}

/** Trims float noise: 20.000000000000004 → "20". */
const px = (value: number) => `${Number(value.toFixed(2))}px`;

export function TypeScaleSection({ id, theme }: { id: string; theme: ThemeValues }) {
  return (
    <Section
      id={id}
      title="Type scale"
      intro={
        <p>
          Tailwind&apos;s default type scale, read from its theme. Geist Sans for prose, Geist Mono
          for anything data-shaped. Prose is <Code>text-base</Code> (16px) or larger; the smaller
          steps are for labels, subtitles, and small print.
        </p>
      }
    >
      <div className="divide-y divide-subtle border-y border-subtle">
        {TYPE_STEPS.map(({ step, className }) => {
          const rem = remValue(theme.get(`text-${step}`));
          const ratio = lineHeightRatio(theme.get(`text-${step}--line-height`));
          return (
            <div
              key={step}
              className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-4 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"
            >
              <div>
                <Code>{className}</Code>
                <p className="mt-1 text-xs leading-5 text-muted tabular-nums">
                  {rem === undefined ? "Not in the theme" : `${px(rem * ROOT_PX)} · ${rem}rem`}
                  {rem !== undefined && ratio !== undefined && (
                    <>
                      <br />
                      line height {px(rem * ROOT_PX * ratio)}
                    </>
                  )}
                </p>
              </div>
              <p className={cx(className, "truncate")}>You found a hidden file.</p>
            </div>
          );
        })}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold">Monospace</h3>
          <div className="mt-4 space-y-3">
            {MONO_STEPS.map(({ step, className }) => (
              <div
                key={step}
                className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-4"
              >
                <Code>{className}</Code>
                <p className={cx(className, "truncate font-mono")}>ls -la /home/recruit</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold">Weights</h3>
          <div className="mt-4 space-y-3">
            {WEIGHTS.map(({ name, className }) => (
              <div key={name} className="grid grid-cols-[10rem_minmax(0,1fr)] items-baseline gap-4">
                <span>
                  <Code>{className}</Code>
                  <span className="ml-2 text-xs text-muted tabular-nums">
                    {theme.get(`font-weight-${name}`)}
                  </span>
                </span>
                <p className={cx(className, "truncate text-lg")}>You found a hidden file.</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

export function SpacingScaleSection({ id, theme }: { id: string; theme: ThemeValues }) {
  const unit = theme.get("spacing");
  const unitRem = remValue(unit);

  return (
    <Section
      id={id}
      title="Spacing scale"
      intro={
        <p>
          Every spacing class is one unit, <Code>--spacing</Code> ({unit ?? "not in the theme"}),
          times a number: <Code>p-4</Code>, <Code>gap-4</Code> and <Code>w-4</Code> are all 4 units.
          Any number works; these are the conventional steps.
        </p>
      }
    >
      <div className="divide-y divide-subtle border-y border-subtle">
        {SPACING_STEPS.map((step) => (
          <div
            key={step}
            className="grid grid-cols-[3rem_7.5rem_minmax(0,1fr)] items-center gap-4 py-2"
          >
            <Code>{step}</Code>
            <span className="text-xs text-muted tabular-nums">
              {unitRem === undefined
                ? `${step} × ${unit ?? "?"}`
                : `${px(step * unitRem * ROOT_PX)} · ${Number((step * unitRem).toFixed(4))}rem`}
            </span>
            <div className="overflow-hidden">
              <div
                className="h-3 rounded-xs bg-accent"
                style={{ width: `calc(var(--spacing) * ${step})` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
