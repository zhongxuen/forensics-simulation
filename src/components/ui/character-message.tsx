"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { isMotionReduced, useReducedMotion } from "@/hooks/use-reduced-motion";
import { useSkippableEffects } from "@/hooks/use-skippable-effects";
import { cx } from "@/lib/cx";
import { charactersRevealed, typewriterDurationMs } from "@/lib/typewriter";

/** `mentor`: the learner's mentor, the face of hints. `teammate`: anyone else in the story. */
export type CharacterTone = "mentor" | "teammate";

export interface Speaker {
  name: string;
  /** Their job on the team, shown after the name: "Team lead". */
  role?: string;
  /** Shown in the avatar. Defaults to the first letters of the first two words of `name`. */
  initials?: string;
}

/**
 * With `typewriter`, the message types itself out (at most 1.5s), so it must be plain text. Without
 * it, any content works: code, emphasis, links.
 */
export type CharacterMessageContent =
  { typewriter: true; children: string } | { typewriter?: false; children: ReactNode };

type CharacterMessageProps = CharacterMessageContent & {
  speaker: Speaker;
  tone?: CharacterTone;
  className?: string;
};

const AVATAR: Readonly<Record<CharacterTone, string>> = {
  mentor: "border-accent bg-accent-subtle text-accent",
  teammate: "border-status-info bg-surface-overlay text-status-info",
};

function initialsFor({ name, initials }: Speaker): string {
  if (initials) return initials;
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/**
 * A speech bubble for story beats and mentor lines: an avatar, the speaker's name, and what they
 * say.
 */
export function CharacterMessage(props: CharacterMessageProps) {
  const { speaker, tone = "mentor", className } = props;

  return (
    <figure className={cx("grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1", className)}>
      <figcaption className="col-start-2 row-start-1 text-sm leading-5">
        <span className="font-semibold text-primary">{speaker.name}</span>
        {speaker.role && <span className="text-muted"> · {speaker.role}</span>}
      </figcaption>
      <span
        aria-hidden="true"
        className={cx(
          "col-start-1 row-span-2 row-start-1 grid size-10 place-items-center rounded-full border-2 font-mono text-sm font-semibold",
          AVATAR[tone],
        )}
      >
        {initialsFor(speaker)}
      </span>
      <div className="col-start-2 row-start-2 rounded-lg rounded-tl-sm border border-subtle bg-surface-raised px-4 py-3 leading-7 text-primary">
        {props.typewriter ? <TypedText text={props.children} /> : props.children}
      </div>
    </figure>
  );
}

/**
 * Types `text` out character by character. Screen readers get the whole text at once; the typed
 * copy is hidden from them. The untyped part is laid out but invisible, so the bubble never changes
 * size. Under reduced motion the text shows in full, and any key finishes it early.
 */
function TypedText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion(ref);
  const [revealed, setRevealed] = useState(0);

  // A new message starts from the beginning.
  const [previousText, setPreviousText] = useState(text);
  if (text !== previousText) {
    setPreviousText(text);
    setRevealed(0);
  }

  const typing = revealed < text.length;

  useEffect(() => {
    const showAll = () => setRevealed(text.length);
    if (reduced || (ref.current && isMotionReduced(ref.current))) {
      const frame = requestAnimationFrame(showAll);
      return () => cancelAnimationFrame(frame);
    }

    const duration = typewriterDurationMs(text.length);
    let start: number | undefined;
    let frame = requestAnimationFrame(function tick(now) {
      start ??= now;
      const shown = charactersRevealed(now - start, text.length);
      // Never goes backwards, so a skip (which shows everything) sticks.
      setRevealed((current) => Math.max(current, shown));
      if (now - start < duration) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [text, reduced]);

  useSkippableEffects(ref, {
    enabled: typing,
    replayKey: text,
    onSkip: () => setRevealed(text.length),
  });

  return (
    <span ref={ref}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, revealed)}
        <span className="invisible">{text.slice(revealed)}</span>
      </span>
    </span>
  );
}
