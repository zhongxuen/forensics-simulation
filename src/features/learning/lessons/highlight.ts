import type { ProcessorOptions } from "@mdx-js/mdx";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import {
  createCssVariablesTheme,
  createHighlighterCore,
  type HighlighterCore,
  type ShikiTransformer,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

type Pluggable = NonNullable<ProcessorOptions["rehypePlugins"]>[number];

/**
 * Syntax highlighting for lesson code blocks, themed with the design tokens.
 *
 * The theme only names CSS variables (`--code-token-keyword` and so on). src/styles/code.css
 * points each one at an audited token, so highlighted code passes the same contrast audit as
 * everything else, and a new theme needs no change here.
 *
 * Highlighting runs on the server while the lesson compiles, with Shiki's JavaScript regex
 * engine (no WebAssembly) and a fixed set of languages. Shiki leaves a fence in any other language
 * unhighlighted, so remark-lesson.ts turns that into an error, and CI catches it.
 */

export const LESSON_CODE_THEME = "lesson";

/** Languages a lesson's code fences may use, besides plain `text`. */
export const LESSON_CODE_LANGUAGES = [
  "shellscript",
  "console",
  "http",
  "json",
  "html",
  "javascript",
  "sql",
  "log",
  "yaml",
  "ini",
  "python",
  "diff",
] as const;

let highlighter: Promise<HighlighterCore> | undefined;

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [createCssVariablesTheme({ name: LESSON_CODE_THEME, variablePrefix: "--code-" })],
    langs: [
      import("shiki/langs/shellscript.mjs"),
      import("shiki/langs/console.mjs"),
      import("shiki/langs/http.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/html.mjs"),
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/sql.mjs"),
      import("shiki/langs/log.mjs"),
      import("shiki/langs/yaml.mjs"),
      import("shiki/langs/ini.mjs"),
      import("shiki/langs/python.mjs"),
      import("shiki/langs/diff.mjs"),
    ],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

/**
 * Leaves colour to the token spans and the rest to LessonCodeBlock: drops Shiki's inline
 * background, and records the language and an optional `title="…"` from the fence's meta.
 */
const lessonCodeTransformer: ShikiTransformer = {
  name: "lesson-code",
  pre(node) {
    delete node.properties.style;
    delete node.properties.tabindex;
    delete node.properties.class;
    node.properties["data-language"] = this.options.lang;
    const title = /title="([^"]+)"/.exec(this.options.meta?.__raw ?? "")?.[1];
    if (title !== undefined) node.properties["data-title"] = title;
  },
  code(node) {
    node.properties["data-code-block"] = "";
  },
};

/** Names Shiki treats as unhighlighted text. */
const PLAIN_TEXT = ["text", "txt", "plain", "plaintext"];

export interface LessonHighlighting {
  /** The rehype plugin, ready for a `rehypePlugins` list. */
  readonly plugin: Pluggable;
  /** Every name a code fence may use: the languages above, their aliases, and plain text. */
  readonly languages: ReadonlySet<string>;
}

export async function lessonHighlighting(): Promise<LessonHighlighting> {
  const loaded = await getHighlighter();
  return {
    plugin: [
      rehypeShikiFromHighlighter,
      loaded,
      { theme: LESSON_CODE_THEME, defaultLanguage: "text", transformers: [lessonCodeTransformer] },
    ] as Pluggable,
    languages: new Set([...loaded.getLoadedLanguages(), ...PLAIN_TEXT]),
  };
}
