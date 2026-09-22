# src/app/(app)

The product surface inside the app shell (`layout.tsx`): `/cases` and `/cases/[slug]` (placeholders until files 05 and 06; `cases/planned-cases.ts` lists the three case ids so any other slug is a 404), `/sandbox` (the terminal on the analyst workstation, loaded through `lazy-sandbox-workspace.tsx` so the engine isn't in the first download), `/learn` (placeholder until file 13) and `/settings`. There are no accounts, so no route here may ask anyone to sign up or sign in.

Never import here: a feature's internals (use `@/features/<name>`) or simulation internals. Keep pages thin.
