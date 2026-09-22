import { z } from "zod";
import { MINI_TERMINAL_IDS } from "../mini-terminals";

/**
 * The props of the interactive lesson components (md-files/09-learning-center.md, "Interactive MDX
 * components" and prompt 09.2), as schemas. Lessons are MDX, so a component's props are written
 * by hand in a lesson file: each component validates them while the lesson renders, and every
 * lesson is rendered in CI (tests/unit/content-references.test.ts), so a mistake fails the build
 * with a message that says what to fix.
 */

/** Required, non-blank text. `what` finishes "Missing: add …". */
function text(what: string) {
  return z
    .string({
      error: (issue) =>
        issue.input === undefined ? `Missing: add ${what}.` : `Should be text (${what}).`,
    })
    .trim()
    .min(1, `Can't be empty: add ${what}.`);
}

// ---------------------------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------------------------

export const QUIZ_OPTIONS_MIN = 2;
export const QUIZ_OPTIONS_MAX = 5;

const QuizOptionSchema = z.strictObject({
  /** The answer, as the learner reads it. Backticks mark code. */
  text: text("the answer, as the learner reads it"),
  /** Exactly one option per quiz is correct. */
  correct: z.boolean().default(false),
  /**
   * Why this option is right, or why it isn't. Required on every option, the wrong ones included:
   * a learner who picks a wrong answer gets "Not quite" and this line, then tries again.
   */
  explanation: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? "Every option needs an explanation, the wrong ones included: say why it's right, or why it isn't."
          : "Should be text.",
    })
    .trim()
    .min(
      1,
      "Every option needs an explanation, the wrong ones included: say why it's right, or why it isn't.",
    ),
});

/**
 * `<Quiz question="…" options={[{ text, correct, explanation }, …]} />`: one question, 2 to 5
 * options, exactly one correct, and an explanation on every option.
 */
export const QuizSchema = z
  .strictObject({
    question: text("the question"),
    options: z
      .array(QuizOptionSchema, { error: "Missing: add the options, as a list." })
      .min(QUIZ_OPTIONS_MIN, `Give at least ${QUIZ_OPTIONS_MIN} options.`)
      .max(QUIZ_OPTIONS_MAX, `Keep it to ${QUIZ_OPTIONS_MAX} options or fewer.`),
  })
  .superRefine((quiz, ctx) => {
    const correct = quiz.options.filter((option) => option.correct).length;
    if (correct !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: `Mark exactly one option as correct: true (this quiz has ${correct}).`,
      });
    }
    const seen = new Set<string>();
    quiz.options.forEach((option, index) => {
      const key = option.text.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["options", index, "text"],
          message: `Two options say "${option.text}". Make each option different.`,
        });
      }
      seen.add(key);
    });
  });

export type QuizInput = z.input<typeof QuizSchema>;
export type Quiz = z.output<typeof QuizSchema>;
export type QuizOption = Quiz["options"][number];

// ---------------------------------------------------------------------------------------------
// MiniTerminal
// ---------------------------------------------------------------------------------------------

/**
 * `<MiniTerminal scenario="range-home" commands={["whoami"]} task="…" expect="whoami" success="…" />`:
 * the real terminal on one of the tiny practice machines in src/content/mini-terminals.ts.
 * `expect` names a command that completes the exercise when it runs without an error; it needs a
 * `task` (what to do) and a `success` line (shown with a tick).
 */
export const MiniTerminalSchema = z
  .strictObject({
    scenario: z.enum(MINI_TERMINAL_IDS as [string, ...string[]], {
      error: (issue) =>
        issue.input === undefined
          ? `Missing: add scenario, one of: ${MINI_TERMINAL_IDS.join(", ")}.`
          : `"${String(issue.input)}" isn't a practice machine. Use one of: ${MINI_TERMINAL_IDS.join(", ")} (src/content/mini-terminals.ts).`,
    }),
    /** Commands for the suggestion chips. Defaults to ones that work where the learner is. */
    commands: z.array(text("a command")).max(6, "Suggest 6 commands or fewer.").optional(),
    /** What to do, in one or two sentences: "Type `whoami` and press Enter." */
    task: text("the task: what to type").optional(),
    /** The command that completes the task when it works: `whoami`. */
    expect: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/, "Use the command's name exactly as it's typed, like `whoami`.")
      .optional(),
    /** Shown with a tick once the expected command works. */
    success: text("the success line").optional(),
  })
  .superRefine((mini, ctx) => {
    if (mini.expect !== undefined && (mini.task === undefined || mini.success === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["expect"],
        message:
          "With expect, also add task (what to type) and success (the line shown when it works).",
      });
    }
    if (mini.success !== undefined && mini.expect === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["success"],
        message: "success needs expect: the command that completes the task.",
      });
    }
  });

