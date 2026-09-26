import { getGlossaryEntry } from "@/content/glossary";
import type { GlossaryEntry } from "@/content/schemas/glossary";
import { askableObjective, type MentorCase } from "./case-view";
import { manPageFor } from "./man-page";
import {
  buildExplainSystemPrompt,
  buildExplainUserMessage,
  EXPLAIN_PROMPT_VERSION,
  type ExplainPromptInput,
} from "./prompts/explain.v1";
import { renderTranscript, screenBlock, selectionBlock } from "./prompts/noor.v1";
import type { ExplainSubject } from "./protocol";
import type { HintPrompt } from "./prompt-builder";
import type { MentorTranscript } from "./transcript";

/**
 * Builds exactly what is sent to the model for one "Explain this" request (docs/plan/14-mentor.md
 * §Spec). Vendored from `../hacker-simulation/src/features/mentor/explain-prompt.ts` and adapted
 * (VENDORED.md): it takes a `MentorCase`, it handles a row from any of the three investigator
 * views as well as terminal output, and for terminal output it looks the **tool's man page** up in
 * the registry and puts that in the prompt.
 *
 * Pure and unit-tested, like the hint prompt. The model gets the case's title, the step the player
 * is on (its description only), a glossary definition when a word is asked about, the tool's own
 * documentation when a command's output is, and the player's screen as delimited data. It never
 * gets the evidence set, a hint, an objective's check or success line, a report answer, an accepted
 * ref, the story or the debrief: explaining what's on the player's screen needs none of them, and
 * a `MentorCase` holds none of them anyway.
 */

export type BuildExplainPromptResult =
  | { readonly ok: true; readonly prompt: HintPrompt }
  | { readonly ok: false; readonly problem: "unknown_term" };

export interface ExplainPromptRequest {
  readonly objectiveId?: string;
  readonly subject: ExplainSubject;
  readonly transcript: MentorTranscript;
}

/** The row a view drew, as one delimited selection. */
function rowSelection(text: string, title: string | undefined): string {
  return selectionBlock(title === undefined ? text : `${title}\n${text}`);
}

export function buildExplainPrompt(
  caseView: MentorCase,
  request: ExplainPromptRequest,
  getTerm: (id: string) => GlossaryEntry | undefined = getGlossaryEntry,
): BuildExplainPromptResult {
  // The step the player is on, for context. A secret or an unknown id adds none (a secret's words
  // stay out of the prompt: it is off the list until the player has found it).
  const objective =
    request.objectiveId === undefined ? undefined : askableObjective(caseView, request.objectiveId);

  const { subject } = request;
  let promptSubject: ExplainPromptInput["subject"];
  let selection: string | undefined;
  if (subject.kind === "term") {
    const entry = getTerm(subject.termId);
    if (!entry) return { ok: false, problem: "unknown_term" };
    promptSubject = {
      kind: "term",
      term: { term: entry.term, short: entry.short, long: entry.long },
    };
  } else if (subject.kind === "row") {
    promptSubject = { kind: "row", view: subject.view };
    selection = rowSelection(subject.text, subject.title);
  } else {
    // The man page is the tool's own documentation, read from the registry by the command's name.
    // An unknown command simply has none.
    const man = manPageFor(subject.command);
    if (subject.scope === "line") {
      promptSubject = { kind: "line", error: subject.error, ...(man && { man }) };
      selection = selectionBlock(
        `From the command: $ ${subject.command}\nThe line: ${subject.text}`,
      );
    } else {
      promptSubject = { kind: "output", ...(man && { man }) };
      selection = selectionBlock(
        `$ ${subject.command}\n${subject.text.trim() === "" ? "(no output)" : subject.text}`,
      );
    }
  }

  const system = buildExplainSystemPrompt({
    caseTitle: caseView.title,
    ...(objective && { objectiveDescription: objective.description }),
    subject: promptSubject,
  });
  const content = buildExplainUserMessage({
    ...(selection !== undefined && { selection }),
    screen: screenBlock(renderTranscript(request.transcript)),
  });

  return {
    ok: true,
    prompt: { version: EXPLAIN_PROMPT_VERSION, system, messages: [{ role: "user", content }] },
  };
}
