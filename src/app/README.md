# src/app

Routes only: pages, layouts, and route handlers that compose features. Keep them thin, with no business or simulation logic.

Every route has an error state and a not-found state (phase 11): `not-found.tsx` (any address that isn't a page, including a mistyped mission or lesson), `(app)/error.tsx` and `(marketing)/error.tsx` (a page broke; the shell or footer stays), and `global-error.tsx` (the root layout itself broke). All three error screens use `ErrorState` from `src/components/shell`. Server errors are logged, metadata only, by `src/instrumentation.ts`.

Never import here: a feature's internals (use `@/features/<name>`). Nothing else in `src` may import from `src/app`.
