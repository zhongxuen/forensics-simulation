# tests/integration

Route Handlers end to end, in Node: `mentor-routes.test.ts` calls the real exported `POST` of `/api/mentor/hint`, `/explain` and `/review`, through the real config, case projection, handler, prompt builder, output validator and SDK-backed runner. Only `@anthropic-ai/sdk` is replaced (with `vi.mock`), by a fake that records every call and streams whatever reply the test sets, so no key and no network are needed (docs/plan/14-mentor.md: "Mock the SDK in integration tests").

It covers every security-relevant path: validation and size limits, the hint tier loaded from the case file and never a later one, the answer key never reaching the model, the man page that is sent instead of the evidence, the fallbacks, output validation, cross-site refusal, and logs with no player text — plus a block for **no API key at all**, where every route answers 200 with a clean fallback and no SDK client is ever made.

Never import here: a real network, or a real API key.
