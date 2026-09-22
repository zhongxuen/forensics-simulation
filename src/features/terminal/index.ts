/**
 * The terminal's public API: the parser (text to the engine's ShellCommand), the session bridge
 * between React and the engine, the beginner layer, and the components that render it all.
 */
export * from "./parser";

export {
  clearScreen,
  createTerminalSession,
  DEFAULT_SCROLLBACK,
  formatPrompt,
  interruptLine,
  nextCommandTime,
  plainTranscript,
  promptFor,
  resetMachine,
  screenLineCount,
  sessionSnapshot,
  submitLine,
  type PromptInfo,
  type TerminalBlock,
  type TerminalLine,
  type TerminalLineKind,
  type TerminalSessionState,
} from "./session/terminal-session";
export {
  parseAnsi,
  stripCodes,
  ANSI_COLORS,
  type AnsiColor,
  type AnsiSpan,
  type AnsiStyle,
} from "./session/ansi";
export {
  useTerminalSession,
  type TerminalSession,
  type UseTerminalSessionOptions,
} from "./hooks/use-terminal-session";

export { explainError, explainParseError, type ExplainContext } from "./beginner/explain-error";
export { COMMAND_ALIASES, suggestFix, type Suggestion } from "./beginner/suggest";
export { explainBlock, type WhatHappened } from "./beginner/what-happened";
export {
  canExplainBlock,
  explainableLines,
  explainRequestFor,
  MAX_EXPLAIN_CHOICES,
  type TerminalExplainRequest,
} from "./beginner/explain-request";
export {
  completeAtCursor,
  ghostSuggestion,
  reverseSearch,
  type Completion,
} from "./beginner/autocomplete";
export { completesStep, successText, TERMINAL_TOUR, type TourStep } from "./beginner/tour";
export { announceBlock, MAX_ANNOUNCED_LINES } from "./a11y/announce";

export { Terminal, type TerminalProps } from "./components/terminal";
export { CommandCheatSheet } from "./components/cheat-sheet";
export { TerminalPreview } from "./components/terminal-preview";
export { TerminalLookSettings } from "./components/terminal-look-settings";
