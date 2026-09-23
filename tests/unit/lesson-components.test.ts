import { prerender } from "react-dom/static";
import { describe, expect, it } from "vitest";
import { MINI_TERMINALS } from "@/content/mini-terminals";
import {
  AnnotatedSchema,
  MiniTerminalSchema,
  PacketDiagramSchema,
  parseComponentProps,
  QuizSchema,
} from "@/content/schemas/lesson-components";
import { findBannedWords } from "@/content/voice";
import { compileLessonBody, renderLessonBody } from "@/features/learning/server";
import { createTerminalSession, submitLine } from "@/features/terminal";
import { createInitialState } from "@/sim";

/**
 * The interactive lesson components (md-files/09-learning-center.md, prompt 09.2): their prop
 * schemas, and each one rendered through the real MDX pipeline. Vitest runs in plain Node, so this
 * checks the server-rendered markup: roles, labels and keyboard-reachable controls.
 */

/**
 * Renders the way the server does for a real page: it waits for every Suspense boundary, so the
 * lazily loaded <MiniTerminal> (prompt 11.3) arrives as the whole terminal, not its loading state.
 */
const render = async (mdx: string) => {
  const { prelude } = await prerender((await renderLessonBody(mdx, "test")).content);
  return new Response(prelude).text();
};

const QUIZ = `<Quiz
  question="Which one is a port?"
  options={[
    { text: "A numbered door on a computer", correct: true, explanation: "Yes: each port is a door for one kind of message." },
    { text: "A kind of cable", explanation: "Cables carry messages, but a port is a number, not a wire." },
  ]}
/>`;

describe("QuizSchema", () => {
  const option = (text: string, extra: object = {}) => ({
    text,
    explanation: "Because.",
    ...extra,
  });

  it("accepts a quiz with one correct option and an explanation on every option", () => {
    const quiz = QuizSchema.parse({
      question: "Q?",
      options: [option("A", { correct: true }), option("B")],
    });
    expect(quiz.options.map((o) => o.correct)).toEqual([true, false]);
  });

  it("rejects an option without an explanation, the wrong ones included", () => {
    expect(() =>
      parseComponentProps("Quiz", QuizSchema, {
        question: "Q?",
        options: [option("A", { correct: true }), { text: "B" }],
      }),
    ).toThrow(
      /options\[2\]\.explanation: Every option needs an explanation, the wrong ones included/,
    );
    expect(() =>
      parseComponentProps("Quiz", QuizSchema, {
        question: "Q?",
        options: [option("A", { correct: true }), { text: "B", explanation: "  " }],
      }),
    ).toThrow(/Every option needs an explanation/);
  });

  it("needs exactly one correct option, at least two options, and no repeats", () => {
    expect(() =>
      parseComponentProps("Quiz", QuizSchema, {
        question: "Q?",
        options: [option("A"), option("B")],
      }),
    ).toThrow(/exactly one option as correct/);
    expect(() =>
      parseComponentProps("Quiz", QuizSchema, {
        question: "Q?",
        options: [option("A", { correct: true })],
      }),
    ).toThrow(/at least 2 options/);
    expect(() =>
      parseComponentProps("Quiz", QuizSchema, {
        question: "Q?",
        options: [option("A", { correct: true }), option("a")],
      }),
    ).toThrow(/Two options say/);
  });
});

