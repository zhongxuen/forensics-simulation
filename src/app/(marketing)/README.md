# src/app/(marketing)

Public pages that need no account: the landing page (`/`: one sentence, the SIMULATED line, "Open Case 1", a link to Hacker Simulation and the disclaimers, whose words live in `src/content/release.ts`) and "What we store" (`/privacy`). `layout.tsx` adds the footer, which links to both. The parentheses make this a route group, so it adds no URL segment.

`/privacy` must say exactly what the app stores (`docs/plan/00-overview.md` §7). When a change adds a setting, a storage key or anything sent anywhere, update it in the same change.

Never import here: a feature's internals or anything from `src/sim` directly. Compose features through their `index.ts`.
