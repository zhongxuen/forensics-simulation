# Candlewright: Incident Room

A forensics investigation game set in the Hacker Simulation world. You join Candlewright Security's blue team after a made-up break-in at a made-up client, examine a disk image, a memory dump and a set of logs in a simulated terminal, pin what you find to a case board, and close the case with a report where every answer points at evidence. Everything is simulated: nothing touches a real computer.

**Status:** the full chapter is released (plan file 15, part B). Three cases at one made-up haulage yard, each playable end to end in the browser:

1. **The clean copy** (about 15 minutes): copy a laptop's drive behind a write-blocker, prove the copy with its hash, and pin the note left on it.
2. **The deleted invoice** (about 30): recover and carve deleted invoices, find a remote sign-in, put two clocks in one zone, and write a report that clears the person everyone suspected.
3. **Something is still running** (about 30): read a memory capture taken before anyone pulled the plug, find a hidden process calling out once a minute and the code injected into it, trace the way in through the sign-in records, and close the chapter.

The Learning Center (four tracks of lessons on generated practice evidence) is at `/learn`, and `/sandbox` has a goal-free practice kit: a drive, a memory capture and five sets of logs to try any tool on. Noor, the mentor, is optional and off without an API key. Operations, owner steps and known limits are in [docs/runbook.md](docs/runbook.md).

- Implementation plan: [docs/plan/00-overview.md](docs/plan/00-overview.md) (start there; files 01–16 each carry copy-paste prompts, grouped into waves)
- Shared decisions across the portfolio expansion projects: [docs/README.md](docs/README.md)
- What was copied from Hacker Simulation, and every change since: [VENDORED.md](VENDORED.md)

## Running it

```sh
pnpm install
pnpm dev        # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Optional: copy `.env.example` to `.env.local` and add an Anthropic key to try the mentor (plan file 14). The app works fully without it.

Authoring a case: `pnpm case:new <id>`, then `pnpm evidence:build`, `pnpm case:validate <id>` and `pnpm case:play <id>` ([src/content/cases/README.md](src/content/cases/README.md)). Before a release: `pnpm build`, `pnpm bundle:check`, `pnpm security:bundle`, `pnpm test:e2e`, and `pnpm perf:vitals` against `pnpm start`.
