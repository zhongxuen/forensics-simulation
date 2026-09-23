import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import {
  isFictionalHostname,
  isReservedAddress,
  parseCase,
  parseCaseTime,
  type Case,
  type CaseInput,
} from "@/content/cases/schema";
import {
  buildCase,
  CASE_FILE_EXTENSION,
  CASES_DIR,
  isFixtureCase,
  loadCaseCatalog,
  toCaseSpec,
} from "@/features/cases/server";
import { resolveRef, stableStringify, type CaseSpec } from "@/sim";
import { isFictionalHostname as engineHostname } from "@/sim/net/names";
import { isReservedIp, parseIpv4 } from "@/sim/net/ip";

/**
 * Every case validates, builds, and agrees with the evidence committed beside it
 * (docs/plan/03-case-format-and-generator.md §Tests). These are the checks that make a case cheap
 * to write and hard to break: change a story action and the evidence, the answer key and the
 * committed JSON all have to move with it, or this fails and says which.
 *
 * The rest of the seven groups — consistency, solvability and the authoring scripts — arrive with
 * prompt 03.2.
 */

const EVIDENCE_DIR = join(process.cwd(), "src", "content", "evidence");
const catalog = loadCaseCatalog();

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

describe.each(catalog.all.map((entry) => [entry.id, entry] as const))("%s", (id, entry) => {
  const built = buildCase(entry);

  it("builds evidence its report questions can actually point at", () => {
    for (const question of entry.report.questions) {
      const refs = built.acceptedRefs.get(question.id) ?? [];
      expect(refs.length, `${question.id} matches nothing`).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(resolveRef(built.evidence, ref), `${question.id}: ${ref}`).toBeDefined();
      }
    }
  });

  it("gives every answer that names a story action the time that action happened", () => {
    for (const question of entry.report.questions) {
      if (question.answerFrom === undefined) continue;
      const action = entry.story.find((item) => item.id === question.answerFrom);
      expect(action, `${question.id}: answerFrom names no action`).toBeDefined();
      if (question.type !== "timestamp") continue;

      const answered = parseCaseTime(question.answer);
      expect(
        Math.abs((answered ?? 0) - (action?.at ?? 0)) / 1000,
        `${question.id}: the answer and the "${question.answerFrom}" action are at different times`,
      ).toBeLessThanOrEqual(question.toleranceSeconds ?? 0);
    }
  });

  it("has the evidence committed beside it that its story builds today", () => {
    const committed = readFileSync(join(EVIDENCE_DIR, id, "evidence.json"), "utf8");
    expect(
      committed,
      `${id}'s committed evidence is out of date. Run \`pnpm evidence:build\`.`,
    ).toBe(`${stableStringify(built.evidence, 2)}\n`);
  });

  it("only ever names reserved addresses and made-up hosts", () => {
    const text = JSON.stringify(entry);
    for (const [address] of text.matchAll(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g)) {
      expect(isReservedAddress(address), `${id} names ${address}`).toBe(true);
    }
  });

  it("stays small enough to load without spoiling a page's budget", () => {
    const bytes = Buffer.byteLength(stableStringify(built.evidence));
    expect(bytes, `${id}'s evidence is ${(bytes / 1024).toFixed(0)} KB`).toBeLessThan(400 * 1024);
  });
});

describe("the world rules", () => {
  it("agrees with the engine about which addresses are reserved", () => {
    const addresses = [
      "10.60.0.21",
      "192.168.1.1",
      "172.16.4.9",
      "172.32.4.9",
      "127.0.0.1",
      "192.0.2.5",
      "198.51.100.7",
      "203.0.113.47",
      "8.8.8.8",
      "1.1.1.1",
      "300.1.1.1",
    ];
    for (const address of addresses) {
      const engine = parseIpv4(address) !== undefined && isReservedIp(parseIpv4(address) ?? 0);
      expect(isReservedAddress(address), address).toBe(engine);
    }
  });

  it("agrees with the engine about which names can only be made up", () => {
    for (const name of [
      "quillfen.example",
      "cdn-sync.example",
      "localhost",
      "qf-lt-07",
      "example.com",
      "a-real-company.co.uk",
      "google.com",
    ]) {
      expect(isFictionalHostname(name), name).toBe(engineHostname(name));
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
