# src/components/ui

Design-system primitives, one component per file, named exports only. Every one is on `/styleguide` (in `pnpm dev`) in each of its states, with the reason for any state it doesn't have.

- **Basics:** `Button` / `ButtonLink`, `Badge`, `Card`, `Panel`, `Tabs`, `Dialog`, `Tooltip`, `ProgressBar`, `ProgressRing`, `StatTile`, `CodeBlock`, `EmptyState`, `Toast` / `ToastViewport`, `Spinner`, and `SimulatedBadge` (the non-dismissible SIMULATED marker every terminal and tool view carries).
- **Beginner and celebration:** `Callout` (tip / concept / warning), `CoachMark` (guided-tour pointer), `ObjectiveTick` (with an optional `details` slot), `SecretFoundToast`, `MissionComplete`, `CharacterMessage` (story and mentor speech bubble). The reward colour is for these alone.
- **Shared:** `icons.tsx` (decorative line icons), `focus-ring.ts` (`FOCUS_RING`, the one keyboard focus style).

Rules:

- Semantic token classes only (`bg-surface-raised`, `text-accent`, `border-status-danger`, …): no hex, `rgb()`, or Tailwind palette colours. `tests/unit/no-hardcoded-colours.test.ts` fails otherwise. Text goes only on colour pairs the contrast audit measures (`src/lib/contrast-audit.ts`).
- Every interactive element shows `FOCUS_RING`; icon-only buttons take a `label`.
- Variants are typed unions; props that depend on each other are discriminated unions.
- Motion comes from `src/styles/motion.css` (`animate-*`, `fx-duration-*`), so it honours reduced motion. Celebrations finish within 1.5s, never block input, can be skipped with any key (`useSkippableEffects`), and rest on a still version that reads as a reward.
- Copy follows `md-files/voice-and-tone.md`.
- No data fetching, no app state, no browser storage: data comes in through props and goes out through callbacks.

Never import here: features, `src/app`, `src/sim`, `src/content`, or `src/components/shell`.
