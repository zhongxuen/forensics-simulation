import { describe, expect, it, vi } from "vitest";
import {
  buildFallbackReview,
  canRevealHint,
  commandNames,
  createMentorStore,
  custodySentence,
  HINT_COOLDOWN_MS,
  hintsFor,
  initialMentorState,
  nextHintTier,
  nextHintUnlockAt,
  questionViewLabel,
  runFactLines,
  staticMentorSession,
  type MentorCaseRef,
  type MentorTextResult,
  type ReviewFacts,
} from "@/features/mentor";

/**
 * The mentor's per-attempt memory and its deterministic fallbacks (docs/plan/14-mentor.md). Vendored
 * from the sibling's store tests and adapted to cases (VENDORED.md), with the custody sentence —
 * this game's own part of the review — covered here.
 *
 * Everything below runs with fake requests, so nothing touches the network and no key is needed.
 * That is the point: **the game is complete without the mentor**, and these tests are what say so.
 */

const CASE: MentorCaseRef = {
  id: "case-01",
  objectives: [
    { id: "check-the-blocker", hints: ["a nudge", "the idea", "nearly the answer"] },
    { id: "find-the-note", hints: ["look on the desktop", "list the folder", "run lsfs then pin"] },
    // A secret ships no hints, so none can ever be asked for.
    { id: "md5-as-well", hints: [] },
  ],
};

function storeWith(overrides: Parameters<typeof createMentorStore>[1] = {}) {
  const requests: unknown[] = [];
  const store = createMentorStore(CASE, {
    now: () => 1_000,
    requestHint: async (options) => {
      requests.push(options);
      return { mode: "model", text: `Noor on ${options.objectiveId} tier ${options.tier}` };
    },
    requestExplain: async (options) => {
      requests.push(options);
      return { mode: "model", text: "Noor explains" };
    },
    requestReview: async (options) => {
      requests.push(options);
      return { mode: "fallback", review: buildFallbackReview(options.facts) };
    },
    ...overrides,
  });
  return { store, requests };
}

describe("the hint ladder", () => {
  it("starts at tier 1 and walks up one tier at a time", () => {
    const { store } = storeWith();
    expect(nextHintTier(store.getState(), CASE, "check-the-blocker")).toBe(1);
    expect(store.askHint("check-the-blocker", [])).toBe(true);
    expect(hintsFor(store.getState(), "check-the-blocker")).toHaveLength(1);
    expect(nextHintTier(store.getState(), CASE, "check-the-blocker")).toBe(2);
  });

  it("holds the next tier back until the cooldown has passed", () => {
    let now = 1_000;
    const { store } = storeWith({ now: () => now });
    expect(store.askHint("check-the-blocker", [])).toBe(true);
    // Straight away: no.
    expect(canRevealHint(store.getState(), CASE, "check-the-blocker", now)).toBe(false);
    expect(store.askHint("check-the-blocker", [])).toBe(false);
    expect(nextHintUnlockAt(store.getState(), "check-the-blocker")).toBe(1_000 + HINT_COOLDOWN_MS);
    // After it: yes.
    now += HINT_COOLDOWN_MS;
    expect(canRevealHint(store.getState(), CASE, "check-the-blocker", now)).toBe(true);
    expect(store.askHint("check-the-blocker", [])).toBe(true);
    expect(hintsFor(store.getState(), "check-the-blocker")).toHaveLength(2);
  });

  it("never goes past tier 3", () => {
    let now = 1_000;
    const { store } = storeWith({ now: () => now });
    for (let tier = 0; tier < 3; tier++) {
      expect(store.askHint("check-the-blocker", [])).toBe(true);
      now += HINT_COOLDOWN_MS;
    }
    expect(nextHintTier(store.getState(), CASE, "check-the-blocker")).toBeUndefined();
    expect(store.askHint("check-the-blocker", [])).toBe(false);
    expect(hintsFor(store.getState(), "check-the-blocker")).toHaveLength(3);
  });

  it("never gives a hint for a secret, which ships none", () => {
    const { store, requests } = storeWith();
    expect(nextHintTier(store.getState(), CASE, "md5-as-well")).toBeUndefined();
    expect(store.askHint("md5-as-well", [])).toBe(false);
    expect(requests).toHaveLength(0);
  });

  it("keeps each objective's ladder apart", () => {
    const { store } = storeWith();
    store.askHint("check-the-blocker", []);
    expect(hintsFor(store.getState(), "find-the-note")).toHaveLength(0);
    expect(nextHintTier(store.getState(), CASE, "find-the-note")).toBe(1);
  });
});

