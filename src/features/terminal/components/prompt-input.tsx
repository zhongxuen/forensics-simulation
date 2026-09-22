"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { CursorStyleId } from "@/content/themes";
import { useHydrated } from "@/hooks/use-hydrated";
import { cx } from "@/lib/cx";

/**
 * The cursor over the next character, in the learner's cursor style (src/content/themes), drawn in
 * the theme's --term-cursor colour. It blinks while you can type, unless motion is reduced; out of
 * focus it shows as a still outline, so you can see where typing will go.
 *
 * - `block`: a filled box, the character inside in the terminal background colour.
 * - `underline` and `bar`: a line under or before the character. Only the line blinks, never the
 *   character, so the letter stays readable.
 */
export function CursorMark({
  style = "block",
  focused,
  children,
}: {
  style?: CursorStyleId;
  focused: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "relative inline-block min-w-[1ch]",
        style === "block" &&
          (focused
            ? "animate-cursor-blink bg-term-cursor text-term-bg"
            : "outline-1 -outline-offset-1 outline-term-cursor"),
        style !== "block" && "after:absolute after:bg-term-cursor",
        style !== "block" && focused && "after:animate-cursor-blink",
        style === "underline" && "after:inset-x-0 after:bottom-0",
        style === "underline" && (focused ? "after:h-0.5" : "after:h-px"),
        style === "bar" && "after:inset-y-0.5 after:left-0",
        style === "bar" && (focused ? "after:w-0.5" : "after:w-px"),
      )}
    >
      {children}
    </span>
  );
}

interface PromptInputProps {
  value: string;
  /** Where the cursor is: an index into `value`. */
  cursor: number;
  /** Faint text after the cursor that Tab accepts. Only shown with the cursor at the end. */
  ghost: string;
  onChange: (value: string, cursor: number) => void;
  onCursor: (cursor: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Accessible name and description. */
  label: string;
  describedBy?: string;
  disabled?: boolean;
  /** The cursor's shape. Defaults to a block. */
  cursorStyle?: CursorStyleId;
}

/**
 * The command line you type into. It's a real <input>, so typing, selection, pasting, screen
 * readers and on-screen keyboards all work as usual. Its own text and caret are transparent: a
 * mirror underneath draws the same text with a terminal-style cursor (which blinks, unless motion
 * is reduced) and the ghost suggestion.
 */
export function PromptInput({
  value,
  cursor,
  ghost,
  onChange,
  onCursor,
  onKeyDown,
  inputRef,
  label,
  describedBy,
  disabled,
  cursorStyle,
}: PromptInputProps) {
  const [focused, setFocused] = useState(false);
  const mirrorRef = useRef<HTMLDivElement>(null);
  // Drawn by the server, the prompt only works once its code has run (a terminal can arrive after
  // the page, prompt 11.3). Read-only until then, so nothing a quick typist enters is lost.
  const hydrated = useHydrated();

  // Keep the mirror scrolled like the input when the line is wider than the box.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (input && mirror) mirror.scrollLeft = input.scrollLeft;
  });

  const before = value.slice(0, cursor);
  const under = value.slice(cursor, cursor + 1);
  const after = value.slice(cursor + 1);
  const showGhost = ghost !== "" && cursor === value.length;

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="pointer-events-none overflow-hidden whitespace-pre"
      >
        {before}
        <CursorMark style={cursorStyle} focused={focused}>
          {under || " "}
        </CursorMark>
        {after}
        {showGhost && <span className="text-term-dim">{ghost}</span>}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        readOnly={!hydrated}
        aria-label={label}
        aria-describedby={describedBy}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) =>
          onChange(event.target.value, event.target.selectionStart ?? event.target.value.length)
        }
        onSelect={(event) => {
          const target = event.currentTarget;
          if (target.selectionStart !== null) onCursor(target.selectionStart);
          if (mirrorRef.current) mirrorRef.current.scrollLeft = target.scrollLeft;
        }}
        onScroll={(event) => {
          if (mirrorRef.current) mirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
        onKeyDown={onKeyDown}
        className="absolute inset-0 w-full bg-transparent p-0 text-transparent caret-transparent outline-none selection:bg-accent/30"
      />
    </div>
  );
}
