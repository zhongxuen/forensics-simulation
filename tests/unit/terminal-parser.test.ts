import { describe, expect, it } from "vitest";
import {
  completionContext,
  escapeForShell,
  parseCommandLine,
  toShellCommand,
  type CommandLineNode,
  type ParseError,
} from "@/features/terminal";

function ast(line: string): CommandLineNode {
  const result = parseCommandLine(line);
  if (!result.ok) throw new Error(`expected "${line}" to parse: ${result.error.message}`);
  return result.ast;
}

function error(line: string): ParseError {
  const result = parseCommandLine(line);
  if (result.ok) throw new Error(`expected "${line}" not to parse`);
  return result.error;
}

/** Each command's words as plain text, for readable assertions. */
function words(line: string): string[][] {
  return ast(line).items.flatMap((item) =>
    item.pipeline.commands.map((command) =>
      command.words.map((word) =>
        word.parts
          .map((part) =>
            "text" in part
              ? part.text
              : "variable" in part
                ? `$${part.variable}`
                : `~${part.tilde}`,
          )
          .join(""),
      ),
    ),
  );
}

describe("words and quoting", () => {
  it("splits on spaces and tabs", () => {
    expect(words("ls  -la\t/etc")).toEqual([["ls", "-la", "/etc"]]);
    expect(ast("   ").items).toEqual([]);
    expect(ast("").items).toEqual([]);
  });

  it("keeps single-quoted text literal, spaces and $ included", () => {
    expect(words("echo 'hello world' '$HOME'")).toEqual([["echo", "hello world", "$HOME"]]);
    const [part] = ast("echo '*.txt'").items[0]!.pipeline.commands[0]!.words[1]!.parts;
    expect(part).toEqual({ text: "*.txt", quoted: true });
  });

  it('expands variables inside double quotes, and escapes \\ $ " and `', () => {
    expect(words('echo "hi $USER" "a \\"b\\" \\$c \\\\ d"')).toEqual([
      ["echo", "hi $USER", 'a "b" $c \\ d'],
    ]);
    const parts = ast('echo "hi $USER"').items[0]!.pipeline.commands[0]!.words[1]!.parts;
    expect(parts).toEqual([
      { text: "hi ", quoted: true },
      { variable: "USER", quoted: true },
    ]);
  });

  it("keeps a backslash in double quotes when it escapes nothing special", () => {
    expect(words('echo "a\\nb"')).toEqual([["echo", "a\\nb"]]);
  });

  it("handles nested quoting: one kind of quote inside the other", () => {
    expect(words(`echo "it's" 'say "hi"'`)).toEqual([["echo", "it's", 'say "hi"']]);
    expect(words(`echo "'$HOME'"`)).toEqual([["echo", "'$HOME'"]]);
    expect(words(`echo 'a'"b"c`)).toEqual([["echo", "abc"]]);
  });

  it("escapes one character outside quotes, marking it quoted", () => {
    expect(words("cat my\\ file.txt")).toEqual([["cat", "my file.txt"]]);
    const [part] = ast("ls \\*").items[0]!.pipeline.commands[0]!.words[1]!.parts;
    expect(part).toEqual({ text: "*", quoted: true });
  });

  it("keeps empty quotes as an empty argument", () => {
    expect(words("echo '' \"\"")).toEqual([["echo", "", ""]]);
  });

  it("marks unquoted wildcards as live", () => {
    const [part] = ast("ls *.txt").items[0]!.pipeline.commands[0]!.words[1]!.parts;
    expect(part).toEqual({ text: "*.txt", quoted: false });
  });
});

describe("variables and ~", () => {
  it("reads $NAME, ${NAME} and special variables", () => {
    expect(words("echo $HOME ${USER}x $? $$ $1")).toEqual([
      ["echo", "$HOME", "$USERx", "$?", "$$", "$1"],
    ]);
  });

  it("treats a lone $ as an ordinary character", () => {
    expect(words("echo $ a$ $/")).toEqual([["echo", "$", "a$", "$/"]]);
  });

  it("reads a leading ~ and ~name as home folders, but not ~ in the middle", () => {
    const parts = (line: string) => ast(line).items[0]!.pipeline.commands[0]!.words[1]!.parts;
    expect(parts("ls ~")).toEqual([{ tilde: "" }]);
    expect(parts("ls ~/notes")).toEqual([{ tilde: "" }, { text: "/notes", quoted: false }]);
    expect(parts("ls ~root")).toEqual([{ tilde: "root" }]);
    expect(parts("ls a~b")).toEqual([{ text: "a~b", quoted: false }]);
    expect(parts("ls '~'")).toEqual([{ text: "~", quoted: true }]);
  });

  it("recognises NAME=value assignments only before the command", () => {
    const [command] = ast('LANG=C FOO="a b" env').items[0]!.pipeline.commands;
    expect(command?.assignments.map((a) => a.name)).toEqual(["LANG", "FOO"]);
    expect(command?.words).toHaveLength(1);
    expect(words("echo A=1")).toEqual([["echo", "A=1"]]);
    expect(ast("GREETING=hi").items[0]!.pipeline.commands[0]!.words).toEqual([]);
  });
});

