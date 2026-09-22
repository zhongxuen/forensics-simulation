# src/styles

Global CSS and Tailwind theme tokens (CSS-first config), readable by the terminal renderer as well as by components.

- `globals.css` — the entry point imported by the root layout. Imports Tailwind, then the files below, and defines custom variants: `rail:` for the collapsed sidebar, and `data-force-state` hooks on `hover:` / `focus-visible:` so `/styleguide` can freeze those states.
- `tokens.css` — semantic design tokens (`--surface-*`, `--text-*`, `--accent*`, `--status-*`, `--reward*`, `--border-*`, `--focus-ring`, `--term-*`) on a dark-first `:root`. A light theme would be one more block reassigning the same names.
- `theme.css` — maps the tokens into Tailwind so they work as classes (`bg-surface-raised`, `text-primary`, `text-accent`, `border-subtle`, …). Components use these classes, never raw hex or Tailwind palette colours; `tests/unit/no-hardcoded-colours.test.ts` enforces it.
- `motion.css` — duration and easing tokens, every animation (`animate-pop`, `animate-tick-fill`, `animate-burst`, …), `fx-duration-*` transition utilities, and the decorative `fx-scanlines` / `fx-spark`. All motion is multiplied by `--motion-scale`, which is 0 under `prefers-reduced-motion: reduce` or inside `data-motion="reduce"`, so every effect lands on its finished, still state. `tests/unit/motion.test.ts` checks that every animation scales and that celebrations finish within 1.5s.
- `code.css` — syntax highlighting colours for lesson code blocks. Shiki colours each token with `var(--code-token-*)`, and each points at an audited token, so highlighted code adds no new colours.

Every text colour must pass WCAG AA on every surface. The pairs are listed in `src/lib/contrast-audit.ts`; `pnpm test` fails if any pair falls short or a new colour token is neither audited nor excluded with a reason, and `/styleguide` (in `pnpm dev`) shows the full table.

Never import here: JavaScript or TypeScript. This folder is CSS only.
