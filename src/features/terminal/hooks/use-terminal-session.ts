"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { suggestNextCommands } from "@/sim";
import type { ScenarioSpec, SimEvent, SimState } from "@/sim/types";
import {
  completeAtCursor,
  ghostSuggestion,
  reverseSearch,
  type Completion,
} from "../beginner/autocomplete";
import {
  applyChange,
  clearScreen,
  createTerminalSession,
  interruptLine,
  promptFor,
  resetMachine,
  sessionSnapshot,
  submitLine,
  type EngineChange,
  type PromptInfo,
  type SessionSetup,
  type TerminalBlock,
  type TerminalSessionState,
} from "../session/terminal-session";

export interface UseTerminalSessionOptions {
  readonly scenario: ScenarioSpec;
  readonly seed: number;
  /** Screen lines kept before the oldest are dropped. */
  readonly scrollback?: number;
  /**
   * Called after every command with its events and the new state: the seam missions, the network
   * map and the mentor subscribe through, instead of reading the engine's internals.
   */
  readonly onEvents?: (events: readonly SimEvent[], state: SimState) => void;
  /** Called after Reset machine, with the fresh state. */
  readonly onReset?: (state: SimState) => void;
  /** Added to the machine's starting state, on start and on Reset machine (a case's evidence). */
  readonly setup?: SessionSetup;
}

export interface TerminalSession {
  /** Everything: the engine state, the run, and the screen. */
  readonly state: TerminalSessionState;
  readonly sim: SimState;
  readonly blocks: readonly TerminalBlock[];
  /** Lines submitted so far, oldest first. */
  readonly history: readonly string[];
  readonly prompt: PromptInfo;
  readonly cwd: string;
  /** Runs one line and returns the block it added (undefined if the screen was cleared). */
  submit(line: string): TerminalBlock | undefined;
  /** Abandons a half-typed line (Ctrl+C). */
  interrupt(line: string): void;
  /** Clears the screen (Ctrl+L). */
  clear(): void;
  /** Restores the scenario's starting state (Reset machine). */
  reset(): void;
  /**
   * Runs an engine call that isn't a typed line (the Evidence Browser opening an image) against
   * the latest state, keeps its new state and reports its events like a command's. Returns what
   * `change` returned.
   */
  apply<T extends EngineChange>(
    change: (sim: SimState, now: number) => T | undefined,
  ): T | undefined;
  /** The state, the run and a plain transcript, for replay and bug reports. */
  snapshot(): ReturnType<typeof sessionSnapshot>;
  /** Commands worth trying next, built from what's in the current folder. */
  readonly suggestions: readonly string[];
  /** What Tab does at the cursor. */
  complete(input: string, cursor: number): Completion;
  /** The faint suggestion after the cursor. */
  ghost(input: string, cursor: number): string;
  /** Ctrl+R: the newest earlier command containing `query`, before position `before`. */
  search(query: string, before?: number): { index: number; line: string } | undefined;
}

/**
 * Bridges React and the engine for one terminal session. It holds the session (engine state, run
 * and screen) and exposes actions; every change goes through the pure functions in
 * session/terminal-session.ts, which call the engine's `step`. There are no command
 * implementations here or anywhere in the terminal feature.
 *
 * Nothing is stored anywhere: the session lives in this component's memory and is gone when it
 * unmounts or the page reloads (md-files/03-app-state-and-privacy.md).
 */
export function useTerminalSession({
  scenario,
  seed,
  scrollback,
  onEvents,
  onReset,
  setup,
}: UseTerminalSessionOptions): TerminalSession {
  // The scenario and seed are read once: to switch scenario, give the component using this hook a
  // new `key`, which starts a fresh session.
  const [state, setState] = useState(() =>
    createTerminalSession({ scenario, seed, scrollback, ...(setup && { setup }) }),
  );
  // Actions read the latest state synchronously, so two quick submits never race.
  const latest = useRef(state);

  const callbacks = useRef({ onEvents, onReset });
  useEffect(() => {
    callbacks.current = { onEvents, onReset };
  }, [onEvents, onReset]);

  const commit = useCallback((next: TerminalSessionState) => {
    latest.current = next;
    setState(next);
  }, []);

  const submit = useCallback(
    (line: string) => {
      const before = latest.current;
      const next = submitLine(before, line);
      commit(next);
      if (next.run !== before.run) callbacks.current.onEvents?.(next.lastEvents, next.sim);
      const added = next.blocks.at(-1);
      return added && added.id >= before.nextId ? added : undefined;
    },
    [commit],
  );

  const interrupt = useCallback(
    (line: string) => commit(interruptLine(latest.current, line)),
    [commit],
  );
  const clear = useCallback(() => commit(clearScreen(latest.current)), [commit]);
  const reset = useCallback(() => {
    const next = resetMachine(latest.current);
    commit(next);
    callbacks.current.onReset?.(next.sim);
  }, [commit]);
  const apply = useCallback(
    <T extends EngineChange>(change: (sim: SimState, now: number) => T | undefined) => {
      const { session: next, change: made } = applyChange(latest.current, change);
      if (!made) return undefined;
      commit(next);
      callbacks.current.onEvents?.(made.events, made.state);
      return made;
    },
    [commit],
  );
  const snapshot = useCallback(() => sessionSnapshot(latest.current), []);
  const complete = useCallback(
    (input: string, cursor: number) => completeAtCursor(input, cursor, latest.current.sim),
    [],
  );
  // Called while rendering the prompt, so it reads the rendered state, not the ref.
  const ghost = useCallback(
    (input: string, cursor: number) =>
      ghostSuggestion(input, cursor, state.sim, state.inputHistory, state.blocks.at(-1)?.fixedLine),
    [state],
  );
  const search = useCallback(
    (query: string, before?: number) => reverseSearch(latest.current.inputHistory, query, before),
    [],
  );
  const suggestions = useMemo(() => suggestNextCommands(state.sim), [state.sim]);

  return useMemo(
    () => ({
      state,
      sim: state.sim,
      blocks: state.blocks,
      history: state.inputHistory,
      prompt: promptFor(state.sim),
      cwd: state.sim.session.cwd,
      submit,
      interrupt,
      clear,
      reset,
      apply,
      snapshot,
      suggestions,
      complete,
      ghost,
      search,
    }),
    [state, submit, interrupt, clear, reset, apply, snapshot, suggestions, complete, ghost, search],
  );
}
