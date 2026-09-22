import {
  CURSOR_STYLES,
  PROMPT_STYLES,
  TERMINAL_THEMES,
  type CursorStyleId,
  type PromptStyleId,
  type TerminalThemeId,
} from "@/content/themes";
import { cx } from "@/lib/cx";
import type { PromptInfo } from "../session/terminal-session";
import { PromptLabel } from "./prompt-label";
import { CursorMark } from "./prompt-input";
import { CopyText } from "./styled-text";

interface TerminalPreviewProps {
  theme: TerminalThemeId;
  promptStyle: PromptStyleId;
  cursorStyle: CursorStyleId;
  className?: string;
}

const PROMPT: PromptInfo = { user: "recruit", host: "range-ws-01", cwd: "~", symbol: "$" };

/**
 * A few lines of terminal in any theme, prompt style and cursor style, for the settings picker
 * (md-files/08-campaign-and-story.md, prompt 08.4). It draws with the real terminal's pieces
 * (PromptLabel, CursorMark, the --term-* colours), so what you see is what the terminal will look
 * like. The theme comes from `data-terminal-theme` on the box itself, which beats the one on <html>.
 *
 * A picture, not a terminal: screen readers get one sentence saying what it shows.
 */
export function TerminalPreview({
  theme,
  promptStyle,
  cursorStyle,
  className,
}: TerminalPreviewProps) {
  const summary = `Preview: the ${TERMINAL_THEMES[theme].name} colours, the ${PROMPT_STYLES[promptStyle].name} prompt and a ${CURSOR_STYLES[cursorStyle].name} cursor.`;
  const prompt = <PromptLabel prompt={PROMPT} style={promptStyle} />;

  return (
    <figure
      data-terminal-theme={theme}
      className={cx(
        "overflow-hidden rounded-xl border border-subtle bg-term-bg font-mono text-sm leading-6 text-term-fg",
        className,
      )}
    >
      <figcaption className="sr-only">{summary}</figcaption>
      <div aria-hidden="true" className="px-4 py-3 break-words whitespace-pre-wrap">
        <p>{prompt} ls</p>
        <p>
          <span className="font-bold text-term-blue">notes</span>
          {"   "}
          <span className="font-bold text-term-green">backup.sh</span>
          {"   "}readme.txt
        </p>
        <p>{prompt} cat secret.txt</p>
        <p className="text-term-red">cat: secret.txt: No such file or directory</p>
        <p className="pl-[4ch] -indent-[2ch] text-term-dim">
          ↳{" "}
          <CopyText text="There's no file called `secret.txt` here. Type `ls` to see the files." />
        </p>
        <p>{prompt} netscan 10.40.1.0/24</p>
        <p>
          <span className="text-term-yellow">3 computers answered</span>
          {"  "}
          <span className="text-term-magenta">(simulated)</span>
        </p>
        <p>
          {prompt}{" "}
          <CursorMark style={cursorStyle} focused>
            {" "}
          </CursorMark>
        </p>
      </div>
    </figure>
  );
}
