# src/sim

The PURE simulation engine: headless, deterministic, and isolated. Same seed + same commands = identical output.

The only entry point is `step(state, cmd, ctx) => { state, output, events, exitCode }`. A command is `exec` (one tool with ready-made arguments, for tests and replays) or `shell` (a whole command line the terminal has already parsed into data: pipelines, redirection, `&&`, variables, wildcards). Outside code imports from `@/sim` (runtime) or `@/sim/types` (types, plus the event and error code lists), never from the folders inside. Events are the integration seam: missions, the network map and the mentor subscribe to them instead of reading engine internals. Expected failures are typed errors with stable codes (`SIM_ERROR_CODES`); the friendly explanations live in the terminal, not here.

- `core/` state, `step`, RNG, clock, scenarios, serialization, replay, and read-only queries (`inspect.ts`)
- `fs/` the virtual filesystem · `net/` the network model and the discovered-only topology selector · `shell/` running parsed command lines · `tools/` simulated tools and the Linux command set
- `evidence/` the forensics evidence model: disk, memory and log types, artefact refs, zoned time, schemas, the one byte layout every hash is taken of, pure MD5/SHA-1/SHA-256, and a fluent test builder (see its README)
- `__fixtures__/` the test scenario, golden run, and test helpers (`shell.ts` builds command lines for tests)

Never import here: React, Next.js, Node I/O modules, or anything from `src` outside `src/sim`. No `Date.now()`, `new Date()`, or `Math.random()`: inject time and randomness instead. ESLint enforces all of this, and `golden.test.ts` fails loudly if ambient time or randomness is ever read.
