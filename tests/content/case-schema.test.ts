import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import { parseCase, type Case, type CaseInput } from "@/content/cases/schema";
import { CASE_FILE_EXTENSION, CASES_DIR, isFixtureCase, toCaseSpec } from "@/features/cases/server";
import { stableStringify, type CaseSpec } from "@/sim";
import { catalog } from "./support";

/**
 * Group 1 of docs/plan/03-case-format-and-generator.md §Tests: **every case parses, with readable
 * errors**.
 *
 * A case file is the one thing an author writes by hand, so the schema's job is not only to be
 * right but to say what is wrong in the author's own words: which field, what was expected, and
 * what to change. Each test below breaks the fixture in exactly one way — so every other part of
 * the case is whole around it — and reads back the message somebody would actually get.
 */

/** The schema's output is what the generator takes. If this stops compiling, they have drifted. */
const _bridge: (entry: Case) => CaseSpec = toCaseSpec;
void _bridge;

describe("the case catalog", () => {
  it("loads every case file, and finds the fixture", () => {
    expect(catalog.all.length).toBeGreaterThan(0);
    expect(catalog.all.map((entry) => entry.id)).toContain("_fixture");
  });

  it("keeps fixtures out of the list a player sees", () => {
    expect(catalog.cases.every((entry) => !isFixtureCase(entry.id))).toBe(true);
    expect(catalog.getCase("_fixture")).toBeDefined();
  });

  it("names each case after its file", () => {
    for (const entry of catalog.all) {
      const path = join(CASES_DIR, `${entry.id}${CASE_FILE_EXTENSION}`);
      expect(() => readFileSync(path, "utf8")).not.toThrow();
    }
  });
});

