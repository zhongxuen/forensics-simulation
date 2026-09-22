/**
 * Terminal colour codes (ANSI "SGR" escape sequences) to styled spans. Runs once, when a line
 * arrives, never on render. Unknown or cursor-moving codes are dropped; the "clear screen" codes
 * `clear` prints are reported so the terminal can wipe its screen.
 */

export const ANSI_COLORS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "bright-black",
  "bright-red",
  "bright-green",
  "bright-yellow",
  "bright-blue",
  "bright-magenta",
  "bright-cyan",
  "bright-white",
] as const;

export type AnsiColor = (typeof ANSI_COLORS)[number];

export interface AnsiStyle {
  readonly fg?: AnsiColor;
  readonly bg?: AnsiColor;
  readonly bold?: boolean;
  readonly dim?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly inverse?: boolean;
}

export interface AnsiSpan {
  readonly text: string;
  readonly style: AnsiStyle;
}

export interface ParsedAnsi {
  readonly spans: readonly AnsiSpan[];
  /** The text with every code removed: what screen readers and "copy" get. */
  readonly plain: string;
  /** The line asked for the screen to be cleared. Only text after that point is kept. */
  readonly clearsScreen: boolean;
}

const ESC = String.fromCharCode(27);
// ESC [ parameters, intermediate bytes, one final byte.
const CSI = new RegExp(`${ESC}\\[([0-9;?]*)([ -/]*)([@-~])`, "g");

function applySgr(style: AnsiStyle, params: string): AnsiStyle {
  const codes = params === "" ? [0] : params.split(";").map((code) => Number(code) || 0);
  let next: { -readonly [K in keyof AnsiStyle]: AnsiStyle[K] } = { ...style };
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i] as number;
    if (code === 0) next = {};
    else if (code === 1) next.bold = true;
    else if (code === 2) next.dim = true;
    else if (code === 3) next.italic = true;
    else if (code === 4) next.underline = true;
    else if (code === 7) next.inverse = true;
    else if (code === 22) {
      delete next.bold;
      delete next.dim;
    } else if (code === 23) delete next.italic;
    else if (code === 24) delete next.underline;
    else if (code === 27) delete next.inverse;
    else if (code >= 30 && code <= 37) next.fg = ANSI_COLORS[code - 30];
    else if (code === 39) delete next.fg;
    else if (code >= 40 && code <= 47) next.bg = ANSI_COLORS[code - 40];
    else if (code === 49) delete next.bg;
    else if (code >= 90 && code <= 97) next.fg = ANSI_COLORS[code - 90 + 8];
    else if (code >= 100 && code <= 107) next.bg = ANSI_COLORS[code - 100 + 8];
    else if (code === 38 || code === 48) {
      // 256-colour and true-colour codes: skip their parameters, keep the current colour.
      i += codes[i + 1] === 5 ? 2 : codes[i + 1] === 2 ? 4 : 0;
    }
  }
  return next;
}

const sameStyle = (a: AnsiStyle, b: AnsiStyle) =>
  a.fg === b.fg &&
  a.bg === b.bg &&
  a.bold === b.bold &&
  a.dim === b.dim &&
  a.italic === b.italic &&
  a.underline === b.underline &&
  a.inverse === b.inverse;

/** Splits one line of output into styled spans. */
export function parseAnsi(text: string): ParsedAnsi {
  if (!text.includes(ESC)) {
    return { spans: text === "" ? [] : [{ text, style: {} }], plain: text, clearsScreen: false };
  }
  let spans: AnsiSpan[] = [];
  let style: AnsiStyle = {};
  let clearsScreen = false;
  let last = 0;
  const push = (chunk: string) => {
    if (chunk === "") return;
    const previous = spans[spans.length - 1];
    if (previous && sameStyle(previous.style, style)) {
      spans[spans.length - 1] = { text: previous.text + chunk, style };
    } else {
      spans.push({ text: chunk, style });
    }
  };
  for (const match of text.matchAll(CSI)) {
    push(text.slice(last, match.index));
    last = (match.index ?? 0) + match[0].length;
    const [, params = "", , final] = match;
    if (final === "m") style = applySgr(style, params);
    else if (final === "J" && (params === "2" || params === "3")) {
      clearsScreen = true;
      spans = []; // everything before the clear is wiped
    }
  }
  push(text.slice(last));
  // Stray ESC characters that weren't part of a sequence are dropped too.
  const cleaned = spans
    .map((span) => ({ ...span, text: span.text.split(ESC).join("") }))
    .filter((span) => span.text !== "");
  return { spans: cleaned, plain: cleaned.map((span) => span.text).join(""), clearsScreen };
}

/** The text without codes. */
export const stripCodes = (text: string): string => parseAnsi(text).plain;