describe("pipelines, lists and redirection", () => {
  it("parses pipelines", () => {
    const line = "cat /var/log/auth.log | grep Failed | wc -l";
    expect(words(line)).toEqual([
      ["cat", "/var/log/auth.log"],
      ["grep", "Failed"],
      ["wc", "-l"],
    ]);
    expect(ast(line).items).toHaveLength(1);
  });

  it("parses ;, && and || with the right conditions", () => {
    const items = ast("a ; b && c || d").items;
    expect(items.map((item) => [item.operator, item.when])).toEqual([
      [undefined, "always"],
      [";", "always"],
      ["&&", "success"],
      ["||", "failure"],
    ]);
    expect(ast("ls ;").items).toHaveLength(1);
  });

  it("parses every redirection, with or without spaces", () => {
    const [command] = ast("sort <in.txt >out.txt 2>err.txt").items[0]!.pipeline.commands;
    expect(command?.redirects.map((r) => [r.op, r.target?.raw])).toEqual([
      ["<", "in.txt"],
      [">", "out.txt"],
      ["2>", "err.txt"],
    ]);
    const [other] = ast("cmd >> log 2>> log 2>&1 1>x").items[0]!.pipeline.commands;
    expect(other?.redirects.map((r) => r.op)).toEqual([">>", "2>>", "2>&1", ">"]);
  });

  it("allows a redirection before the command", () => {
    expect(words("> out.txt echo hi")).toEqual([["echo", "hi"]]);
  });

  it("ignores a comment", () => {
    expect(words("ls # list things")).toEqual([["ls"]]);
    expect(ast("ls # list things").comment).toBe(" list things");
    expect(ast("# just a note").items).toEqual([]);
    expect(words("echo a#b")).toEqual([["echo", "a#b"]]);
  });

  it("records spans for every word", () => {
    const word = ast("cat  notes.txt").items[0]!.pipeline.commands[0]!.words[1]!;
    expect([word.start, word.end, word.raw]).toEqual([5, 14, "notes.txt"]);
  });
});

