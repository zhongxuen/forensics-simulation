import GithubSlugger from "github-slugger";
import type { Code, Heading, Nodes, Root } from "mdast";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import { LESSON_CODE_LANGUAGES } from "./highlight";

/** One heading in a lesson's table of contents. */
export interface TocEntry {
  /** The heading's anchor id: `why-it-matters`. */
  readonly id: string;
  readonly text: string;
  /** 2 for a `##` section, 3 for a `###` subsection. */
  readonly depth: 2 | 3;
}

/** What a lesson's body contains, collected while it compiles. */
export interface LessonAnalysis {
  readonly toc: TocEntry[];
  /** Glossary ids used by <Term id="…">, in order, repeats included. */
  readonly termIds: string[];
  /** Mission ids used by <TryIt mission="…">, in order, repeats included. */
  readonly missionIds: string[];
}

/** The part of an MDX JSX node this plugin reads (from mdast-util-mdx-jsx). */
interface MdxJsxElement {
  type: "mdxJsxFlowElement" | "mdxJsxTextElement";
  name: string | null;
  attributes: { type: string; name?: string; value?: unknown }[];
}

function isJsxElement(node: { type: string }): node is MdxJsxElement {
  return node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";
}

/** An attribute's value as written: a string for `name="…"`, something else for `name={…}`. */
function attributeValue(node: MdxJsxElement, name: string): unknown {
  return node.attributes.find(
    (attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === name,
  )?.value;
}

function fail(node: object, message: string): never {
  const line = (node as { position?: { start: { line: number } } }).position?.start.line;
  throw new Error(line === undefined ? message : `Line ${line}: ${message}`);
}

/**
 * The lesson house rules, applied while the MDX compiles:
 *
 * - `##` and `###` headings get stable anchor ids and go into `analysis.toc`. A `#` heading is an
 *   error: the page renders the title from the frontmatter.
 * - `import` and `export` are errors: lessons use only the components the Learning Center
 *   provides, so every lesson stays data.
 * - Every <Term id="…"> is collected in `analysis.termIds`, and every <TryIt mission="…"> in
 *   `analysis.missionIds`, for the dead-reference check. An id that isn't a plain string is an
 *   error, and so is a <MiniTerminal> whose scenario isn't one.
 * - A code fence must use one of `languages` (from highlight.ts), or none for plain text.
 */
export function remarkLesson(analysis: LessonAnalysis, languages: ReadonlySet<string>) {
  return (tree: Root) => {
    const slugger = new GithubSlugger();

    visit(tree, (node: Nodes | { type: string }) => {
      if (node.type === "mdxjsEsm") {
        fail(node, "Lessons can't use import or export. Use the built-in lesson components.");
      }

      if (node.type === "code") {
        const { lang } = node as Code;
        if (lang != null && !languages.has(lang)) {
          fail(
            node,
            `Code fences can't use "${lang}". Use one of ${LESSON_CODE_LANGUAGES.join(", ")}, or text.`,
          );
        }
      }

      if (node.type === "heading") {
        const heading = node as Heading;
        if (heading.depth === 1) {
          fail(heading, "Use ## for sections. The lesson's title comes from its frontmatter.");
        }
        const text = toString(heading);
        const id = slugger.slug(text);
        heading.data = { ...heading.data, hProperties: { ...heading.data?.hProperties, id } };
        if (heading.depth === 2 || heading.depth === 3) {
          analysis.toc.push({ id, text, depth: heading.depth });
        }
      }

      if (isJsxElement(node) && node.name === "Term") {
        const id = attributeValue(node, "id");
        if (typeof id !== "string") {
          fail(node, 'Give <Term> a plain id, like <Term id="port">ports</Term>.');
        }
        analysis.termIds.push(id);
      }

      if (isJsxElement(node) && node.name === "TryIt") {
        const mission = attributeValue(node, "mission");
        if (typeof mission !== "string") {
          fail(node, 'Give <TryIt> a plain mission id, like <TryIt mission="net-01" />.');
        }
        analysis.missionIds.push(mission);
      }

      if (isJsxElement(node) && node.name === "MiniTerminal") {
        if (typeof attributeValue(node, "scenario") !== "string") {
          fail(node, 'Give <MiniTerminal> a plain scenario id, like scenario="range-home".');
        }
      }
    });
  };
}
