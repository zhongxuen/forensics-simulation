"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import type { PromptStyleId } from "@/content/themes";
import { cx } from "@/lib/cx";
import {
  canExplainBlock,
  explainableLines,
  explainRequestFor,
  type TerminalExplainRequest,
} from "../beginner/explain-request";
import { explainBlock } from "../beginner/what-happened";
import type { TerminalBlock, TerminalLine } from "../session/terminal-session";
import { PromptLabel } from "./prompt-label";
import { AnsiText, CopyText } from "./styled-text";

/** The longest a line shows in the "what should be explained?" chooser, in characters. */
const CHOICE_CHARS = 90;

const isErrorLine = (line: TerminalLine) => line.error !== undefined || line.stream === "stderr";

const CHOICE = cx(
  "block max-w-full rounded px-1.5 text-left break-words text-term-fg underline-offset-4 hover:text-term-cyan hover:underline",
  FOCUS_RING,
);

/**
 * Lines keep their leading spaces, and wrapped lines line up under the first character after
 * them (a hanging indent), so indented output like a manual page stays readable when it wraps.
 */
function indentStyle(text: string): CSSProperties | undefined {
  const indent = /^ */.exec(text)?.[0].length ?? 0;
  return indent > 0 ? { paddingLeft: `${indent}ch`, textIndent: `-${indent}ch` } : undefined;
}

const TerminalLineView = memo(function TerminalLineView({
  line,
  onExplain,
}: {
  line: TerminalLine;
  /** Explain this line (a pointer shortcut; the block's "Explain this" button is the keyboard way). */
  onExplain?: (lineId: number) => void;
}) {
  if (line.kind === "explain") {
    return (
      <div
        className={cx(
          "pl-[4ch] -indent-[2ch] text-term-dim",
          line.pointer && "indent-0 text-term-yellow",
        )}
      >
        {!line.pointer && <span aria-hidden="true">↳ </span>}
        <CopyText text={line.text} />
      </div>
    );
  }
  if (line.kind === "note") {
    return (
      <div className="text-term-yellow">
        <span aria-hidden="true">* </span>
        {line.text}
      </div>
    );
  }
  const explainable = onExplain !== undefined && line.text.trim() !== "";
  return (
    <div
      className={cx(line.error && "text-term-red", explainable && "group/line relative")}
      style={indentStyle(line.text)}
    >
      {line.spans.length === 0 ? " " : <AnsiText spans={line.spans} />}
      {explainable && (
        // A shortcut for the pointer, shown on hover. It stays out of the tab order and the
        // accessibility tree so the output reads as plain lines; the block's "Explain this" button
        // offers every line to keyboard, touch and screen reader users.
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => onExplain(line.id)}
          className="absolute top-0 right-0 hidden rounded border border-term-dim bg-term-bg px-1.5 indent-0 font-sans text-xs leading-5 text-term-dim group-hover/line:inline-block hover:text-term-fg"
        >
          Explain
        </button>
      )}
    </div>
  );
});

interface OutputBlockProps {
  block: TerminalBlock;
  beginnerMode: boolean;
  /** How the prompt before the command is drawn. */
  promptStyle?: PromptStyleId;
  /** The newest block keeps its "What just happened?" button in view. */
  latest: boolean;
  /**
   * Let the browser skip laying out this block while it's off screen. Off for the newest blocks,
   * which arrive below the view and must be measured for real before the output scrolls to them.
   */
  virtualize: boolean;
  /**
   * "Explain this" (phase 10): when given, each command gets an Explain this button, and each line
   * a hover shortcut. Stable across renders, so blocks don't redraw.
   */
  onExplain?: (request: TerminalExplainRequest) => void;
}

/**
 * One command and everything it printed. Off-screen blocks skip layout and painting
 * (content-visibility), so long sessions stay fast, while their text stays in the page for
 * screen readers and find-in-page.
 */
