import { describe, expect, it } from "vitest";
import type { Case } from "@/content/cases/schema";
import { listCases } from "@/features/cases/server";
import { askableObjective, toMentorCase, unlockedTiers } from "@/features/mentor/case-view";
import { buildExplainPrompt } from "@/features/mentor/explain-prompt";
import { buildHintPrompt } from "@/features/mentor/prompt-builder";
import { buildReviewPrompt } from "@/features/mentor/review-prompt";

/**
 * **The answer key is never loaded into the model's context at all** (docs/plan/14-mentor.md §Spec).
 *
 * The other injection tests show that no wording can talk a hint tier out of a prompt. This one
 * shows something stronger and simpler: for every case this repo ships, the projection the mentor's
 * server side is built on (`toMentorCase`, src/features/mentor/case-view.ts) contains none of the
 * answer key, and neither does any of the three prompts built from it.
 *
 * "None of it" is checked by walking the case file's own values rather than by listing fields, so a
 * new field in the case schema is covered the day it is added: every report answer, every accepted
 * evidence pattern, every objective's check and success line, every story action and every line of
 * the debrief is searched for in the projection and in each prompt's full text.
 */

const CASES: readonly Case[] = listCases();

/** Every string anywhere inside a value, so a check's nested shape is walked too. */
function strings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, into);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value)) strings(item, into);
  }
  return into;
}

/**
 * Everything about a case that must never reach a model, as strings. Short ones are dropped: a
 * one-word value like "choice" or an id says nothing on its own and would match any prose.
 */
function secretsOf(entry: Case): string[] {
  const secrets = [
    // The report: every answer, and every pattern saying which evidence is accepted for it.
    ...entry.report.questions.flatMap((question) => [
      question.answer,
      ...question.acceptedEvidence,
      question.explain,
      ...(question.choices ?? []),
    ]),
    // Each objective's check (answers, patterns, refs, rules) and its celebration line.
    ...entry.objectives.flatMap((objective) => [...strings(objective.check), objective.success]),
    // The ground-truth story: what really happened, on which machine, at which instant.
    ...strings(entry.story),
    // The debrief, which says what the player was supposed to work out.
    entry.debrief.summary,
    ...entry.debrief.whatYouLearned,
    entry.debrief.ethicsNote,
    entry.debrief.nextTease,
  ];
  return [...new Set(secrets)].filter((secret) => secret.trim().length > 12);
}

describe.each(CASES.map((entry) => [entry.id, entry] as const))(
  "%s: the projection holds no answer key",
  (_id, entry) => {
    const view = toMentorCase(entry);
    const projected = strings(view).join("\n");

    it("keeps the objectives, their why, and their hints", () => {
      expect(view.title).toBe(entry.title);
      expect(view.objectives).toHaveLength(entry.objectives.length);
      for (const objective of entry.objectives) {
        const seen = view.objectives.find((candidate) => candidate.id === objective.id);
        expect(seen).toBeDefined();
        expect(seen?.description).toBe(objective.description);
        expect(seen?.why).toBe(objective.why);
        expect(seen?.hints).toEqual(entry.hints[objective.id] ?? []);
      }
    });

    it("has no report, story, evidence, machines or debrief field at all", () => {
      // Not "is empty": absent. A field that isn't there can't be leaked by a later change.
      for (const field of [
        "report",
        "story",
        "evidence",
        "machines",
        "noise",
        "beats",
        "debrief",
      ]) {
        expect(Object.hasOwn(view, field)).toBe(false);
      }
      for (const objective of view.objectives) {
        expect(Object.hasOwn(objective, "check")).toBe(false);
        expect(Object.hasOwn(objective, "success")).toBe(false);
      }
    });

    it("contains not one string from the answer key", () => {
      for (const secret of secretsOf(entry)) {
        expect(projected).not.toContain(secret);
      }
    });

    it("gives a secret objective no hints, so none can be asked for", () => {
      for (const objective of view.objectives.filter((candidate) => candidate.hidden)) {
        expect(objective.hints).toEqual([]);
        expect(askableObjective(view, objective.id)).toBeUndefined();
        expect(unlockedTiers(objective, 1)).toBeUndefined();
      }
    });
  },
);

describe.each(CASES.map((entry) => [entry.id, entry] as const))(
  "%s: no prompt built from it carries the answer key",
  (_id, entry) => {
    const view = toMentorCase(entry);
    const secrets = secretsOf(entry);
    const transcript = [{ input: "lsfs images/qf-lt-03.img -l", output: "a line of output" }];

    /** Every prompt the mentor can build for this case, as full text. */
    function prompts(): string[] {
      const texts: string[] = [];
      const add = (prompt: { system: string; messages: readonly { content: string }[] }) =>
        texts.push([prompt.system, ...prompt.messages.map((m) => m.content)].join("\n"));

      // A hint at every tier, for every objective that has hints.
      for (const objective of view.objectives) {
        for (const tier of [1, 2, 3] as const) {
          const built = buildHintPrompt(view, objective.id, tier, transcript);
          if (built.ok) add(built.prompt);
        }
      }
      // "Explain this" on each surface, and on a glossary word.
      const subjects = [
        {
          kind: "output" as const,
          command: "inode images/qf-lt-03.img 4213",
          text: "a line",
          scope: "line" as const,
          error: false,
        },
        { kind: "row" as const, view: "evidence" as const, text: "a row" },
        { kind: "row" as const, view: "timeline" as const, text: "an entry" },
        { kind: "row" as const, view: "board" as const, text: "a card" },
      ];
      for (const subject of subjects) {
        for (const objective of [undefined, ...view.objectives.map((o) => o.id)]) {
          const built = buildExplainPrompt(view, {
            ...(objective !== undefined && { objectiveId: objective }),
            subject,
            transcript,
          });
          if (built.ok) add(built.prompt);
        }
      }
      // The review, with everything ticked, so every objective's words are in play.
      add(
        buildReviewPrompt(view, {
          completed: entry.objectives.map((objective) => objective.id),
          hintsOpened: Object.fromEntries(
            entry.objectives.map((objective) => [objective.id, 3] as const),
          ),
          custody: {
            order: ["acquired", "hashed", "examined", "pinned", "submitted"],
            hashedFirst: true,
            readAroundBlocker: false,
          },
          pinCount: 4,
          findings: { supported: 3, total: 3 },
          minutes: 22,
          resets: 1,
          commandCount: 18,
          transcript,
        }).prompt,
      );
      return texts;
    }

    it("builds at least one prompt to check", () => {
      expect(prompts().length).toBeGreaterThan(0);
    });

    it("carries no report answer, accepted ref, check, success line, story or debrief copy", () => {
      const texts = prompts();
      for (const text of texts) {
        for (const secret of secrets) {
          expect(text).not.toContain(secret);
        }
      }
    });

    it("never carries a hint tier the player hasn't unlocked", () => {
      for (const objective of view.objectives) {
        if (objective.hints.length === 0) continue;
        for (const tier of [1, 2] as const) {
          const built = buildHintPrompt(view, objective.id, tier, transcript);
          expect(built.ok).toBe(true);
          if (!built.ok) continue;
          const text = [built.prompt.system, built.prompt.messages[0]?.content].join("\n");
          for (const later of objective.hints.slice(tier)) {
            expect(text).not.toContain(later);
          }
          // And every other objective's hints stay out too.
          for (const other of view.objectives) {
            if (other.id === objective.id) continue;
            for (const hint of other.hints) expect(text).not.toContain(hint);
          }
        }
      }
    });
  },
);
