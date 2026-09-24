# Candlewright: Incident Room

A forensics investigation game set in the Hacker Simulation world. You join Candlewright Security's blue team after a made-up break-in at a made-up client, examine a disk image, a memory dump and a set of logs in a simulated terminal, pin what you find to a case board, and close the case with a report where every answer points at evidence. Everything is simulated: nothing touches a real computer.

**Status:** "Case 1 only" release (plan file 15, part A). Case 1, "The clean copy", plays end to end in the browser: copy a laptop's drive behind a write-blocker, prove the copy with its hash, pin the note left on it, and write a report whose answers point at evidence. The Foundations lessons are at `/learn`, and the terminal is at `/sandbox`. Cases 2 and 3 are still being written. Operations are in [docs/runbook.md](docs/runbook.md).

- Implementation plan: [docs/plan/00-overview.md](docs/plan/00-overview.md) (start there; files 01–16 each carry copy-paste prompts, grouped into waves)
- Shared decisions across the portfolio expansion projects: [docs/README.md](docs/README.md)
- What was copied from Hacker Simulation, and every change since: [VENDORED.md](VENDORED.md)

## Running it

```sh
pnpm install
pnpm dev        # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Optional: copy `.env.example` to `.env.local` to try the mentor once it exists (plan file 14). The app works fully without it.
