/**
 * Turns the parser's syntax tree into the engine's ShellCommand: the same structure without
 * source positions. The engine runs the result; it never sees the text again.
 */
import type { ShellCommand, ShellRedirect, ShellSimpleCommand, ShellWord } from "@/sim/types";
import type { CommandLineNode, CommandNode, RedirectNode, WordNode } from "./types";

const word = (node: WordNode): ShellWord => ({ parts: node.parts });

function redirect(node: RedirectNode): ShellRedirect {
  switch (node.op) {
    case "2>&1":
      return { fd: 2, mode: "write" };
    case "<":
      return { fd: 0, mode: "read", ...(node.target && { target: word(node.target) }) };
    case ">":
    case ">>":
      return {
        fd: 1,
        mode: node.op === ">>" ? "append" : "write",
        ...(node.target && { target: word(node.target) }),
      };
    case "2>":
    case "2>>":
      return {
        fd: 2,
        mode: node.op === "2>>" ? "append" : "write",
        ...(node.target && { target: word(node.target) }),
      };
  }
}

const simple = (node: CommandNode): ShellSimpleCommand => ({
  assignments: node.assignments.map((a) => ({ name: a.name, value: word(a.value) })),
  words: node.words.map(word),
  redirects: node.redirects.map(redirect),
});

export function toShellCommand(line: string, ast: CommandLineNode): ShellCommand {
  return {
    type: "shell",
    line,
    list: ast.items.map((item) => ({
      when: item.when,
      pipeline: { commands: item.pipeline.commands.map(simple) },
    })),
  };
}
