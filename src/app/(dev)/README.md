# src/app/(dev)

Developer-only pages. Each is served by `pnpm dev` and is a 404 in every production build, including Vercel previews. Nothing in the product links here.

- `styleguide/` — every component in every state, the lesson pipeline on sample content, the type and spacing scales, and the contrast audit. Vendored, without the mentor section (file 14 brings it back).

`dev-only.ts` holds the gate for pages that need one (`requireDevPage`). It also opens for `E2E_FIXTURES=1`, which the Playwright config sets on the server it starts; nothing sets it on a deployment. A page using it must also set `export const dynamic = "force-dynamic"`.

Never import here: a feature's internals (use `@/features/<name>`) or simulation internals.
