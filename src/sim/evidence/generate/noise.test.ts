import { describe, expect, it } from "vitest";
import { stableStringify } from "../../core/stable-json";
import { zonedParts } from "../time";
import { at, caseOf, LAPTOP, play, SERVER, WORKSTATION } from "./__fixtures__/case";
import { generate } from "./generate";
import { NOISE_PROFILES } from "./noise";
import type { NoiseDensity, NoiseProfileId, StoryAction } from "./types";

/**
 * The background activity (docs/plan/03-case-format-and-generator.md §Noise profiles). What makes
 * it worth having is that it is ordinary: it has to be dense enough that the story doesn't stand
 * out by being the only thing there, seeded so the same case is the same case every time, and
 * never something a report question could mistake for the answer.
 */

const START = at("2026-04-11T09:00:00Z");
const END = at("2026-04-11T21:00:00Z");

const STORY: StoryAction[] = [
  {
    at: START,
    actor: { kind: "user", account: "dana" },
    on: "qf-lt-07",
    do: "logon",
    account: "dana",
    type: "interactive",
  },
  {
    at: END,
    actor: { kind: "user", account: "dana" },
    on: "qf-lt-07",
    do: "logoff",
    account: "dana",
  },
];

/** The same span of time, on the server rather than the laptop. */
const SERVER_STORY: StoryAction[] = [
  { at: START, actor: { kind: "system" }, on: "qf-srv-01", do: "web-request", path: "/" },
  { at: END, actor: { kind: "system" }, on: "qf-srv-01", do: "web-request", path: "/health" },
];

const WORKSTATION_STORY: StoryAction[] = [
  { at: START, actor: { kind: "analyst" }, on: "ir-ws-01", do: "capture-memory" },
  { at: END, actor: { kind: "analyst" }, on: "ir-ws-01", do: "capture-memory", id: "second" },
];

const withNoise = (
  profile: NoiseProfileId,
  density: NoiseDensity,
  options = {},
  story: readonly StoryAction[] = STORY,
) => generate(caseOf(story, { noise: { profile, density }, ...options }));

const noiseCount = (profile: NoiseProfileId, density: NoiseDensity) =>
  withNoise(profile, density).trace.filter((entry) => entry.source === "noise").length;

describe("noise", () => {
  it("keeps to weekdays when a case turns weekends off", () => {
    // START and END are a Saturday: the whole window is a weekend.
    const count = (weekends?: boolean) =>
      generate(
        caseOf(STORY, {
          noise: {
            profile: "office-day",
            density: "medium",
            ...(weekends === false && { weekends }),
          },
        }),
      ).trace.filter((entry) => entry.source === "noise").length;
    expect(count()).toBeGreaterThan(0);
    expect(count(false)).toBe(0);
  });

  it("adds nothing at all when a case asks for none", () => {
    expect(noiseCount("office-day", "none")).toBe(0);
    expect(generate(caseOf(STORY)).trace.every((entry) => entry.source === "story")).toBe(true);
  });

  it("adds more as the density goes up", () => {
    const low = noiseCount("office-day", "low");
    const medium = noiseCount("office-day", "medium");
    const high = noiseCount("office-day", "high");

    expect(low).toBeGreaterThan(0);
    expect(medium).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(medium);
  });

  it("builds the same background every time, from the same seed", () => {
    const one = withNoise("office-day", "medium");
    const two = withNoise("office-day", "medium");
    expect(stableStringify(one.evidence)).toBe(stableStringify(two.evidence));
  });

  it("keeps to the hours each profile says it is busy, in the machine's own zone", () => {
    for (const profile of Object.values(NOISE_PROFILES)) {
      const onServer = profile.id === "server-idle";
      const result = withNoise(
        profile.id,
        "high",
        { machines: onServer ? [SERVER] : [LAPTOP] },
        onServer ? SERVER_STORY : STORY,
      );
      const hours = result.trace
        .filter((entry) => entry.source === "noise")
        .map((entry) => zonedParts(entry.at, "Europe/London").hour);
      expect(hours.length).toBeGreaterThan(0);
      for (const hour of hours) expect(profile.busyHours).toContain(hour);
    }
  });

  it("leaves the analyst's own workstation alone", () => {
    const result = withNoise(
      "office-day",
      "high",
      { machines: [WORKSTATION], disks: [] },
      WORKSTATION_STORY,
    );
    expect(result.trace.filter((entry) => entry.source === "noise")).toEqual([]);
  });

  it("stops on a machine once it has been handed over", () => {
    const signed = at("2026-04-11T12:00:00Z");
    const result = generate(
      caseOf(
        [
          ...STORY,
          {
            at: signed,
            actor: { kind: "analyst" },
            on: "qf-lt-07",
            do: "hand-over",
            by: "The Quillfen Freight yard office",
          },
        ],
        { noise: { profile: "office-day", density: "high" } },
      ),
    );

    const after = result.trace.filter((entry) => entry.source === "noise" && entry.at >= signed);
    expect(after).toEqual([]);
  });

  it("only ever acts as the people on the machine, never as a built-in account", () => {
    const { evidence } = play(STORY, {
      noise: { profile: "office-day", density: "high" },
    });
    const names = new Set(
      evidence.logs
        .filter((record) => record.eventId === 4624)
        .map((record) => record.fields.TargetUserName),
    );
    expect([...names]).toEqual(["dana"]);
  });

  it("refuses a case whose background would bury the story", () => {
    const longStory: StoryAction[] = [
      STORY[0] as StoryAction,
      { ...(STORY[1] as StoryAction), at: at("2026-06-11T21:00:00Z") },
    ];
    expect(() =>
      generate(caseOf(longStory, { noise: { profile: "server-idle", density: "high" } })),
    ).toThrow(/more than a beginner can read through/);
  });
});