describe("the messages an author sees", () => {
  const fixture = parseYaml(readFileSync(join(CASES_DIR, "_fixture.yaml"), "utf8")) as Record<
    string,
    unknown
  >;

  /** The fixture with one thing changed, so every check has a whole, valid case around it. */
  const broken = (change: (draft: Record<string, unknown>) => void): readonly string[] => {
    const draft = structuredClone(fixture);
    change(draft);
    const result = parseCase(draft);
    expect(result.success, "this case was supposed to fail").toBe(false);
    return result.success ? [] : result.problems;
  };

  const says = (problems: readonly string[], pattern: RegExp) =>
    expect(problems.join("\n")).toMatch(pattern);

  it("accepts the fixture as it stands", () => {
    expect(parseCase(fixture).success).toBe(true);
  });

  it("suggests the field an author meant", () => {
    says(
      broken((draft) => {
        draft.hnits = draft.hints;
        delete draft.hints;
      }),
      /Unknown field "hnits"\. Did you mean "hints"\?/,
    );
  });

  it("says which actions there are when `do` is misspelt", () => {
    says(
      broken((draft) => {
        const story = draft.story as Record<string, unknown>[];
        story[0] = { ...story[0], do: "log-on" };
      }),
      /isn't something a story can do[\s\S]*logon/,
    );
  });

  it("refuses a time without a zone", () => {
    says(
      broken((draft) => {
        const story = draft.story as Record<string, unknown>[];
        story[0] = { ...story[0], at: "2026-04-11 08:12:00" };
      }),
      /explicit zone/,
    );
  });

  it("refuses an address that could be somebody's real machine", () => {
    says(
      broken((draft) => {
        const story = draft.story as Record<string, unknown>[];
        const remote = story.find(
          (action) =>
            action.do === "logon" &&
            typeof action.with === "object" &&
            action.with !== null &&
            "from" in action.with,
        );
        (remote?.with as Record<string, unknown>).from = "93.184.216.34";
      }),
      /Only reserved addresses/,
    );
  });

  it("refuses a name that isn't obviously made up", () => {
    says(
      broken((draft) => {
        const story = draft.story as Record<string, unknown>[];
        story.push({
          at: "2026-04-11T08:13:00Z",
          actor: "system",
          on: "qf-lt-03",
          do: "dns-query",
          query: "a-real-company.co.uk",
        });
      }),
      /Only made-up names/,
    );
  });

  it("refuses a first hint that names a command", () => {
    says(
      broken((draft) => {
        const hints = draft.hints as Record<string, string[]>;
        hints["read-the-letter"] = [
          "Use `cat` on the letter.",
          "The second hint.",
          "The third hint.",
        ];
      }),
      /first hint names a command/,
    );
  });

  it("asks for three hints, in three tiers", () => {
    says(
      broken((draft) => {
        const hints = draft.hints as Record<string, string[]>;
        hints["read-the-letter"] = ["Only one."];
      }),
      /exactly three hints/,
    );
  });

  it("counts the main objectives", () => {
    says(
      broken((draft) => {
        const objectives = draft.objectives as Record<string, unknown>[];
        draft.objectives = objectives.slice(0, 1);
      }),
      /3 to 6 main objectives/,
    );
  });

  it("names the machines a story action can happen on", () => {
    says(
      broken((draft) => {
        const story = draft.story as Record<string, unknown>[];
        story[0] = { ...story[0], on: "qf-lt-04" };
      }),
      /There's no machine called "qf-lt-04"\. Did you mean "qf-lt-03"\?/,
    );
  });

  it("checks a report question points at a story action that exists", () => {
    says(
      broken((draft) => {
        const report = draft.report as { questions: Record<string, unknown>[] };
        report.questions[0] = { ...report.questions[0], answerFrom: "docket-vanished" };
      }),
      /No story action has the id "docket-vanished"/,
    );
  });

  it("checks an objective points at a report question that exists", () => {
    says(
      broken((draft) => {
        const objectives = draft.objectives as Record<string, unknown>[];
        const last = objectives.length - 1;
        objectives[last] = {
          ...objectives[last],
          check: { kind: "reported", question: "when-it-rained" },
        };
      }),
      /There's no report question with the id "when-it-rained"/,
    );
  });

  it("keeps a document from replacing the letter, or another document", () => {
    says(
      broken((draft) => {
        draft.documents = [{ file: "letter.txt", content: "Something else" }];
      }),
      /already has letter\.txt and handover\.txt/,
    );
    says(
      broken((draft) => {
        draft.documents = [
          { file: "door-log.txt", content: "One" },
          { file: "door-log.txt", content: "Two" },
        ];
      }),
      /Two documents are called "door-log\.txt"/,
    );
  });

  it("gives feedback only to a choice question's other choices", () => {
    const choice = {
      id: "whose-report",
      ask: "What does the report say?",
      type: "choice",
      answer: "What the evidence shows",
      choices: ["What the evidence shows", "What the client wants"],
      acceptedEvidence: ["disk:qf-lt-03:mft/*docket-4471*"],
      explain: "The evidence decides.",
    };
    const withFeedback = (feedback: unknown) =>
      broken((draft) => {
        const report = draft.report as { questions: Record<string, unknown>[] };
        report.questions.push({ ...choice, feedback });
      });
    says(
      withFeedback([{ choice: "What the evidence shows", speaker: "mentor-noor", text: "Yes." }]),
      /That is the answer/,
    );
    says(
      withFeedback([{ choice: "Something nobody offered", speaker: "mentor-noor", text: "No." }]),
      /isn't one of the choices/,
    );
    says(
      withFeedback([{ choice: "What the client wants", speaker: "the-owner", text: "No." }]),
      /isn't in the cast/,
    );

    const fine = structuredClone(fixture);
    (fine.report as { questions: Record<string, unknown>[] }).questions.push({
      ...choice,
      feedback: [{ choice: "What the client wants", speaker: "mentor-noor", text: "Pick again." }],
    });
    expect(parseCase(fine).success).toBe(true);
  });

  it("checks a timestamp answer is a time", () => {
    says(
      broken((draft) => {
        const report = draft.report as { questions: Record<string, unknown>[] };
        report.questions[0] = { ...report.questions[0], answer: "late at night" };
      }),
      /time with its zone/,
    );
  });

  it("checks the debrief mirrors the learning goals", () => {
    says(
      broken((draft) => {
        const debrief = draft.debrief as { whatYouLearned: string[] };
        debrief.whatYouLearned = [debrief.whatYouLearned[0] as string];
      }),
      /one line for each learning goal/,
    );
  });

  it("names where the problem is, in the author's own words", () => {
    const problems = broken((draft) => {
      const objectives = draft.objectives as Record<string, unknown>[];
      objectives[0] = { ...objectives[0], why: "" };
    });
    says(problems, /objectives\[read-the-letter\]\.why/);
  });

  it("refuses an empty file and a file that isn't a case at all", () => {
    expect(parseCase(null).success).toBe(false);
    expect(parseCase("a string").success).toBe(false);
  });

  it("takes a case written with `with:` groups exactly as one written flat", () => {
    const flat = structuredClone(fixture);
    const story = flat.story as Record<string, unknown>[];
    flat.story = story.map((action) => {
      const { with: grouped, ...rest } = action;
      return typeof grouped === "object" && grouped !== null
        ? { ...rest, ...(grouped as Record<string, unknown>) }
        : action;
    });

    const one = parseCase(fixture);
    const two = parseCase(flat as CaseInput);
    expect(two.success).toBe(true);
    expect(one.success && two.success && stableStringify(one.case.story)).toBe(
      two.success ? stableStringify(two.case.story) : "",
    );
  });
});
