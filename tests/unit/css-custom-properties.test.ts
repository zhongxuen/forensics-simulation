import { describe, expect, it } from "vitest";
import { customPropertiesIn, parseCustomProperties } from "@/lib/css-custom-properties";

describe("parseCustomProperties", () => {
  it("reads declarations with the block they're declared in", () => {
    const css = `
      @layer theme {
        :root {
          color-scheme: dark;
          --surface-base: #0b0f14;
          --text-primary:   #e6edf3 ;
        }
      }
      @theme default { --spacing: 0.25rem; }
    `;
    expect(parseCustomProperties(css)).toEqual([
      { name: "surface-base", value: "#0b0f14", block: ":root" },
      { name: "text-primary", value: "#e6edf3", block: ":root" },
      { name: "spacing", value: "0.25rem", block: "@theme default" },
    ]);
  });

  it("skips comments, including ones that look like declarations", () => {
    const css = ":root { /* --old: #000; */ --accent: #3dd6ef; /* translucent */ }";
    expect(parseCustomProperties(css)).toEqual([
      { name: "accent", value: "#3dd6ef", block: ":root" },
    ]);
  });

  it("reads a last declaration with no semicolon", () => {
    expect(parseCustomProperties(":root { --a: 1; --b: 2 }").map((p) => p.name)).toEqual([
      "a",
      "b",
    ]);
  });

  it("keeps values with spaces, parentheses and line breaks, collapsing the whitespace", () => {
    const css = ":root {\n  --glow: rgb(212 165 255 /\n    0.35);\n  --lh: calc(1.25 / 0.875);\n}";
    expect(customPropertiesIn(css, ":root")).toEqual(
      new Map([
        ["glow", "rgb(212 165 255 / 0.35)"],
        ["lh", "calc(1.25 / 0.875)"],
      ]),
    );
  });

  it("attributes declarations after a nested block to the outer block", () => {
    const css =
      "@theme default { --a: 1; @keyframes spin { to { transform: rotate(1turn); } } --b: 2; }";
    expect(customPropertiesIn(css, "@theme default")).toEqual(
      new Map([
        ["a", "1"],
        ["b", "2"],
      ]),
    );
  });
});

describe("customPropertiesIn", () => {
  it("only reads the named block, and lets later declarations win", () => {
    const css = `
      :root { --surface-base: #0b0f14; --accent: #111111; }
      [data-theme="light"] { --surface-base: #ffffff; }
      :root { --accent: #3dd6ef; }
    `;
    expect(customPropertiesIn(css, ":root")).toEqual(
      new Map([
        ["surface-base", "#0b0f14"],
        ["accent", "#3dd6ef"],
      ]),
    );
    expect(customPropertiesIn(css, '[data-theme="light"]').get("surface-base")).toBe("#ffffff");
  });
});
