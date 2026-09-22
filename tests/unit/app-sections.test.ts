import { describe, expect, it } from "vitest";
import { APP_SECTIONS, getAppSection, sectionForPathname } from "@/lib/app-sections";
import { FIRST_STEP } from "@/lib/next-step";

// From md-files/voice-and-tone.md, "Banned words". Whole words only, so "adjust" doesn't match "just".
const BANNED_WORDS =
  /\b(simply|just|merely|obviously|clearly|of course|as you know|easy|trivial|basic|invalid|illegal|wrong|failed|victim)\b/i;

describe("app sections", () => {
  it("lists the four sections in sidebar order", () => {
    expect(APP_SECTIONS.map((section) => section.id)).toEqual([
      "cases",
      "sandbox",
      "learn",
      "settings",
    ]);
  });

  it("gives every section a unique top-level route", () => {
    const hrefs = APP_SECTIONS.map((section) => section.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href).toMatch(/^\/[a-z-]+$/);
  });

  it("gives every section a beginner-friendly subtitle", () => {
    for (const { label, subtitle } of APP_SECTIONS) {
      expect(subtitle.length, label).toBeGreaterThan(0);
      expect(subtitle, label).not.toMatch(BANNED_WORDS);
      // Sentence case, no closing full stop: it reads as a label, not a paragraph.
      expect(subtitle.charAt(0), label).toBe(subtitle.charAt(0).toUpperCase());
      expect(subtitle, label).not.toMatch(/\.$/);
    }
  });

  it("gives the command palette extra words to find each section by", () => {
    for (const { label, keywords } of APP_SECTIONS) {
      expect(keywords.length, label).toBeGreaterThan(0);
      for (const keyword of keywords) expect(keyword, label).toBe(keyword.toLowerCase());
    }
  });

  it("looks sections up by id", () => {
    expect(getAppSection("sandbox").label).toBe("Sandbox");
  });
});

describe("sectionForPathname", () => {
  it("matches a section's own page", () => {
    expect(sectionForPathname("/sandbox")?.id).toBe("sandbox");
  });

  it("matches pages inside a section", () => {
    expect(sectionForPathname("/cases/case-01")?.id).toBe("cases");
  });

  it("does not match a different route that shares a prefix", () => {
    expect(sectionForPathname("/learners")).toBeUndefined();
  });

  it("matches nothing outside the app", () => {
    expect(sectionForPathname("/")).toBeUndefined();
  });
});

describe("first step", () => {
  it("is a page inside a section, so the shell can show where the learner is", () => {
    expect(sectionForPathname(FIRST_STEP.href)?.id).toBe("cases");
  });

  it("follows the voice guide", () => {
    expect(FIRST_STEP.title).not.toMatch(BANNED_WORDS);
    expect(FIRST_STEP.detail).not.toMatch(BANNED_WORDS);
  });
});
