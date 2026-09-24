# src/app/(app)

The product surface inside the app shell (`layout.tsx`): `/cases` (the chapter's released cases, then the practice case) and `/cases/[slug]` (the case runner; a playable case file is turned into the runner's shape on the server at build time, a case still being written gets a placeholder, and any slug not in `CASE_LISTINGS` is a 404), `/sandbox` (the terminal on the analyst workstation, loaded through `lazy-sandbox-workspace.tsx` so the engine isn't in the first download), `/learn` (placeholder until file 13) and `/settings`. There are no accounts, so no route here may ask anyone to sign up or sign in.

Never import here: a feature's internals (use `@/features/<name>`) or simulation internals. Keep pages thin.
