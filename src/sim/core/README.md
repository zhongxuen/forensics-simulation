# src/sim/core

Engine state (`types.ts`), the reducer that applies commands (`step.ts`), the injected clock, the seeded random number generator, stable error codes and event types, building a starting state from a scenario spec, versioned serialization, and run replay.

Each command's randomness is derived from the state's seed and tick, so a restored snapshot continues exactly where it left off. `step` reads the clock once per command.

Never import here: anything outside `src/sim`, or any real source of time or randomness.