describe("what the player ends up seeing", () => {
  it("shows the authored text verbatim when the mentor falls back", async () => {
    const authored = "a nudge";
    const { store } = storeWith({
      requestHint: async (): Promise<MentorTextResult> => ({ mode: "fallback", text: authored }),
    });
    store.askHint("check-the-blocker", []);
    await vi.waitFor(() =>
      expect(hintsFor(store.getState(), "check-the-blocker")[0]?.status).toBe("fallback"),
    );
    const entry = hintsFor(store.getState(), "check-the-blocker")[0];
    expect(entry?.text).toBe(authored);
    // And the panel can say plainly that this one came from her notes.
    expect(store.getState().lastReply?.mode).toBe("fallback");
  });

  it("shows a hint as it streams in, then its final words", async () => {
    const { store } = storeWith({
      requestHint: async (options): Promise<MentorTextResult> => {
        options.onText?.("Look at");
        options.onText?.("Look at the blocker");
        return { mode: "model", text: "Look at the blocker." };
      },
    });
    store.askHint("check-the-blocker", []);
    await vi.waitFor(() =>
      expect(hintsFor(store.getState(), "check-the-blocker")[0]?.status).toBe("model"),
    );
    expect(hintsFor(store.getState(), "check-the-blocker")[0]?.text).toBe("Look at the blocker.");
  });
});

describe("explanations", () => {
  it("keeps each question with its answer, and says which view it came from", async () => {
    const { store } = storeWith();
    store.explain({
      question: { kind: "row", view: "timeline", text: "an entry", title: "security 4624" },
      transcript: [],
      fallback: "The timeline shows one moment per entry.",
    });
    await vi.waitFor(() => expect(store.getState().explanations[0]?.status).toBe("model"));
    const explanation = store.getState().explanations[0];
    expect(explanation?.question.kind).toBe("row");
    expect(questionViewLabel(explanation!.question)).toBe("the timeline");
    expect(explanation?.text).toBe("Noor explains");
  });

  it("falls back to the view's own words when the mentor is unavailable", async () => {
    const written = "The timeline shows one moment per entry.";
    const { store } = storeWith({
      requestExplain: async (options): Promise<MentorTextResult> => ({
        mode: "fallback",
        text: options.fallback,
      }),
    });
    store.explain({
      question: { kind: "row", view: "board", text: "a card" },
      transcript: [],
      fallback: written,
    });
    await vi.waitFor(() => expect(store.getState().explanations[0]?.status).toBe("fallback"));
    expect(store.getState().explanations[0]?.text).toBe(written);
  });
});

describe("the review", () => {
  it("is asked for once per attempt", async () => {
    const { store, requests } = storeWith();
    store.requestReview(facts(), []);
    store.requestReview(facts(), []);
    await vi.waitFor(() => expect(store.getState().review.status).toBe("fallback"));
    expect(requests.filter((request) => "facts" in (request as object))).toHaveLength(1);
  });

  it("never asks anything through a static session (the styleguide, and tests)", () => {
    const session = staticMentorSession(initialMentorState());
    expect(session.askHint("check-the-blocker", [])).toBe(false);
    expect(session.state.explanations).toEqual([]);
    expect(session.state.review.status).toBe("idle");
  });
});

// ---------------------------------------------------------------------------------------------
// The deterministic template: what the player gets with no key, no network, or a busy model.

