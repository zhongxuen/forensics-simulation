# Candlewright: Incident Room

A forensics investigation game set in the Hacker Simulation world. You join Candlewright Security's blue team after a made-up break-in at a made-up client, examine a disk image, a memory dump and a set of logs in a simulated terminal, pin what you find to a case board, and close the case with a report where every answer points at evidence. Everything is simulated: nothing touches a real computer.

**Status:** foundation built (plan file 01). The app runs with its shell, settings, the terminal on an analyst workstation at `/sandbox`, and placeholder pages for cases and lessons. No case is playable yet.

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
