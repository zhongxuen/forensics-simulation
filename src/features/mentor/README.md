# src/features/mentor

The AI Mentor: Noor Halvorsen (`mentor-noor` in docs/plan/99-reference.md §Story world). She personalises authored hints (hints, never answers, and hints never cost anything), explains what's on the player's screen, and looks back at a finished case with them. Plan file [14](../../../docs/plan/14-mentor.md).

Vendored from `../hacker-simulation/src/features/mentor/` and adapted to cases. Every change is listed in [VENDORED.md](../../../VENDORED.md); the ones that matter are named below.

The mentor is an **enhancement, never a dependency**. With no API key, the kill switch on, a rate-limit hit, a model failure, or a rejected response, the player still gets text written ahead of time, in Noor's voice, and nothing surfaces as an error: the authored hint verbatim, the terminal's own explanation, a view's own sentence about a row, the glossary's definition, or the template review. She also **never opens anything by herself**: the player asks, and the mentor only ever offers.

## Public API

- **`index.ts` (client-safe)** — safe to bundle for the browser. Imports no API key and no Anthropic SDK.
  - Requests (`client.ts`), each of which always resolves and re-throws only on a caller abort:
    - `requestMentorHint({ caseDef, objectiveId, tier, transcript, onText, signal })` → `{ mode, text }`; the fallback is the case's own `objectives[…].hints[tier - 1]` verbatim (`authoredHint`).
    - `requestMentorExplain({ caseId, objectiveId?, subject, transcript, fallback, onText, signal })` → `{ mode, text }`; `subject` is terminal output (a line or a whole result, flagged when it's an error), a **row** from the Evidence Browser, the timeline or the case board, or a glossary word by id.
    - `requestMentorReview({ caseId, facts, transcript, signal })` → `{ mode, review }`; the fallback is `buildFallbackReview(facts)`.
    - `MentorCaseRef` is all a request needs of a case: its id and its objectives' authored hints. `RunnableCase` satisfies it as it is, so this feature never imports the cases feature (which imports this one).
  - The attempt's memory (`session/`): `useMentorSession(caseDef)` (the React hook the case runner holds per attempt) over `createMentorStore(caseDef, deps?)`, a plain store of every hint tier shown, each explanation, and the review. `askHint` enforces the ladder (tier 1 at once, later tiers after `HINT_COOLDOWN_MS`, never past tier 3, never for a secret); `requestReview` runs once per attempt. Selectors: `hintsFor`, `nextHintTier`, `nextHintUnlockAt`, `canRevealHint`, `questionView`, `questionViewLabel`. `staticMentorSession()` never asks anything (the styleguide and tests).
  - The review (`review.ts`): `MentorReview` and its schema, `ReviewFacts` (gathered by the cases feature), `ReviewCustodyFacts`, `custodySentence`, `runFactLines` ("Your case at a glance": objectives, findings, pins, whether they hashed first, time, hints opened, commands tried) and `buildFallbackReview`, the template.
  - The nudge (`nudge.ts`): `useNudge({ progress, failures, enabled })` and the pure `seemsStuck` (3 attempts that didn't work since the last tick, or 3 minutes without one).
  - Transcripts: `buildMentorTranscript(blocks, limits?)` / `capTranscript(entries, limits?)`, with `HINT_TRANSCRIPT_LIMITS` (the last 12 commands in detail) and `REVIEW_TRANSCRIPT_LIMITS` (up to 40 commands, the start of each output).
  - Components (`components/`): `MentorPanel` (the drawer: Noor's welcome, "Hints are free", the hint ladder for one step at a time with which hint you're on and a calm cooldown, explanations under the questions asked, and a quiet line when she's answering from her notes), `MentorBubble`, `TypingIndicator`, `NudgeChip`, `MentorReviewCard` (the debrief's "Looking back with Noor"), `MentorText`.
  - Shared constants: `HINT_TIERS`, `HINT_TIER_LABELS`, `EXPLAIN_VIEW_LABELS`, `MENTOR_ENDPOINTS`, `MENTOR_FIRST_NAME`, `HINTS_ARE_FREE`, `FROM_NOTES_LABEL`.
- **`server.ts` (server-only)** — for the routes and tests only.
  - `toMentorCase` — **the projection** (see below). Everything else on this side takes its result, never a `Case`.
  - `handleHintRequest`, `handleExplainRequest`, `handleReviewRequest(request, deps)` — the whole request→response logic, with `getCase`, the config, and the model runner injected (so tests never touch the network). The streaming, body cap, fallbacks and the one metadata-only log line they share live in `respond.ts`. Its `readJsonBody` refuses a request from another site (403), a body not sent as JSON (415) and a body over 16 KB (413, read as a stream and dropped as soon as it passes the cap) before anything is parsed.
  - `buildHintPrompt`, `buildExplainPrompt`, `buildReviewPrompt` — pure prompt building. Versioned prompt files are in `prompts/` (`hint.v1`, `explain.v1`, `review.v1`, and `noor.v1`, the persona, voice, safety, **forensics** and data rules they share). Prompts are versioned files, never edited in place: to change what a prompt says, add `hint.v2.ts` beside `hint.v1.ts` and leave the old one alone, so an old log line still says exactly which prompt wrote it.
  - `manPageFor` — a tool's own manual page as plain text, for "Explain this" on terminal output.
  - `validateMentorOutput` — the output safety check; `checkReviewOutput` — the review's JSON shape, every sentence validated, lessons limited to the case's own.
  - The request schemas and caps, `readMentorConfig`, `createAnthropicRunner` / `getAnthropicRunner`, and the caps and limits constants.

## Where the mentor shows up

- **Case workspace** (`@/features/cases`): an "Ask Noor" button in the header opens the panel. "Show me a hint" shows a tier in the panel. "Explain this" works on **four** surfaces: a terminal line, error or whole result (`onExplain` on `Terminal`), and a row in the Evidence Browser, the timeline or the case board (each pane calls `workstation.explain`, the one line file 14 adds to the pane registry). The "Want a nudge?" chip sits in the toast corner when the player seems stuck and the `nudgeChip` setting is on.
- **Debrief**: "Looking back with Noor", asked for by the player, held with the attempt so it's written once.

## The no-key-in-client rule

The Anthropic SDK is imported from exactly one module, `anthropic-client.ts`, which begins with `import "server-only"` so importing it from any client module is a build error. It is reached only through `server.ts`, which is imported only by the routes (`src/app/api/mentor/{hint,explain,review}/route.ts`). The client API (`index.ts`) never imports it, so no key or model endpoint can reach a client bundle. `pnpm security:bundle` checks the built output and fails on the SDK, the key, its shape, or a server-only variable name.

## The model never holds the answer key

In this game a case file carries far more that must never reach a model than a mission ever did: the ground-truth `story`, every report question's `answer` and `acceptedEvidence`, each objective's `check` and `success` line, and the debrief. So leaving it out is **structural**, not a convention:

- `toMentorCase` (`case-view.ts`) projects a case down to its id, title, learning goals, lesson ids, and each objective's description, `why`, name and authored hints. Nothing else. Every field is copied by name, so a new field in the case schema can never arrive here by accident.
- Every handler, prompt builder and deps type below it takes a `MentorCase`, never a `Case`. A prompt builder that wanted a report answer could not compile.

On top of that:

- **Hints**: the route loads the authored tier from the case content by `(caseId, objectiveId, tier)`, never from the request. The prompt is given tiers 1..tier (all already shown to the player) and never a later tier, plus the objective's description and `why`, and the delimited transcript. A secret ships no hints, so asking about one is answered exactly like asking about a step that doesn't exist — the route never confirms a secret exists.
- **Explanations**: the case's title, the current step's description, the glossary definition for a word, **the tool's man page** for terminal output, and the player's screen as delimited data. Never the evidence set, and never a hint.
- **Reviews**: the words of the objectives the player ticked and the extras they found (never an unfound secret), the learning goals, counts, the lesson ids it may suggest, and the **shape** of the chain of custody — each entry's kind, in order, plus whether a hash came first. Never a digest, path, record number or ref, and never a report answer: a player can go straight back and change their report from the debrief, so an answer given there would still be an answer given.

Every prompt also carries the **forensics rule** (`FORENSICS_RULE` in `prompts/noor.v1.ts`): never state a report answer, never state or confirm a timestamp from the answer key, never say which pin counts as accepted evidence, never name a file or record as "the one". It is a second line of defence — the first is that none of it is in the prompt to begin with.

## Never import here

- Another feature's internals (only `@/features/<name>` or `@/features/<name>/server`). The cases feature imports this one, never the other way round — which is why `MentorCaseRef` and `MentorCaseSource` are structural types rather than imports.
- The Anthropic SDK or any API key from anywhere but `anthropic-client.ts`.
- Browser storage. Nothing is stored between requests: the routes are stateless, and the client keeps everything the mentor said only in memory, for the current attempt. A case run _is_ saved in this browser, but what Noor said is not part of the save.

## Tests

- `tests/mentor/injection.test.ts` — 21 injection attempts (the sibling's 16, plus the five docs/plan/14 asks for) through all three prompts, and a hostile file name the **generator** plants in the evidence (`tests/mentor/__fixtures__/hostile-evidence.ts`) followed into all four "Explain this" surfaces.
- `tests/mentor/answer-key.test.ts` — for every case this repo ships, the projection and every prompt built from it contain not one string of the answer key.
- `tests/integration/mentor-routes.test.ts` — the real routes end to end with only `@anthropic-ai/sdk` mocked, including a whole block for "no key at all".
- `tests/unit/mentor-session.test.ts`, `tests/unit/mentor-transcript.test.ts`, `tests/components/mentor.test.tsx` — the ladder, the caps, the fencing, the man page, and the panel with no key and no server.