function facts(overrides: Partial<ReviewFacts> = {}): ReviewFacts {
  return {
    caseTitle: "The clean copy",
    objectives: [
      {
        id: "check-the-blocker",
        description: "Check the write-blocker.",
        kind: "main",
        done: true,
        hintsOpened: 1,
      },
      {
        id: "find-the-note",
        description: "Find the note.",
        kind: "main",
        done: false,
        hintsOpened: 0,
      },
      {
        id: "md5-as-well",
        name: "Belt And Braces",
        description: "Check the MD5 too.",
        kind: "secret",
        done: true,
        hintsOpened: 0,
      },
    ],
    minutes: 14,
    commandLines: [
      "blocker",
      "acquire /dev/evidence/qf-lt-03 --out images/x.img",
      "lfs images/x.img",
    ],
    knownCommands: ["blocker", "acquire", "lsfs", "hashsum"],
    pinCount: 2,
    custody: {
      order: ["hashed", "acquired", "examined"],
      hashedFirst: true,
      readAroundBlocker: false,
    },
    findings: { supported: 2, total: 3 },
    resets: 0,
    lessonIds: ["foundations-chain-of-custody", "foundations-hashing-for-evidence"],
    ...overrides,
  };
}

describe("the template review, for when the model is unavailable", () => {
  it("leads with what the player did, and names the bonus they found", () => {
    const review = buildFallbackReview(facts());
    expect(review.wellDone).toContain("1 of 2 main objectives in The clean copy");
    expect(review.wellDone).toContain("Belt And Braces");
    expect(review.wellDone).toContain("2 of 3 findings supported");
  });

  it("always says how the chain of custody read", () => {
    expect(buildFallbackReview(facts()).custody).toContain("starts with a hash");
    const late = buildFallbackReview(
      facts({
        custody: { order: ["examined", "hashed"], hashedFirst: false, readAroundBlocker: true },
      }),
    );
    expect(late.custody).toContain("opened before a hash was taken");
    // Never a telling-off: it says what to do next time, and that nothing is lost.
    expect(late.custody).toContain("Nothing is lost");
    expect(late.custody).toContain("write-blocker");
  });

  it("says something useful even when nothing has touched the evidence yet", () => {
    const empty = custodySentence({ order: [], hashedFirst: false, readAroundBlocker: false });
    expect(empty).toContain("empty this time");
  });

  it("suggests the case's own lessons and nothing else", () => {
    const review = buildFallbackReview(facts());
    expect(review.tryNext.map((lesson) => lesson.lessonId)).toEqual([
      "foundations-chain-of-custody",
      "foundations-hashing-for-evidence",
    ]);
  });

  it("never judges an approach it cannot see", () => {
    const review = buildFallbackReview(facts());
    expect(review.efficientSteps).toEqual([]);
    expect(review.detours).toEqual([]);
  });

  it("lists only commands the workstation has, so a typo isn't credited", () => {
    // `lfs` is a typo for `lsfs`, so it never shows as a command the player used.
    expect(commandNames(facts().commandLines, facts().knownCommands)).toEqual([
      "blocker",
      "acquire",
    ]);
  });
});

describe("your case at a glance", () => {
  it("shows the counts, the findings, the pins and whether they hashed first", () => {
    const lines = runFactLines(facts());
    const value = (label: string) => lines.find((line) => line.label === label)?.value;
    expect(value("Main objectives")).toBe("1 of 2 done");
    expect(value("Findings supported")).toBe("2 of 3");
    expect(value("Evidence pinned")).toContain("2 pieces");
    expect(value("Hashed first")).toContain("yes");
    expect(value("Time")).toBe("about 14 minutes");
    // Hints are free, and the line says so rather than counting them against anyone.
    expect(value("Hints opened")).toContain("always free");
  });

  it("says so plainly when the hash did not come first", () => {
    const lines = runFactLines(
      facts({
        custody: { order: ["examined"], hashedFirst: false, readAroundBlocker: false },
      }),
    );
    expect(lines.find((line) => line.label === "Hashed first")?.value).toBe("not this time");
  });

  it("leaves the findings row out for a case with no report questions", () => {
    const lines = runFactLines(facts({ findings: null }));
    expect(lines.some((line) => line.label === "Findings supported")).toBe(false);
  });
});