export type MiniTerminalProps = z.output<typeof MiniTerminalSchema>;

// ---------------------------------------------------------------------------------------------
// PacketDiagram and Annotated
// ---------------------------------------------------------------------------------------------

/**
 * `<PacketDiagram title="…" fields={[{ label, value, size, note }, …]} />`: a message broken into
 * its parts, left to right, each with a plain-language note. `size` is the part's relative width
 * (1 to 8), so a big part looks big.
 */
export const PacketDiagramSchema = z.strictObject({
  title: text("the title: what the message is"),
  fields: z
    .array(
      z.strictObject({
        label: text("the part's name").max(32, "Keep the label to 32 characters or fewer."),
        value: z
          .string()
          .trim()
          .min(1)
          .max(40, "Keep the value short: 40 characters or fewer.")
          .optional(),
        size: z.number().int().min(1).max(8).default(1),
        note: text("a note: what this part is for, in plain words"),
      }),
      { error: "Missing: add the fields, as a list." },
    )
    .min(2, "Break the message into at least 2 parts.")
    .max(10, "Keep it to 10 parts or fewer."),
  caption: text("a caption").optional(),
});

export type PacketDiagramProps = z.output<typeof PacketDiagramSchema>;

/**
 * `<Annotated title="…" code={`…`} notes={[{ line, label, text }, …]} />`: some terminal output
 * or a file, with numbered notes pinned to its lines. Lines count from 1.
 */
export const AnnotatedSchema = z
  .strictObject({
    title: text("the title").optional(),
    code: text("the text to annotate"),
    notes: z
      .array(
        z.strictObject({
          line: z.number().int().min(1),
          label: text("a short label").max(40, "Keep the label to 40 characters or fewer."),
          text: text("the note, in plain words"),
        }),
        { error: "Missing: add the notes, as a list." },
      )
      .min(1, "Add at least one note.")
      .max(8, "Keep it to 8 notes or fewer."),
  })
  .superRefine((annotated, ctx) => {
    const lines = annotated.code.replace(/\n$/, "").split("\n").length;
    const seen = new Set<number>();
    annotated.notes.forEach((note, index) => {
      if (note.line > lines) {
        ctx.addIssue({
          code: "custom",
          path: ["notes", index, "line"],
          message: `Line ${note.line} doesn't exist: the text has ${lines} lines.`,
        });
      }
      if (seen.has(note.line)) {
        ctx.addIssue({
          code: "custom",
          path: ["notes", index, "line"],
          message: `Two notes point at line ${note.line}. Put them together in one note.`,
        });
      }
      seen.add(note.line);
    });
  });

export type AnnotatedProps = z.output<typeof AnnotatedSchema>;

// ---------------------------------------------------------------------------------------------
// Readable problems
// ---------------------------------------------------------------------------------------------

/**
 * Parses a component's props, or throws an Error naming the component and every problem as
 * `path: message`, for the author to fix.
 */
export function parseComponentProps<T extends z.ZodType>(
  component: string,
  schema: T,
  props: unknown,
): z.output<T> {
  const result = schema.safeParse(props);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => {
    const path = issue.path
      .map((segment) => (typeof segment === "number" ? `[${segment + 1}]` : `.${String(segment)}`))
      .join("")
      .replace(/^\./, "");
    return path === "" ? issue.message : `${path}: ${issue.message}`;
  });
  throw new Error(`<${component}> has problems:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
}