export const OutputBlock = memo(function OutputBlock({
  block,
  beginnerMode,
  promptStyle,
  latest,
  virtualize,
  onExplain,
}: OutputBlockProps) {
  const [explaining, setExplaining] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const panelId = useId();
  const chooserId = useId();
  const explainButtonRef = useRef<HTMLButtonElement>(null);
  const chooserRef = useRef<HTMLDivElement>(null);
  const lines = beginnerMode ? block.lines : block.lines.filter((line) => line.kind !== "explain");
  const rows = lines.length + 1;
  const canExplain = block.kind === "command" && block.input.trim() !== "";
  const askable = onExplain !== undefined && canExplainBlock(block);
  const choices = askable ? explainableLines(block) : [];

  const explainLine = useCallback(
    (lineId?: number) => {
      setChoosing(false);
      onExplain?.(explainRequestFor(block, lineId));
    },
    [block, onExplain],
  );

  // Opening the chooser puts focus on its first choice.
  useEffect(() => {
    if (choosing) chooserRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [choosing]);

  const onChooserKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    setChoosing(false);
    explainButtonRef.current?.focus();
  };

  return (
    <section
      aria-label={
        block.kind === "command" ? `Command: ${block.input || "(empty line)"}` : "Terminal note"
      }
      className="group relative"
      style={
        virtualize
          ? { contentVisibility: "auto", containIntrinsicSize: `auto ${rows * 1.5}rem` }
          : undefined
      }
    >
      {block.kind === "command" && (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 break-words whitespace-pre-wrap">
            <PromptLabel prompt={block.prompt} style={promptStyle} /> {block.input}
          </p>
          {canExplain && (
            <button
              type="button"
              aria-expanded={explaining}
              aria-controls={panelId}
              onClick={() => setExplaining((open) => !open)}
              className={cx(
                "shrink-0 rounded px-1.5 font-sans text-xs leading-6 text-term-dim hover:text-term-fg",
                !latest &&
                  !explaining &&
                  "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                FOCUS_RING,
              )}
            >
              {explaining ? "Hide explanation" : "What just happened?"}
            </button>
          )}
          {askable && (
            <button
              ref={explainButtonRef}
              type="button"
              aria-expanded={choices.length > 1 ? choosing : undefined}
              aria-controls={choices.length > 1 && choosing ? chooserId : undefined}
              onClick={() =>
                // Several lines: ask which. One line: that line (an error gets its own
                // explainer as the fallback). None: the command itself.
                choices.length > 1 ? setChoosing((open) => !open) : explainLine(choices[0]?.id)
              }
              className={cx(
                "shrink-0 rounded px-1.5 font-sans text-xs leading-6 text-term-dim hover:text-term-fg",
                !latest &&
                  !choosing &&
                  "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                FOCUS_RING,
              )}
            >
              Explain this
            </button>
          )}
        </div>
      )}
      {lines.map((line) => (
        <TerminalLineView key={line.id} line={line} {...(askable && { onExplain: explainLine })} />
      ))}
      {askable && choosing && (
        <div
          ref={chooserRef}
          id={chooserId}
          role="group"
          aria-label="Choose what to explain"
          onKeyDown={onChooserKey}
          className="my-2 rounded-md border-l-2 border-term-cyan py-1 pl-3 font-sans text-sm leading-6 text-term-fg"
        >
          <p className="font-semibold">What should be explained?</p>
          <ul className="mt-1 space-y-0.5">
            <li>
              <button type="button" onClick={() => explainLine()} className={CHOICE}>
                Everything it printed
              </button>
            </li>
            {choices.map((line) => (
              <li key={line.id}>
                <button
                  type="button"
                  onClick={() => explainLine(line.id)}
                  className={cx(CHOICE, "font-mono")}
                >
                  {line.text.trim().length > CHOICE_CHARS
                    ? `${line.text.trim().slice(0, CHOICE_CHARS)}…`
                    : line.text.trim()}
                  {isErrorLine(line) && <span className="font-sans text-term-red"> (error)</span>}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setChoosing(false);
              explainButtonRef.current?.focus();
            }}
            className={cx(CHOICE, "mt-1 text-term-dim")}
          >
            Cancel
          </button>
        </div>
      )}
      {canExplain && explaining && <WhatHappenedPanel id={panelId} block={block} />}
    </section>
  );
});

function WhatHappenedPanel({ id, block }: { id: string; block: TerminalBlock }) {
  const explanation = explainBlock(block);
  return (
    <div
      id={id}
      className="my-2 rounded-md border-l-2 border-term-cyan py-1 pl-3 font-sans text-sm leading-6 text-term-fg"
    >
      <p className="font-semibold">What just happened</p>
      {explanation.steps.length > 0 && (
        <ul className="mt-1 space-y-1">
          {explanation.steps.map((step, i) => (
            <li key={i}>
              <code className="font-mono text-term-cyan">{step.name}</code>:{" "}
              <CopyText text={step.summary} />
              {step.details.length > 0 && (
                <ul className="mt-0.5 ml-4 list-disc text-term-dim marker:text-term-dim">
                  {step.details.map((detail, j) => (
                    <li key={j}>
                      <CopyText text={detail} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {explanation.joins.map((join, i) => (
        <p key={i} className="mt-1 text-term-dim">
          <CopyText text={join} />
        </p>
      ))}
      <div className="mt-1 space-y-0.5">
        {explanation.outcome.map((line, i) => (
          <p key={i}>
            <CopyText text={line} />
          </p>
        ))}
      </div>
      <p className="mt-1 text-term-dim">
        Want the full story? <CopyText text="Type `man` and the command's name." />
      </p>
    </div>
  );
}
