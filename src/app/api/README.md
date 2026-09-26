# src/app/api

Route handlers (server-only): the AI Mentor proxy. Secrets and answer keys stay here, never in client code.

Never import here: React components or client-only code. Validate every request body before using it.

## Routes

All three are the mentor (docs/plan/14-mentor.md). They are the only code in this app that runs on a server per request, and the only code that talks to anything outside it.

- `mentor/hint` — `POST /api/mentor/hint`. Stateless: no module-level state remembers a request or a player; each body is Zod-validated fresh. It loads the authored hint tier **from the case file** (never from the request), asks the model to personalise it, validates the model's output before any of it reaches the client, and streams newline-delimited JSON (`text` / `done` / `fallback`). Any problem — no key, the kill switch, a bad or oversized body, an unknown target, a model failure, or a rejected response — ends in a `fallback`, and the client shows the authored hint.
- `mentor/explain` — `POST /api/mentor/explain`, "Explain this" on any of four surfaces: a terminal line, error or whole result; a row in the Evidence Browser, the timeline or the case board; or a glossary word (the definition is loaded from `src/content/glossary.ts`, never the request). For terminal output it also sends the tool's own man page, read from the registry by name. **It never sends the evidence set**: the rendered line the player pointed at is the whole subject.
- `mentor/review` — `POST /api/mentor/review`, "Looking back with Noor" on the debrief. The body is ids, counts, the shape of the chain of custody (each entry's kind, in order, and whether a hash came first) and the capped transcript; every word about the case itself comes from the case content. It answers with JSON (`{ mode: "model", review }` or `{ mode: "fallback", reason }`) because every sentence is checked before any of it is shown; the model is asked for the review's JSON shape with structured outputs.

**The answer key never reaches any of them.** Each route calls `toMentorCase` before the handler, which projects a case down to its objectives and their hints; no report answer, accepted ref, objective check, success line or story action is on the type the handler receives (`src/features/mentor/case-view.ts`, `tests/mentor/answer-key.test.ts`).

Before any parsing, all three refuse: a request from another site (403, by `Sec-Fetch-Site` / `Origin`), a body not sent as `application/json` (415), and a body over 16 KB (413, checked on `Content-Length` and again on the bytes as they stream in). Each logs exactly one metadata-only line per request and never logs player text.

Rate limiting is a Vercel Firewall rule on `/api/mentor/*` (steps in `docs/runbook.md`); a request over the limit is stopped at the edge and the client treats it like any other fallback. `next.config.ts` traces `src/content/cases/**` into each function, because `getCase` reads the YAML at request time.

`tests/integration/mentor-routes.test.ts` calls each route's real `POST` with only the Anthropic SDK mocked.
