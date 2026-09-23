import { describe, expect, it } from "vitest";
import { stableStringify } from "../../core/stable-json";
import { EvidenceSetSchema } from "../schema";
import {
  at,
  caseOf,
  everyTracedRef,
  LAPTOP,
  play,
  resolveRef,
  SERVER,
  WORKSTATION,
} from "./__fixtures__/case";
import { generate, generateEvidence } from "./generate";
import type { StoryAction } from "./types";

/**
 * The generator as a whole (docs/plan/03-case-format-and-generator.md §Generator): that the same
 * case always builds the same evidence, that the evidence it builds is valid, that every artefact
 * it traced can still be found, and that a story it can't play stops the build with a message an
 * author can act on.
 *
 * Each action's own behaviour is tested beside it, in `actions/`.
 */

const START = at("2026-04-11T19:40:12Z");

const STORY: StoryAction[] = [
  {
    at: START,
    actor: { kind: "attacker" },
    on: "qf-lt-07",
    do: "logon",
    account: "dana",
    type: "remote",
    from: "10.60.0.21",
  },
  {
    id: "written",
    at: START + 60_000,
    actor: { kind: "attacker" },
    on: "qf-lt-07",
    do: "create-file",
    path: "C:\\Users\\dana\\Documents\\inv-0412.txt",
    content: "Invoice 0412\n",
  },
  {
    id: "deleted",
    at: START + 120_000,
    actor: { kind: "attacker" },
    on: "qf-lt-07",
    do: "delete-file",
    path: "C:\\Users\\dana\\Documents\\inv-0412.txt",
  },
  {
    at: START + 180_000,
    actor: { kind: "analyst" },
    on: "qf-lt-07",
    do: "capture-memory",
  },
];

const OPTIONS = { memory: ["qf-lt-07"], noise: { profile: "office-day", density: "low" } } as const;

