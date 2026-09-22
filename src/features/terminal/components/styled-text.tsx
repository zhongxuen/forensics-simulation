import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { AnsiColor, AnsiSpan } from "../session/ansi";

/**
 * Terminal colours as theme tokens (src/styles/tokens.css, --term-*), all audited against the
 * terminal background. ANSI black would be unreadable as text on it, so it shows as bright black.
 */
const FOREGROUND: Readonly<Record<AnsiColor, string>> = {
  black: "text-term-bright-black",
  red: "text-term-red",
  green: "text-term-green",
  yellow: "text-term-yellow",
  blue: "text-term-blue",
  magenta: "text-term-magenta",
  cyan: "text-term-cyan",
  white: "text-term-white",
  "bright-black": "text-term-bright-black",
  "bright-red": "text-term-bright-red",
  "bright-green": "text-term-bright-green",
  "bright-yellow": "text-term-bright-yellow",
  "bright-blue": "text-term-bright-blue",
  "bright-magenta": "text-term-bright-magenta",
  "bright-cyan": "text-term-bright-cyan",
  "bright-white": "text-term-bright-white",
};

/** Colour codes' spans, as styled text. Styling happened once, when the line arrived. */
export function AnsiText({ spans }: { spans: readonly AnsiSpan[] }) {
  return (
    <>
      {spans.map((span, i) => {
        const { fg, bold, dim, italic, underline } = span.style;
        const className = cx(
          fg && FOREGROUND[fg],
          dim && "text-term-dim",
          bold && "font-bold",
          italic && "italic",
          underline && "underline",
        );
        return className ? (
          <span key={i} className={className}>
            {span.text}
          </span>
        ) : (
          span.text
        );
      })}
    </>
  );
}

/**
 * Explainer copy: text inside `backticks` is something to type or a name, shown highlighted and
 * without the backticks. Screen readers get the words without the marks.
 */
export function CopyText({
  text,
  codeClassName = "text-term-cyan",
}: {
  text: string;
  codeClassName?: string;
}) {
  const parts: ReactNode[] = [];
  text.split(/(`[^`]+`)/).forEach((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      parts.push(
        <code key={i} className={cx("font-mono", codeClassName)}>
          {part.slice(1, -1)}
        </code>,
      );
    } else if (part) {
      parts.push(part);
    }
  });
  return <>{parts}</>;
}

/** The plain words of explainer copy, for places that need text only. */
export const copyToPlain = (text: string): string => text.replace(/`/g, "");
