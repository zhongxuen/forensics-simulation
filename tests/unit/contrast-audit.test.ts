import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  auditContrast,
  CONTRAST_AUDIT_EXCLUSIONS,
  CONTRAST_AUDIT_GROUPS,
  CONTRAST_MINIMUM,
  CONTRAST_THEMES,
  formatContrastRatio,
  themeTokens,
  type ContrastAuditGroupSpec,
} from "@/lib/contrast-audit";
import { customPropertiesIn } from "@/lib/css-custom-properties";

const tokensCss = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");

describe.each(CONTRAST_THEMES.map((theme) => [theme.title, theme] as const))(
  "the %s tokens in src/styles/tokens.css",
  (_title, theme) => {
    const tokens = themeTokens(tokensCss, theme);

    it("pass WCAG AA in every audited pair", () => {
      const failures = auditContrast(tokens)
        .flatMap((group) => group.rows)
        .filter((row) => !row.passes)
        .map(
          (row) =>
            `--${row.foreground} on --${row.background}: ` +
            (row.problem ?? `${formatContrastRatio(row.ratio ?? 0)}:1, needs ${row.minimum}:1`),
        );
      expect(failures).toEqual([]);
    });

    it("are all either audited or excluded with a reason", () => {
      const audited = new Set(
        CONTRAST_AUDIT_GROUPS.flatMap((group) => [...group.foregrounds, ...group.backgrounds]),
      );
      const colourTokens = [...tokens].filter(([, value]) => /^#|^rgb|^hsl|^oklch/.test(value));
      const unaccounted = colourTokens
        .map(([name]) => name)
        .filter((name) => !audited.has(name) && !(name in CONTRAST_AUDIT_EXCLUSIONS));
      expect(colourTokens.length).toBeGreaterThan(0);
      expect(unaccounted).toEqual([]);
    });

    it("define every token the audit names", () => {
      const named = CONTRAST_AUDIT_GROUPS.flatMap((group) => [
        ...group.foregrounds,
        ...group.backgrounds,
      ]);
      expect(named.filter((name) => !tokens.has(name))).toEqual([]);
    });
  },
);

describe("the Daylight block", () => {
  const dark = themeTokens(tokensCss, CONTRAST_THEMES[0]!);
  const light = customPropertiesIn(tokensCss, '[data-theme="light"]');

  it("reassigns every app colour, and only names the dark theme already has", () => {
    const appColours = [...dark.keys()].filter((name) => !name.startsWith("term-"));
    expect([...light.keys()].sort()).toEqual(appColours.sort());
  });

  it("leaves the terminal dark", () => {
    expect([...light.keys()].filter((name) => name.startsWith("term-"))).toEqual([]);
  });
});

describe("auditContrast", () => {
  const group: ContrastAuditGroupSpec = {
    id: "probe",
    title: "Probe",
    description: "",
    use: "text",
    foregrounds: ["pass", "fail"],
    backgrounds: ["white"],
  };

  it("measures each foreground on each background against the group's minimum", () => {
    const probe = new Map([
      ["white", "#ffffff"],
      ["pass", "#767676"],
      ["fail", "#777777"],
    ]);
    const [audited] = auditContrast(probe, [group]);
    expect(audited?.rows.map((row) => [row.foreground, row.passes])).toEqual([
      ["pass", true],
      ["fail", false],
    ]);
    expect(audited?.rows[0]).toMatchObject({
      background: "white",
      foregroundValue: "#767676",
      backgroundValue: "#ffffff",
      minimum: CONTRAST_MINIMUM.text,
      problem: undefined,
    });
    expect(audited?.rows[0]?.ratio).toBeCloseTo(4.54, 2);
  });

  it("holds non-text pairs to 3:1", () => {
    const probe = new Map([
      ["white", "#ffffff"],
      ["pass", "#949494"],
      ["fail", "#959595"],
    ]);
    const [audited] = auditContrast(probe, [{ ...group, use: "non-text" }]);
    expect(CONTRAST_MINIMUM["non-text"]).toBe(3);
    expect(audited?.rows.map((row) => row.passes)).toEqual([true, false]);
  });

  it("fails a pair it can't measure, and says why", () => {
    const probe = new Map([
      ["white", "#ffffff"],
      ["pass", "rgb(0 0 0 / 0.5)"],
    ]);
    const [audited] = auditContrast(probe, [group]);
    expect(audited?.rows[0]).toMatchObject({ passes: false, ratio: undefined });
    expect(audited?.rows[0]?.problem).toMatch(/opaque hex colour/);
    expect(audited?.rows[1]).toMatchObject({
      passes: false,
      problem: expect.stringMatching(/not defined/),
    });
  });
});

describe("formatContrastRatio", () => {
  it("shows two decimals and never rounds up", () => {
    expect(formatContrastRatio(4.497)).toBe("4.49");
    expect(formatContrastRatio(4.5)).toBe("4.50");
    expect(formatContrastRatio(16.2749)).toBe("16.27");
    expect(formatContrastRatio(21)).toBe("21.00");
  });
});
