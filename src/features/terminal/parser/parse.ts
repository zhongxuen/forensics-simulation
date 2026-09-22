/**
 * The parser: tokens in, a syntax tree out.
 *
 *   line     := list? comment?
 *   list     := pipeline ((";" | "&&" | "||") pipeline)* ";"?
 *   pipeline := command ("|" command)*
 *   command  := assignment* (word | redirect)+   (or assignments alone)
 *   redirect := ("<" | ">" | ">>" | "2>" | "2>>") word | "2>&1"
 *
 * Errors carry a stable code, the column of the problem, and the line bash would print. The parser
 * produces data and never evaluates anything.
 */
import { syntaxError, tokenize, type Token } from "./tokenize";
import type {
  AssignmentNode,
  CommandNode,
  ListItemNode,
  ParseResult,
  PipelineNode,
  RedirectNode,
  WordNode,
} from "./types";

const REDIRECTS = new Set(["<", ">", ">>", "2>", "2>>", "2>&1"]);

export function parseCommandLine(line: string): ParseResult {
  const tokenized = tokenize(line);
  if (!tokenized.ok) return tokenized;
  const tokens = tokenized.tokens;
  let index = 0;
  const peek = (): Token | undefined => tokens[index];
  const position = (token: Token | undefined) =>
    token === undefined ? line.length : token.kind === "word" ? token.word.start : token.start;
  const tokenText = (token: Token) => (token.kind === "word" ? token.word.raw : token.op);

  const items: ListItemNode[] = [];
  let operator: ListItemNode["operator"];

  while (index < tokens.length) {
    // A pipeline.
    const commands: CommandNode[] = [];
    for (;;) {
      const assignments: AssignmentNode[] = [];
      const words: WordNode[] = [];
      const redirects: RedirectNode[] = [];
      const start = position(peek());
      let end = start;
      for (let token = peek(); token !== undefined; token = peek()) {
        if (token.kind === "word") {
          if (words.length === 0 && token.assignment) {
            assignments.push({
              name: token.assignment.name,
              value: token.assignment.value,
              start: token.word.start,
              end: token.word.end,
            });
          } else {
            words.push(token.word);
          }
          end = token.word.end;
          index++;
          continue;
        }
        if (!REDIRECTS.has(token.op)) break;
        index++;
        if (token.op === "2>&1") {
          redirects.push({ op: "2>&1", start: token.start, end: token.end });
          end = token.end;
          continue;
        }
        const target = peek();
        if (target === undefined) return syntaxError("UNEXPECTED_END", line.length, "newline");
        if (target.kind !== "word") {
          return syntaxError("UNEXPECTED_TOKEN", target.start, target.op);
        }
        index++;
        redirects.push({
          op: token.op as RedirectNode["op"],
          target: target.word,
          start: token.start,
          end: target.word.end,
        });
        end = target.word.end;
      }
      if (assignments.length === 0 && words.length === 0 && redirects.length === 0) {
        const token = peek();
        if (token === undefined) {
          // Nothing after an operator that needs a command: `ls |`, `ls &&`.
          return syntaxError("UNEXPECTED_END", line.length, "");
        }
        return syntaxError("UNEXPECTED_TOKEN", position(token), tokenText(token));
      }
      commands.push({ assignments, words, redirects, start, end });
      const next = peek();
      if (next?.kind === "op" && next.op === "|") {
        index++;
        continue;
      }
      break;
    }
    const pipeline: PipelineNode = {
      commands,
      start: commands[0]?.start ?? 0,
      end: commands[commands.length - 1]?.end ?? 0,
    };
    items.push({
      when: operator === "&&" ? "success" : operator === "||" ? "failure" : "always",
      ...(operator !== undefined && { operator }),
      pipeline,
    });

    const next = peek();
    if (next === undefined) break;
    if (next.kind !== "op" || (next.op !== ";" && next.op !== "&&" && next.op !== "||")) {
      return syntaxError("UNEXPECTED_TOKEN", position(next), tokenText(next));
    }
    index++;
    operator = next.op;
    // A trailing ";" is fine; a trailing && or || needs a command after it.
    if (peek() === undefined) {
      if (next.op === ";") break;
      return syntaxError("UNEXPECTED_END", line.length, "");
    }
  }

  // A line that starts with an operator: `| ls`, `; ls`.
  if (items.length === 0 && tokens.length > 0) {
    const first = tokens[0] as Token;
    return syntaxError("UNEXPECTED_TOKEN", position(first), tokenText(first));
  }
  return {
    ok: true,
    ast: { items, ...(tokenized.comment !== undefined && { comment: tokenized.comment }) },
  };
}