describe("generate", () => {
  it("builds the same evidence from the same case, every time", () => {
    const spec = caseOf(STORY, OPTIONS);
    expect(stableStringify(generateEvidence(spec))).toBe(stableStringify(generateEvidence(spec)));
  });

  it("builds different evidence from a different seed, and the same story", () => {
    const one = generateEvidence(caseOf(STORY, { ...OPTIONS, seed: 1 }));
    const two = generateEvidence(caseOf(STORY, { ...OPTIONS, seed: 2 }));
    expect(stableStringify(one)).not.toBe(stableStringify(two));
    // The story's own artefacts are the same; only the background and the made-up details move.
    expect(one.logs.filter((r) => r.eventId === 4624).length).toBe(
      two.logs.filter((r) => r.eventId === 4624).length,
    );
  });

  it("builds evidence the model accepts", () => {
    const evidence = generateEvidence(caseOf(STORY, OPTIONS));
    expect(EvidenceSetSchema.safeParse(evidence).success).toBe(true);
  });

  it("traces every artefact to the action that left it, and all of them resolve", () => {
    const result = generate(caseOf(STORY, OPTIONS));
    const refs = everyTracedRef(result);

    expect(refs.length).toBeGreaterThan(5);
    for (const ref of refs) {
      expect(resolveRef(result.evidence, ref), `${ref} points at nothing`).toBeDefined();
    }
    expect(result.trace.find((entry) => entry.id === "deleted")?.do).toBe("delete-file");
  });

  it("numbers log records per source, oldest first", () => {
    const { evidence } = play(STORY, OPTIONS);
    for (const source of new Set(evidence.logs.map((record) => record.source))) {
      const ofSource = evidence.logs.filter((record) => record.source === source);
      expect(ofSource.map((record) => record.seq)).toEqual(
        [...ofSource].sort((a, b) => a.at - b.at).map((record) => record.seq),
      );
      expect([...ofSource].sort((a, b) => a.seq - b.seq)[0]?.seq).toBe(1);
    }
  });

  it("plays actions in time order, story before noise at the same instant", () => {
    const result = generate(caseOf(STORY, OPTIONS));
    const times = result.trace.map((entry) => entry.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("leaves out sources the case doesn't hand over, and says which", () => {
    const result = generate(caseOf(STORY, { ...OPTIONS, logs: ["security"] }));
    expect(result.evidence.logs.every((record) => record.source === "security")).toBe(true);
    expect(result.droppedSources).toContain("sysmon-lite");
    // Nothing in the trace points at a record that isn't in the evidence.
    for (const ref of everyTracedRef(result)) {
      expect(resolveRef(result.evidence, ref)).toBeDefined();
    }
  });

  describe("refuses a case it can't play", () => {
    const one =
      (action: StoryAction, options = {}) =>
      () =>
        play([action], options);
    /** The shortest story there is, for checks that happen before anything is played. */
    const TINY: StoryAction[] = [
      {
        at: START,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "logon",
        account: "dana",
        type: "interactive",
      },
    ];

    it("names the machines when an action happens on one that isn't there", () => {
      expect(
        one({ at: START, actor: { kind: "system" }, on: "nowhere", do: "capture-memory" }),
      ).toThrow(/no machine called "nowhere"[\s\S]*qf-lt-07/);
    });

    it("names the baselines when one is misspelt", () => {
      expect(() =>
        play(TINY, {
          machines: [{ ...LAPTOP, baseline: "office-laptop" }],
        }),
      ).toThrow(/no baseline called "office-laptop"[\s\S]*office-laptop-v1/);
    });

    it("refuses a baseline that builds another kind of machine", () => {
      expect(() => play(TINY, { machines: [{ ...LAPTOP, kind: "windows-server" }] })).toThrow(
        /builds a windows-laptop/,
      );
    });

    it("refuses a zone the offset table doesn't cover", () => {
      expect(() => play(TINY, { machines: [{ ...LAPTOP, zone: "Mars/Olympus" }] })).toThrow(
        /no zone "Mars\/Olympus"/,
      );
    });

    it("refuses a display zone the offset table doesn't cover", () => {
      expect(() => play(STORY, { ...OPTIONS, zones: { security: "Mars/Olympus" } })).toThrow(
        /no zone "Mars\/Olympus"/,
      );
    });

    it("refuses two machines with one name", () => {
      expect(() => play(TINY, { machines: [LAPTOP, LAPTOP] })).toThrow(/two machines are called/i);
    });

    it("says the analyst's workstation is not evidence", () => {
      expect(() =>
        play([{ at: START, actor: { kind: "analyst" }, on: "ir-ws-01", do: "capture-memory" }], {
          machines: [WORKSTATION],
          disks: ["ir-ws-01"],
        }),
      ).toThrow(/never imaged/);
    });

    it("says when nothing captured the memory a case hands over", () => {
      expect(() => play(TINY, { memory: ["qf-lt-07"] })).toThrow(/nothing captured the memory/);
    });

    it("refuses an empty story, and a case with no machines", () => {
      expect(() => play([])).toThrow(/at least one story action/);
      expect(() => play(STORY, { machines: [] })).toThrow(/at least one machine/);
    });
  });

  it("builds several machines at once, each on its own address", () => {
    const { evidence } = play(
      [
        {
          at: START,
          actor: { kind: "attacker" },
          on: "qf-srv-01",
          do: "web-request",
          path: "/dockets",
          clientIp: "203.0.113.47",
        },
        {
          at: START + 1000,
          actor: { kind: "user", account: "dana" },
          on: "qf-lt-07",
          do: "logon",
          account: "dana",
          type: "interactive",
        },
      ],
      { machines: [LAPTOP, SERVER] },
    );

    expect(evidence.disks.map((disk) => disk.id)).toEqual(["qf-lt-07", "qf-srv-01"]);
    expect(evidence.logs.map((record) => record.host)).toEqual(["qf-srv-01", "qf-lt-07"]);
  });
});
