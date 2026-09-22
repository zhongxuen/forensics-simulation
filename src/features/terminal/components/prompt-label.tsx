import type { PromptStyleId } from "@/content/themes";
import type { PromptInfo } from "../session/terminal-session";

/**
 * The prompt, in the learner's prompt style (src/content/themes, picked on /settings):
 *
 * - `classic`: as a real shell shows it, user@host:folder$, in green and blue.
 * - `short`: the folder, then the $ (or # for the admin account).
 * - `arrow`: an arrow, then the folder. The # still shows for the admin account.
 * - `minimal`: the $ or # alone.
 *
 * Its own file, apart from the output blocks, so the settings page's preview can draw a prompt
 * without bringing the beginner explanations and the simulation engine along
 * (md-files/11-testing-security-deployment.md, prompt 11.3).
 */
export function PromptLabel({
  prompt,
  style = "classic",
}: {
  prompt: PromptInfo;
  style?: PromptStyleId;
}) {
  switch (style) {
    case "short":
      return (
        <>
          <span className="font-bold text-term-blue">{prompt.cwd}</span>{" "}
          <span>{prompt.symbol}</span>
        </>
      );
    case "arrow":
      return (
        <>
          <span className="font-bold text-term-green">➜</span>{" "}
          <span className="font-bold text-term-cyan">{prompt.cwd}</span>
          {prompt.symbol === "#" && <span> #</span>}
        </>
      );
    case "minimal":
      return <span>{prompt.symbol}</span>;
    case "classic":
      return (
        <>
          <span className="font-bold text-term-green">
            {prompt.user}@{prompt.host}
          </span>
          <span>:</span>
          <span className="font-bold text-term-blue">{prompt.cwd}</span>
          <span>{prompt.symbol}</span>
        </>
      );
  }
}
