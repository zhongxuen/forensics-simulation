# src/sim/tools

Everything a learner can type: the simulated security tools (`logview`), the examiner's toolset in `forensics/` (`acquire`, `blocker`, `hashsum`, `inode`, `lsfs`, `pin`, `recover`; see its README), and, in `commands/`, the Linux command set. Each is a pure function `(args, state, ctx) => SimResult` with a category (for `help` and the cheat sheet), beginner-first help, and typed errors. Security tools get names distinct from real tools and output that is representative, never a byte-copy; targets outside the reserved address ranges are refused as `OUT_OF_SCOPE`.

Adding a tool takes two files: the tool, and one line in `index.ts` (or in `commands/index.ts` for a Linux command). `listTools()` (`catalog.ts`, exported from `@/sim`) lists every registered tool's name, one-liner and category without running anything. `help.ts` renders `--help` and man pages (`renderManPage`: NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, CONCEPT, and REAL-WORLD EQUIVALENT for a tool that sets `help.realWorld`). `args.ts` parses options, including clusters like `-la`.

Never import here: anything outside `src/sim`. These tools only ever act on the simulated network.
