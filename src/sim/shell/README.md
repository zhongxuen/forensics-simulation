# src/sim/shell

The shell half of the terminal: running a parsed command line (`ShellCommand`, in `types.ts`). The terminal feature parses the text; this folder runs the structure, so the engine never re-reads shell syntax and nothing is ever evaluated as code.

- `run.ts` — `runShell`: pipelines (`|`), redirection (`>`, `>>`, `<`, `2>`, `2>>`, `2>&1`, `/dev/null`), `;`, `&&`, `||`, `NAME=value` assignments, session history, and flag detection on what reaches the screen.
- `expand.ts` — word expansion: `$VAR`, `${VAR}`, `$?`, `~`, and wildcards (`*`, `?`, `[abc]`), matched against the filesystem as the session's user sees it.
- `complete.ts` — read-only questions for the terminal's beginner layer: Tab completion, "did you mean" for commands and paths, and suggested next commands.
- `validate.ts` — checks a `ShellCommand` read back from JSON (a saved run is untrusted input).

Never import here: anything outside `src/sim`. Same purity rules as the rest of the engine.
