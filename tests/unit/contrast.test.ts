import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  meetsWcagAA,
  parseHexColor,
  relativeLuminance,
  WCAG_AA_MIN_RATIO,
} from "@/lib/contrast";

describe("parseHexColor", () => {
  it("parses #rrggbb and the #rgb shorthand, in any case", () => {
    expect(parseHexColor("#0b0f14")).toEqual({ r: 11, g: 15, b: 20 });
    expect(parseHexColor("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor("#a1B")).toEqual(parseHexColor("#aa11bb"));
  });

  it.each(["", "fff", "#ff", "#fffff", "#ggg", "red", "rgb(0 0 0)", " #ffffff"])(
    "rejects %j",
    (input) => {
      expect(() => parseHexColor(input)).toThrow(/opaque hex colour/);
    },
  );

  it("rejects colours with alpha and says why", () => {
    expect(() => parseHexColor("#ffffff80")).toThrow(/alpha/);
    expect(() => parseHexColor("#fff8")).toThrow(/alpha/);
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
  });

  it("weights the primaries by the WCAG coefficients", () => {
    expect(relativeLuminance("#ff0000")).toBeCloseTo(0.2126, 10);
    expect(relativeLuminance("#00ff00")).toBeCloseTo(0.7152, 10);
    expect(relativeLuminance("#0000ff")).toBeCloseTo(0.0722, 10);
  });

  it("uses the linear segment for very dark channels", () => {
    // 10/255 is below the sRGB threshold, so it is divided by 12.92 rather than gamma-expanded.
    expect(relativeLuminance({ r: 10, g: 10, b: 10 })).toBeCloseTo(10 / 255 / 12.92, 10);
  });

  it("accepts channels as well as hex", () => {
    expect(relativeLuminance({ r: 11, g: 15, b: 20 })).toBe(relativeLuminance("#0b0f14"));
  });

  it.each([
    { r: 256, g: 0, b: 0 },
    { r: -1, g: 0, b: 0 },
    { r: 0, g: 1.5, b: 0 },
    { r: 0, g: 0, b: NaN },
  ])("rejects out-of-range channels %j", (rgb) => {
    expect(() => relativeLuminance(rgb)).toThrow(/0 to 255/);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 10);
    expect(contrastRatio("#3dd6ef", "#3dd6ef")).toBe(1);
  });

  it("does not depend on argument order", () => {
    expect(contrastRatio("#e6edf3", "#121821")).toBe(contrastRatio("#121821", "#e6edf3"));
  });

  it("matches known reference values", () => {
    // The classic AA boundary pair: #777 just fails on white, #767676 just passes.
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#ff0000", "#ffffff")).toBeCloseTo(4.0, 2);
    expect(contrastRatio("#0000ff", "#ffffff")).toBeCloseTo(8.59, 2);
  });

  it("stays within 1 to 21", () => {
    for (const [a, b] of [
      ["#000", "#000"],
      ["#fff", "#000"],
      ["#0b0f14", "#8d9aab"],
      ["#808080", "#7f7f7f"],
    ] as const) {
      const ratio = contrastRatio(a, b);
      expect(ratio).toBeGreaterThanOrEqual(1);
      expect(ratio).toBeLessThanOrEqual(21);
    }
  });
});

describe("meetsWcagAA", () => {
  it("uses 4.5:1 for normal text and 3:1 for large text", () => {
    expect(WCAG_AA_MIN_RATIO).toEqual({ normal: 4.5, large: 3 });
    expect(meetsWcagAA(4.5)).toBe(true);
    expect(meetsWcagAA(4.5, "normal")).toBe(true);
    expect(meetsWcagAA(3, "large")).toBe(true);
    expect(meetsWcagAA(2.99, "large")).toBe(false);
  });

  it("never rounds up a ratio that falls short", () => {
    expect(meetsWcagAA(4.499)).toBe(false);
    expect(meetsWcagAA(contrastRatio("#777777", "#ffffff"))).toBe(false);
    expect(meetsWcagAA(contrastRatio("#767676", "#ffffff"))).toBe(true);
  });
});
