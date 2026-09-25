import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { customPropertiesIn, parseCustomProperties } from "@/lib/css-custom-properties";

/**
 * The motion policy in src/styles/motion.css (md-files/02-design-system-and-app-shell.md, prompt
 * 02.5): every animation turns off under reduced motion, and every celebration is under 1.5s.
 */

const motionCss = readFileSync(new URL("../../src/styles/motion.css", import.meta.url), "utf8");
const tokens = customPropertiesIn(motionCss, ":root");
const animations = customPropertiesIn(motionCss, "@theme inline");

const CELEBRATION_BUDGET_MS = 1500;
/**
 * Loading indicators loop until the work is done (the mentor's typing dots are one: they show while
 * a reply is being written, md-files/10-ai-mentor.md; the skeleton's shimmer is another), and the
 * terminal cursor blinks while you can type (md-files/05-terminal-module.md). Nothing else may loop.
 */
const MAY_LOOP = new Set([
  "animate-spin",
  "animate-indeterminate",
  "animate-typing-dot",
  "animate-cursor-blink",
  "animate-shimmer",
]);

/**
 * The motion UIUX.md §5 gives the primitives (prompt UX.1): the badge pop on a tab's count, the
 * line flash for `pin`, the Case closed stamp, the MATCH sweep and the skeleton shimmer. The
 * sliding tab underline is a transition (fx-slide), checked with the transition utilities.
 */
const UIUX_ANIMATIONS = [
  "animate-badge-pop",
  "animate-line-flash",
  "animate-stamp",
  "animate-sweep",
  "animate-shimmer",
];

/** `250ms` → 250, `1.2s` → 1200. */
function toMs(value: string | undefined): number {
  const [, amount, unit] = /^(\d*\.?\d+)(ms|s)$/.exec(value?.trim() ?? "") ?? [];
  if (amount === undefined) throw new Error(`Not a time: "${value}"`);
  return Number(amount) * (unit === "s" ? 1000 : 1);
}

/** `calc(var(--duration-x) * 1.4 * var(--motion-scale))` → the unscaled time, in ms. */
function scaledTimeMs(calc: string): number {
  const [, token, factor] =
    /^calc\(var\(--([\w-]+)(?:,[^)]*)?\)\s*(?:\*\s*([\d.]+)\s*)?\*/.exec(calc) ?? [];
  if (token === undefined) throw new Error(`Unexpected time: "${calc}"`);
  // A variable the component sets (a spark's delay) has no value here; its fallback is 0ms.
  const base = tokens.has(token) ? toMs(tokens.get(token)) : 0;
  return base * Number(factor ?? 1);
}

/** The duration, delay and repeat count in an `animation` shorthand. */
function parseAnimation(value: string) {
  const times = value.match(/calc\((?:[^()]|\([^()]*\))*\)/g) ?? [];
  const rest = value.replace(/calc\((?:[^()]|\([^()]*\))*\)/g, "").replace(/var\([^)]*\)/g, "");
  const repeats = /\binfinite\b/.test(rest)
    ? Infinity
    : Number(/\s(\d+)\s/.exec(` ${rest} `)?.[1] ?? 1);
  const [duration = "", delay] = times;
  return {
    times,
    durationMs: scaledTimeMs(duration),
    delayMs: delay === undefined ? 0 : scaledTimeMs(delay),
    repeats,
  };
}

describe("motion tokens", () => {
  it("define the scale: 1 normally, 0 when motion is reduced", () => {
    const declared = parseCustomProperties(motionCss).filter((p) => p.name === "motion-scale");
    expect(declared.map(({ block, value }) => [block, value])).toEqual([
      [":root", "1"],
      [':root:not([data-motion="full"])', "0"],
      ['[data-motion="reduce"]', "0"],
      ['[data-motion="full"]', "1"],
    ]);
    expect(motionCss).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*:root:not/);
  });

  it("define durations as plain times", () => {
    const durations = [...tokens].filter(([name]) => name.startsWith("duration-"));
    expect(durations.length).toBeGreaterThan(0);
    for (const [name, value] of durations) expect(toMs(value), name).toBeGreaterThan(0);
  });
});

describe("animations", () => {
  const entries = [...animations].filter(([name]) => name.startsWith("animate-"));

  it("exist", () => {
    expect(entries.length).toBeGreaterThan(5);
  });

  it("scale every duration and delay by --motion-scale, so reduced motion stops them", () => {
    for (const [name, value] of entries) {
      const { times } = parseAnimation(value);
      expect(times.length, name).toBeGreaterThan(0);
      for (const time of times) expect(time, name).toMatch(/\* var\(--motion-scale\)\)$/);
    }
  });

  it(`finish within ${CELEBRATION_BUDGET_MS}ms, repeats and delay included`, () => {
    for (const [name, value] of entries) {
      const { durationMs, delayMs, repeats } = parseAnimation(value);
      if (MAY_LOOP.has(name)) continue;
      expect(repeats, `${name} must not loop`).not.toBe(Infinity);
      expect(delayMs + durationMs * repeats, name).toBeLessThan(CELEBRATION_BUDGET_MS);
    }
  });

  it("include the primitives' motion from UIUX.md §5", () => {
    const names = entries.map(([name]) => name);
    for (const name of UIUX_ANIMATIONS) expect(names, name).toContain(name);
  });

  it("only use keyframes that exist", () => {
    // `spin` is Tailwind's own; every other keyframe is written in motion.css.
    const keyframes = new Set([
      "spin",
      ...[...motionCss.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1]),
    ]);
    for (const [name, value] of entries) {
      const keyframe = /^([\w-]+)\s/.exec(value.trim())?.[1];
      expect(keyframes.has(keyframe), `${name} uses @keyframes ${keyframe}`).toBe(true);
    }
  });

  it("only loop for loading indicators", () => {
    const looping = entries.filter(([, value]) => parseAnimation(value).repeats === Infinity);
    expect(looping.map(([name]) => name).sort()).toEqual([...MAY_LOOP].sort());
  });
});

describe("transition utilities", () => {
  const utilities = [...motionCss.matchAll(/@utility (fx-[\w-]+) \{([^}]*)\}/g)];
  const transitions = utilities.filter(([, , body]) => /transition-duration/.test(body ?? ""));

  it("scale their duration by --motion-scale", () => {
    expect(transitions.map(([, name]) => name)).toEqual(
      expect.arrayContaining(["fx-duration-fast", "fx-duration-base", "fx-duration-slow"]),
    );
    for (const [, name, body] of transitions) {
      expect(body, name).toMatch(
        /transition-duration: calc\(var\(--duration-[\w-]+\) \* var\(--motion-scale\)\)/,
      );
    }
  });

  it("include the tab underline's slide (UIUX.md §5)", () => {
    const slide = transitions.find(([, name]) => name === "fx-slide");
    expect(slide?.[2]).toMatch(/transition-property: translate, width/);
  });
});

describe("rest states", () => {
  it("park the sweep and the shimmer's highlight off the element, so still motion shows none", () => {
    const body = (name: string) => motionCss.split(`@utility ${name} {`)[1]?.split("\n}")[0] ?? "";
    expect(body("fx-sweep")).toMatch(/background-position: -100% 0;/);
    expect(body("fx-skeleton")).toMatch(/background-position: 100% 0;/);
  });
});
