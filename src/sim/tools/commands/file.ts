import { stdout } from "../../core/output";
import { sessionFs } from "../../core/session";
import type { OutputLine } from "../../core/types";
import { readFile, stat } from "../../fs/ops";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { usage } from "./shared";

const NAME = "file";

/**
 * A description of some text, from its first bytes and shape: the same kind of guess the real
 * `file` makes from "magic numbers" at the start of a file.
 */
export function describeContent(content: string): string {
  if (content.length === 0) return "empty";
  const ascii = [...content].every((char) => char.charCodeAt(0) < 128);
  const text = ascii ? "ASCII text" : "Unicode text, UTF-8 text";
  const longLines = content.split("\n").some((line) => line.length > 300);
  const suffix = longLines ? ", with very long lines" : "";
  const start = content.trimStart();
  if (start.startsWith("#!")) {
    const interpreter = /^#!\s*(\S+)/.exec(start)?.[1] ?? "";
    const program = interpreter.split("/").pop() ?? "";
    const name =
      program === "bash"
        ? "Bourne-Again shell script"
        : program === "sh"
          ? "POSIX shell script"
          : program.startsWith("python")
            ? "Python script"
            : `${program || "a"} script`;
    return `${name}, ${text} executable${suffix}`;
  }
  if (/^-----BEGIN ([A-Z ]*)PRIVATE KEY-----/.test(start)) return "PEM private key";
  if (/^-----BEGIN CERTIFICATE-----/.test(start)) return "PEM certificate";
  if (/^<!doctype html|^<html/i.test(start)) return `HTML document, ${text}${suffix}`;
  if (/^<\?xml/.test(start)) return `XML document, ${text}${suffix}`;
  if (/^[{[]/.test(start)) {
    try {
      JSON.parse(content);
      return "JSON text data";
    } catch {
      // Not JSON after all: fall through to plain text.
    }
  }
  if (content.startsWith("ELF")) return "ELF 64-bit LSB executable, x86-64";
  return `${text}${suffix}`;
}

export const file: Tool = {
  name: NAME,
  category: "find",
  help: {
    oneLiner: "guess what kind of file something is by looking inside it, not at its name.",
    usage: ["file [options] file..."],
    description: [
      "A file's name can say anything: report.txt could be a picture or a program. file ignores the name and looks at what's inside, then says what it looks like: plain text, a script, a web page, a key, a folder, and so on.",
      "It needs permission to read the file to look inside. For a shortcut (a symbolic link) it says where the shortcut points, unless you add -L.",
    ],
    options: [
      { flags: "-L, --dereference", text: "For a shortcut, describe what it points to." },
      { flags: "-b, --brief", text: "Leave the file name out of the answer." },
    ],
    examples: [
      { command: "file notes.txt", text: "Check what notes.txt really is." },
      { command: "file *", text: "Describe everything in this folder." },
    ],
    concept: [
      "Attackers disguise files by giving them harmless-looking names, like a program called invoice.pdf. Checking what a file really is, instead of trusting its name, is one of the first habits investigators learn.",
      "Real tools recognise files by the first few bytes, called a magic number or file signature. Web servers that only check a file's name, and not its contents, can be tricked into accepting harmful uploads.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-L", "--dereference"], key: "follow" },
      { names: ["-b", "--brief"], key: "brief" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const files = parsed.value.positionals;
    if (files.length === 0) {
      return usage(NAME, { code: "MISSING_ARGUMENT", argument: "file operand" }, state);
    }
    const { vfs, ctx: fsCtx } = sessionFs(state, ctx.now);
    const follow = hasSwitch(parsed.value, "follow");
    const width = Math.max(...files.map((name) => name.length)) + 1;
    const output: OutputLine[] = [];
    for (const name of files) {
      const info = stat(vfs, fsCtx, name, { follow });
      let description: string;
      if (!info.ok) {
        description =
          info.error.code === "ENOENT"
            ? "cannot open (No such file or directory)"
            : "cannot open (Permission denied)";
      } else if (info.value.kind === "dir") {
        description = "directory";
      } else if (info.value.kind === "symlink") {
        description = `symbolic link to ${info.value.target ?? ""}`;
      } else {
        const content = readFile(vfs, fsCtx, name);
        description = content.ok
          ? describeContent(content.value)
          : "regular file, no read permission";
      }
      output.push(
        stdout(
          hasSwitch(parsed.value, "brief")
            ? description
            : `${`${name}:`.padEnd(width)} ${description}`,
        ),
      );
    }
    return { state, output, events: [], exitCode: 0 };
  },
};
