import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Nothing a learner types is ever run as code (md-files/11-testing-security-deployment.md,
 * "Security review of this app", Input handling; prompt 11.2). The terminal parses input into data
 * and the engine interprets that data (src/sim/shell); these checks make sure no code path turns
 * text into code or markup instead:
 *
 * - no eval, new Function / Function(), or setTimeout / setInterval given a string;
 * - no innerHTML, outerHTML, insertAdjacentHTML or document.write;
 * - dangerouslySetInnerHTML only in the two components that render text the app itself wrote
 *   (the settings boot script and the terminal themes' CSS), never anything a learner typed;
 * - the MDX compiler only in the lesson compiler, which only ever gets lesson files from
 *   src/content/lessons, and never from a route handler.
 *
 * It walks the syntax tree, so comments and strings that mention these don't count.
 */

const ROOT = join(import.meta.dirname, "../..");

/** The only files allowed dangerouslySetInnerHTML, and why. */
const INNER_HTML_ALLOWED: Readonly<Record<string, string>> = {
  "src/components/shell/settings-boot-script.tsx":
    "a constant script, written by the app, that applies settings before first paint",
  "src/components/shell/terminal-theme-styles.tsx":
    "CSS generated from the terminal themes in src/content/themes",
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__fixtures__" ? [] : sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const rel = (path: string) => relative(ROOT, path).replaceAll("\\", "/");

interface Finding {
  readonly file: string;
  readonly line: number;
  readonly what: string;
}

function scan(path: string): Finding[] {
  const file = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: Finding[] = [];
  const add = (node: ts.Node, what: string) =>
    found.push({
      file: rel(path),
      line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
      what,
    });
  const calleeName = (expression: ts.Expression): string | undefined =>
    ts.isIdentifier(expression)
      ? expression.text
      : ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : undefined;

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      if (name === "eval") add(node, "eval()");
      if (name === "Function" && ts.isIdentifier(node.expression)) add(node, "Function()");
      if ((name === "setTimeout" || name === "setInterval") && node.arguments[0]) {
        const first = node.arguments[0];
        if (ts.isStringLiteralLike(first) || ts.isTemplateExpression(first)) {
          add(node, `${name} with a string`);
        }
      }
      if (name === "insertAdjacentHTML") add(node, "insertAdjacentHTML()");
      if (
        (name === "write" || name === "writeln") &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "document"
      ) {
        add(node, "document.write()");
      }
    }
    if (ts.isNewExpression(node) && calleeName(node.expression) === "Function") {
      add(node, "new Function()");
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      (node.name.text === "innerHTML" || node.name.text === "outerHTML")
    ) {
      add(node, node.name.text);
    }
    if (ts.isJsxAttribute(node) && node.name.getText(file) === "dangerouslySetInnerHTML") {
      add(node, "dangerouslySetInnerHTML");
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

const findings = sourceFiles(join(ROOT, "src")).flatMap(scan);

describe("nothing a learner types is run as code", () => {
  it("has no eval, Function(), or timers given a string", () => {
    expect(findings.filter((finding) => /eval|Function|with a string/.test(finding.what))).toEqual(
      [],
    );
  });

  it("writes no HTML from strings (innerHTML, outerHTML, insertAdjacentHTML, document.write)", () => {
    expect(
      findings.filter(
        (finding) =>
          /HTML\b|outerHTML|innerHTML|document\.write/.test(finding.what) &&
          finding.what !== "dangerouslySetInnerHTML",
      ),
    ).toEqual([]);
  });

  it("uses dangerouslySetInnerHTML only for text the app itself wrote", () => {
    const uses = findings.filter((finding) => finding.what === "dangerouslySetInnerHTML");
    expect(uses.map((use) => use.file).filter((file) => !(file in INNER_HTML_ALLOWED))).toEqual([]);
    // Each allowed file still uses it (so the list stays honest), and with a value it computes
    // itself: a constant or a function of content, never a prop that could carry learner text.
    for (const file of Object.keys(INNER_HTML_ALLOWED)) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect(source, file).toMatch(/dangerouslySetInnerHTML=\{\{ __html: [A-Za-z_]+(?:\(\))? \}\}/);
    }
  });

  it("compiles MDX only in the lesson compiler, from lesson files, and never in a route handler", () => {
    const importers = sourceFiles(join(ROOT, "src")).filter((path) =>
      /from "@mdx-js\/mdx"/.test(readFileSync(path, "utf8").replace(/import type[^;]+;/g, "")),
    );
    expect(importers.map(rel)).toEqual(["src/features/learning/lessons/compile.ts"]);

    const callers = sourceFiles(join(ROOT, "src"))
      .filter((path) => !path.endsWith("compile.ts"))
      .filter((path) =>
        /\bcompileLessonBody\(|\brenderLessonBody\(/.test(readFileSync(path, "utf8")),
      )
      .map(rel);
    expect(callers.filter((file) => file.startsWith("src/app/api/"))).toEqual([]);
    // Lesson bodies come from the loader, which reads src/content/lessons and nothing else.
    const loader = readFileSync(join(ROOT, "src/features/learning/lessons/loader.ts"), "utf8");
    expect(loader).toMatch(/src[/\\"', ]+content[/\\"', ]+lessons|LESSONS_DIR/);
  });

  it("the scan itself sees each pattern (so a pass means something)", () => {
    const probe = join(ROOT, "tests/unit/fixtures/no-eval/probe.ts");
    const seen = new Set(scan(probe).map((finding) => finding.what));
    expect(seen).toEqual(
      new Set([
        "eval()",
        "new Function()",
        "Function()",
        "setTimeout with a string",
        "innerHTML",
        "insertAdjacentHTML()",
        "document.write()",
      ]),
    );
  });
});
