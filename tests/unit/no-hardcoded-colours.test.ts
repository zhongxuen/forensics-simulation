import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Components use semantic tokens (bg-surface-raised, text-accent, …), never a raw colour
 * (md-files/02-design-system-and-app-shell.md). Raw values live in src/styles/tokens.css only,
 * where the contrast audit measures them.
 */

const ROOT = join(import.meta.dirname, "../..");
const SCANNED = ["src/components", "src/app", "src/features", "src/hooks"];

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOUR_UTILITY =
  "bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|fill|stroke|from|via|to|shadow|divide|decoration|accent|caret|placeholder";

const HARDCODED_COLOUR = new RegExp(
  [
    // #rgb, #rgba, #rrggbb, #rrggbbaa (not an HTML entity like &#8212;)
    String.raw`(?<![&\w])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b`,
    // rgb(), hsl(), oklch() and friends
    String.raw`\b(?:rgba?|hsla?|oklch|oklab|lch|lab|hwb)\(`,
    // Tailwind's own palette: text-red-500, bg-neutral-950, border-white
    String.raw`\b(?:${COLOUR_UTILITY})-(?:(?:${PALETTE})-\d{2,3}|white|black)\b`,
  ].join("|"),
  "gi",
);

/** Every hardcoded colour in `source`, as written. */
function findHardcodedColours(source: string): string[] {
  return [...source.matchAll(HARDCODED_COLOUR)].map((match) => match[0]);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [path] : [];
  });
}

describe("findHardcodedColours", () => {
  it("catches hex, colour functions and Tailwind palette classes", () => {
    expect(
      findHardcodedColours(
        `<p className="text-emerald-400 bg-neutral-950 hover:border-white" style={{ color: "#fff", background: "rgb(0 0 0)" }} />`,
      ),
    ).toEqual(["text-emerald-400", "bg-neutral-950", "border-white", "#fff", "rgb("]);
  });

  it("allows semantic tokens, anchors and HTML entities", () => {
    expect(
      findHardcodedColours(
        `<a href="#main-content" className="bg-surface-raised text-accent border-status-danger text-reward">&#8212;</a>`,
      ),
    ).toEqual([]);
  });
});

describe("components and pages", () => {
  it("use design tokens, never hardcoded colours", () => {
    const offenders = SCANNED.flatMap((dir) => sourceFiles(join(ROOT, dir))).flatMap((file) =>
      findHardcodedColours(readFileSync(file, "utf8")).map(
        (colour) => `${relative(ROOT, file).replaceAll("\\", "/")}: ${colour}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