describe("errors, with the column of the problem", () => {
  it("reports unterminated quotes at the opening quote", () => {
    expect(error("echo 'hello")).toEqual({
      code: "UNTERMINATED_QUOTE",
      column: 6,
      token: "'",
      message: "bash: unexpected EOF while looking for matching `''",
    });
    expect(error("echo \"a 'b' c")).toMatchObject({
      code: "UNTERMINATED_QUOTE",
      column: 6,
      token: '"',
    });
    expect(error("echo \"it's")).toMatchObject({ code: "UNTERMINATED_QUOTE", token: '"' });
  });

  it("reports empty pipelines and lists", () => {
    expect(error("| ls")).toMatchObject({ code: "UNEXPECTED_TOKEN", column: 1, token: "|" });
    expect(error("ls | | wc")).toMatchObject({ code: "UNEXPECTED_TOKEN", column: 6, token: "|" });
    expect(error("ls |")).toMatchObject({ code: "UNEXPECTED_END", column: 5 });
    expect(error("ls &&")).toMatchObject({ code: "UNEXPECTED_END" });
    expect(error("&& ls")).toMatchObject({ code: "UNEXPECTED_TOKEN", token: "&&" });
    expect(error("ls ; ; ls")).toMatchObject({ code: "UNEXPECTED_TOKEN", column: 6, token: ";" });
    expect(error(";")).toMatchObject({ code: "UNEXPECTED_TOKEN", token: ";" });
    expect(error("ls |").message).toBe("bash: syntax error: unexpected end of file");
  });

  it("reports a redirection with no file", () => {
    expect(error("ls >")).toMatchObject({
      code: "UNEXPECTED_END",
      message: "bash: syntax error near unexpected token `newline'",
    });
    expect(error("ls > | wc")).toMatchObject({ code: "UNEXPECTED_TOKEN", column: 6, token: "|" });
  });

  it("reports a trailing backslash", () => {
    expect(error("echo a\\")).toMatchObject({ code: "UNEXPECTED_END", column: 7 });
  });

  it("reports bad and unsupported substitutions", () => {
    expect(error("echo ${}")).toMatchObject({ code: "BAD_SUBSTITUTION", token: "${}" });
    expect(error("echo ${HOME")).toMatchObject({ code: "BAD_SUBSTITUTION" });
    expect(error("echo ${A:-b}")).toMatchObject({ code: "UNSUPPORTED_SYNTAX" });
    expect(error("echo $(whoami)")).toMatchObject({ code: "UNSUPPORTED_SYNTAX", column: 6 });
    expect(error("echo `whoami`")).toMatchObject({ code: "UNSUPPORTED_SYNTAX" });
  });

  it("reports shell features this terminal doesn't have", () => {
    expect(error("sleep 5 &")).toMatchObject({ code: "UNSUPPORTED_SYNTAX", column: 9 });
    expect(error("(ls)")).toMatchObject({ code: "UNSUPPORTED_SYNTAX", column: 1 });
    expect(error("cat << EOF")).toMatchObject({ code: "UNSUPPORTED_SYNTAX" });
    expect(error("ls >&2")).toMatchObject({ code: "UNSUPPORTED_SYNTAX" });
  });

  it("refuses a line that's too long", () => {
    expect(error(`echo ${"a".repeat(5000)}`)).toMatchObject({ code: "LINE_TOO_LONG" });
  });
});

describe("toShellCommand", () => {
  it("lowers the tree to the engine's command, without positions", () => {
    const line = 'cat notes.txt | grep "$WORD" > out.txt && echo done';
    expect(toShellCommand(line, ast(line))).toEqual({
      type: "shell",
      line,
      list: [
        {
          when: "always",
          pipeline: {
            commands: [
              {
                assignments: [],
                words: [
                  { parts: [{ text: "cat", quoted: false }] },
                  { parts: [{ text: "notes.txt", quoted: false }] },
                ],
                redirects: [],
              },
              {
                assignments: [],
                words: [
                  { parts: [{ text: "grep", quoted: false }] },
                  { parts: [{ variable: "WORD", quoted: true }] },
                ],
                redirects: [
                  { fd: 1, mode: "write", target: { parts: [{ text: "out.txt", quoted: false }] } },
                ],
              },
            ],
          },
        },
        {
          when: "success",
          pipeline: {
            commands: [
              {
                assignments: [],
                words: [
                  { parts: [{ text: "echo", quoted: false }] },
                  { parts: [{ text: "done", quoted: false }] },
                ],
                redirects: [],
              },
            ],
          },
        },
      ],
    });
  });

  it("never evaluates anything: the result is plain data", () => {
    const line = "echo $(rm -rf /)";
    expect(parseCommandLine(line).ok).toBe(false);
    const safe = toShellCommand(
      "echo 'constructor' __proto__",
      ast("echo 'constructor' __proto__"),
    );
    expect(JSON.parse(JSON.stringify(safe))).toEqual(safe);
  });
});

describe("completionContext", () => {
  it("finds the word under the cursor and whether it's a command", () => {
    expect(completionContext("ca")).toEqual({
      start: 0,
      prefix: "ca",
      isCommand: true,
      inQuote: false,
    });
    expect(completionContext("cat no")).toMatchObject({ start: 4, prefix: "no", isCommand: false });
    expect(completionContext("cat notes | gr")).toMatchObject({ prefix: "gr", isCommand: true });
    expect(completionContext("sudo ca")).toMatchObject({ prefix: "ca", isCommand: true });
    expect(completionContext("ls > ou")).toMatchObject({ prefix: "ou", isCommand: false });
    expect(completionContext("cat 'my fi")).toMatchObject({ inQuote: true });
    expect(completionContext("cat my\\ fi")).toMatchObject({ start: 4, prefix: "my\\ fi" });
  });

  it("escapes names with spaces and shell characters", () => {
    expect(escapeForShell("my file (1).txt")).toBe("my\\ file\\ \\(1\\).txt");
  });
});