describe("the other schemas", () => {
  it("MiniTerminal needs a known practice machine, and a task and success line with expect", () => {
    expect(() =>
      parseComponentProps("MiniTerminal", MiniTerminalSchema, { scenario: "nope" }),
    ).toThrow(/isn't a practice machine/);
    expect(() =>
      parseComponentProps("MiniTerminal", MiniTerminalSchema, {
        scenario: "range-home",
        expect: "whoami",
      }),
    ).toThrow(/also add task/);
    expect(
      parseComponentProps("MiniTerminal", MiniTerminalSchema, { scenario: "range-home" }).scenario,
    ).toBe("range-home");
  });

  it("PacketDiagram needs at least two parts, each with a note", () => {
    expect(() =>
      parseComponentProps("PacketDiagram", PacketDiagramSchema, {
        title: "T",
        fields: [{ label: "A", note: "n" }],
      }),
    ).toThrow(/at least 2 parts/);
    expect(() =>
      parseComponentProps("PacketDiagram", PacketDiagramSchema, {
        title: "T",
        fields: [{ label: "A", note: "n" }, { label: "B" }],
      }),
    ).toThrow(/fields\[2\]\.note: Missing/);
  });

  it("Annotated notes must point at lines that exist, one note per line", () => {
    expect(() =>
      parseComponentProps("Annotated", AnnotatedSchema, {
        code: "one\ntwo",
        notes: [{ line: 3, label: "L", text: "t" }],
      }),
    ).toThrow(/Line 3 doesn't exist: the text has 2 lines/);
    expect(() =>
      parseComponentProps("Annotated", AnnotatedSchema, {
        code: "one\ntwo",
        notes: [
          { line: 1, label: "L", text: "t" },
          { line: 1, label: "M", text: "u" },
        ],
      }),
    ).toThrow(/Two notes point at line 1/);
  });
});

describe("rendered in a lesson", () => {
  it("Quiz: a radio group, a check button, and a polite live region for feedback", async () => {
    const html = await render(QUIZ);
    expect(html).toContain("<fieldset");
    expect(html).toContain("Which one is a port?");
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).toContain("Check my answer");
    expect(html).toContain('aria-live="polite"');
  });

  it("Quiz: a missing explanation fails the lesson", async () => {
    const broken = QUIZ.replace(
      ', explanation: "Cables carry messages, but a port is a number, not a wire."',
      "",
    );
    await expect(render(broken)).rejects.toThrow(/explanation/);
  });

  it("MiniTerminal: the real terminal, simulated, with the task as an objective", async () => {
    const html = await render(
      '<MiniTerminal scenario="range-home" commands={["whoami"]} task="Type `whoami`." expect="whoami" success="That is you." />',
    );
    expect(html).toContain('role="log"');
    expect(html).toContain("Simulated");
    expect(html).toContain("recruit@range-ws-01 (practice)");
    expect(html).toContain("To do: ");
    expect(html).toContain("whoami");
  });

  it("PacketDiagram: each part is a pressable button, the first one shown", async () => {
    const html = await render(
      '<PacketDiagram title="A message" fields={[{ label: "From", value: "192.168.60.10", note: "Who sent it." }, { label: "To", note: "Who it is for." }]} />',
    );
    expect(html).toMatch(/<button[^>]*aria-pressed="true"/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"/);
    expect(html).toContain("Who sent it.");
    expect(html).toContain("Read every part, in order");
  });

  it("Annotated: every note on screen, as buttons, with a focusable scroll area", async () => {
    const html = await render(
      '<Annotated title="ls -l" code={"total 1\\n-rw-r--r-- 1 recruit recruit 12 notes.txt"} notes={[{ line: 2, label: "The lock", text: "Who may read it." }]} />',
    );
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("The lock");
    expect(html).toContain("Who may read it.");
    expect(html).toMatch(/<button[^>]*aria-pressed="true"/);
  });

  it("collects <TryIt> mission ids, and refuses ids that aren't plain strings", async () => {
    const { missionIds } = await compileLessonBody(
      '<TryIt mission="net-01" />\n\n<TryIt mission="intro-01" />',
      "t",
    );
    expect(missionIds).toEqual(["net-01", "intro-01"]);
    await expect(compileLessonBody("<TryIt mission={id} />", "t")).rejects.toThrow(
      /plain mission id/,
    );
    await expect(compileLessonBody("<MiniTerminal scenario={x} />", "t")).rejects.toThrow(
      /plain scenario id/,
    );
  });
});

describe.each(MINI_TERMINALS.map((mini) => [mini.id, mini] as const))(
  "practice machine %s",
  (id, mini) => {
    it("builds with the engine, on the Range or the blue-team room", () => {
      const state = createInitialState(mini.scenario, mini.seed);
      expect(state.scenarioId).toBe(id);
      // The Range machines came with the vendored pipeline; this game's own practice machine is the
      // analyst workstation in the blue-team room (docs/plan/99-reference.md, "New world facts").
      const network = id === "ir-ws-practice" ? "10.20.0." : "192.168.60.";
      for (const host of Object.values(state.network.hosts)) {
        expect(host.interfaces.every((iface) => iface.ip.startsWith(network))).toBe(true);
      }
      expect(findBannedWords(mini.description)).toEqual([]);
    });

    it("runs whoami and ls without an error", () => {
      let session = createTerminalSession({ scenario: mini.scenario, seed: mini.seed });
      for (const line of ["whoami", "ls"]) {
        session = submitLine(session, line);
        expect(session.blocks.at(-1)?.exitCode, line).toBe(0);
      }
    });
  },
);
