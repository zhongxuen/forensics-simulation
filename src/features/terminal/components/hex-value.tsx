"use client";

import { useEffect, useState } from "react";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";
import type { AnsiSpan } from "../session/ansi";

/**
 * A run of 32 or more hex digits: an MD5 (32), SHA-1 (40) or SHA-256 (64) digest, whole. Shorter
 * hex, like an address (`0x2010000`) or a ref, stays in its line.
 */
const HEX_VALUE = /(?<![0-9A-Za-z])[0-9A-Fa-f]{32,}(?![0-9A-Za-z])/g;

export type LinePiece =
  | { readonly kind: "text"; readonly spans: readonly AnsiSpan[] }
  | { readonly kind: "hex"; readonly value: string };

/**
 * A line cut around its hex values, so each can sit on a line of its own. Text pieces keep their
 * colours; a piece that is only spaces is dropped. A line with no hex value comes back as one text
 * piece. The line's own text (what's copied, read out and searched) is never changed.
 */
export function splitHexValues(text: string, spans: readonly AnsiSpan[]): LinePiece[] {
  const pieces: LinePiece[] = [];
  let from = 0;
  const pushText = (to: number) => {
    if (text.slice(from, to).trim() !== "") {
      pieces.push({ kind: "text", spans: sliceSpans(spans, from, to) });
    }
  };
  for (const match of text.matchAll(HEX_VALUE)) {
    pushText(match.index);
    pieces.push({ kind: "hex", value: match[0] });
    from = match.index + match[0].length;
  }
  if (from === 0) return [{ kind: "text", spans }];
  pushText(text.length);
  return pieces;
}

/** The spans covering characters `from` to `to` of their joined text, cut at the edges. */
function sliceSpans(spans: readonly AnsiSpan[], from: number, to: number): AnsiSpan[] {
  const out: AnsiSpan[] = [];
  let at = 0;
  for (const span of spans) {
    const start = at;
    const end = at + span.text.length;
    at = end;
    if (end <= from || start >= to) continue;
    out.push({
      ...span,
      text: span.text.slice(Math.max(0, from - start), Math.min(span.text.length, to - start)),
    });
  }
  return out;
}

/**
 * A hex value on its own line: it breaks anywhere rather than at the terminal's edge, and has a
 * Copy button beside it, for comparing it with a form or pasting it into `hashsum --verify`.
 */
export function HexValue({ value }: { value: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "blocked">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("blocked");
    }
  };

  return (
    <span className="flex items-start gap-2 indent-0">
      <span className="min-w-0 break-all">{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${value.slice(0, 8)}…`}
        className={cx(
          "shrink-0 rounded border border-term-dim/40 px-1.5 font-sans text-xs leading-5 text-term-dim select-none hover:text-term-fg",
          FOCUS_RING,
        )}
      >
        {status === "copied" ? "Copied" : status === "blocked" ? "Select to copy" : "Copy"}
      </button>
      <span role="status" className="sr-only">
        {status === "copied"
          ? "Copied to your clipboard."
          : status === "blocked"
            ? "Your browser blocked copying. Select the value and copy it instead."
            : ""}
      </span>
    </span>
  );
}
