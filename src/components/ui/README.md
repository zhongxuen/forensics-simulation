# src/components/ui

Design-system primitives, one component per file, named exports only. Every one is on `/styleguide` (in `pnpm dev`) in each of its states, with the reason for any state it doesn't have.

- **Basics:** `Button` / `ButtonLink`, `Badge` (with the `evidence-tag` tone for artefact refs, and `popKey`), `Card` (with the `letter` variant and its `signed` line), `Panel`, `Tabs` (the selected underline slides), `Dialog`, `Tooltip`, `Menu` (a menu button: the "⋯ Case" overflow menu), `SplitPane` (two panes and a keyboard-movable separator), `ProgressBar`, `ProgressRing`, `StatTile`, `CodeBlock`, `EmptyState`, `Toast` / `ToastViewport`, `Spinner`, `Skeleton` (loading rows), and `SimulatedBadge` (the non-dismissible SIMULATED marker: once per view, the shell's top bar plus any terminal).
- **Beginner and celebration:** `Callout` (tip / concept / warning), `CoachMark` (guided-tour pointer), `ObjectiveTick` (open, current with a "Now" eyebrow, or done; an optional `details` slot), `Stamp` (the debrief's "Case closed"), `SecretFoundToast`, `MissionComplete`, `CharacterMessage` (story and mentor speech bubble). The reward colour is for these alone.
- **Shared:** `candle-mark.tsx` (Candlewright's mark), `icons.tsx` (decorative line icons), `focus-ring.ts` (`FOCUS_RING`, the one keyboard focus style).

Rules:

- Semantic token classes only (`bg-surface-raised`, `text-accent`, `border-status-danger`, …): no hex, `rgb()`, or Tailwind palette colours. `tests/unit/no-hardcoded-colours.test.ts` fails otherwise. Text goes only on colour pairs the contrast audit measures (`src/lib/contrast-audit.ts`).
- Text uses the type roles (`type-page-title`, `type-small`, `type-data`, … in `src/styles/typography.css`) rather than raw sizes.
- Every interactive element shows `FOCUS_RING`; icon-only buttons take a `label`.
- Variants are typed unions; props that depend on each other are discriminated unions.
- Motion comes from `src/styles/motion.css` (`animate-*`, `fx-duration-*`), so it honours reduced motion. Celebrations finish within 1.5s, never block input, can be skipped with any key (`useSkippableEffects`), and rest on a still version that reads as a reward.
- Copy follows `md-files/voice-and-tone.md`.
- No data fetching, no app state, no browser storage: data comes in through props and goes out through callbacks.

Never import here: features, `src/app`, `src/sim`, `src/content`, or `src/components/shell`.
