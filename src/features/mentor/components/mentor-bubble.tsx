import type { ReactNode } from "react";
import { CharacterMessage } from "@/components/ui/character-message";
import { MENTOR } from "@/content/cast";
import type { MentorReply } from "../session/mentor-store";
import { MentorText } from "./mentor-text";
import { TypingIndicator } from "./typing-indicator";

/** The mentor's first name, for buttons and short labels ("Ask Noor"). */
export const MENTOR_FIRST_NAME = MENTOR.name.split(" ")[0] ?? MENTOR.name;

export const MENTOR_SPEAKER = {
  name: MENTOR.name,
  role: MENTOR.role,
  initials: MENTOR.initials,
} as const;

/** Shown under a reply written ahead of time, so the player knows why it isn't tailored. */
export const FROM_NOTES_LABEL = `From ${MENTOR_FIRST_NAME}'s notes, written ahead of time`;

interface MentorBubbleProps {
  reply: MentorReply;
  /** A small line above the words: "Hint 2 of 3 · the idea". */
  label?: ReactNode;
  className?: string;
}

/**
 * One thing Noor says, as a phase 02 CharacterMessage with her name and avatar. While she's writing
 * and nothing has arrived yet, the typing indicator shows; as her words stream in they appear
 * sentence by sentence. A reply from her notes (the model is switched off or busy) looks the same,
 * with a quiet line saying it was written ahead of time. Never an error.
 */
export function MentorBubble({ reply, label, className }: MentorBubbleProps) {
  const waiting = reply.status === "writing" && reply.text.trim() === "";
  return (
    <CharacterMessage speaker={MENTOR_SPEAKER} tone={MENTOR.tone} className={className}>
      {label && <span className="mb-1 block text-xs font-semibold text-accent">{label}</span>}
      {waiting ? (
        <TypingIndicator label={`${MENTOR_FIRST_NAME} is writing…`} />
      ) : (
        <>
          <MentorText text={reply.text} />
          {reply.status === "writing" && <TypingIndicator className="mt-1" />}
          {reply.status === "fallback" && (
            <span className="mt-2 block text-xs leading-5 text-muted">{FROM_NOTES_LABEL}</span>
          )}
        </>
      )}
    </CharacterMessage>
  );
}
