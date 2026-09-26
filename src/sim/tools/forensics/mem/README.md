# src/sim/tools/forensics/mem

`mem`, the memory half of the toolset (`docs/plan/08-memory-tools.md`): one command with a subcommand per question, run against a memory image the case hands over. Images are found by id (`qf-srv-01-mem`) or by host (`qf-srv-01`) in `state.evidence.set.memory`. A memory image is not a device: nothing reads it through a write-blocker and reading it changes nothing, so every subcommand is a plain function of the image.

| Subcommand            | Shows                                                                               | Event                         |
| --------------------- | ----------------------------------------------------------------------------------- | ----------------------------- |
| `mem`                 | The case's memory images and the subcommands                                        | none                          |
| `mem info <image>`    | Host, capture time in UTC and on the host's clock, what the image holds             | `memory.inspected`            |
| `mem ps <image>`      | The active process list: unlinked and exited processes are not on it                | `memory.listed`               |
| `mem psscan <image>`  | Every process record, marked `unlinked` or `exited` when the list leaves it out     | `memory.scanned` (`unlinked`) |
| `mem pstree <image>`  | The active list indented by parent                                                  | `memory.listed`               |
| `mem netscan <image>` | Connections in the order they were made, with each owner's name (from a scan)       | `memory.scanned`              |
| `mem cmdline <image>` | Every scanned process's command line; an exited one's is gone                       | `memory.inspected`            |
| `mem malfind <image>` | `PAGE_EXECUTE_READWRITE` regions with no file behind them, and their first 64 bytes | `memory.scanned`              |
| `mem strings <image>` | Not built yet: prints where to look instead, and emits no event. TODO(file 07)      | none                          |

`netscan`, `cmdline`, `malfind` and `strings` take `--pid n`; every subcommand takes `--zone local`. Every line that shows a process, a connection or a region carries its ref (`mem:<image>:pid/<pid>`, `conn/<index>`, `vad/<base>`), so `pin` can put it on the board; a malfind block carries its region's ref on every line.

- `shared.ts`: finding the image, the two ways to read processes (`listProcesses`, the active list, and `scanProcesses`, everything), refs, and the request and report every subcommand shares.
- `processes.ts` (`info`, `ps`, `psscan`, `pstree`), `netscan.ts`, `cmdline.ts`, `malfind.ts`, `strings.ts`: one subcommand each, returning its lines, its banner details and its event. `index.ts` parses the command, checks the image and `--pid`, and prints the banner.
- `__fixtures__/memory.ts` is the image the tests run against, built with the evidence builder: an unlinked process, an exited one, an `svchost.exe` whose parent is `explorer.exe`, a connection repeating every minute, one injected region starting `MZ` and one harmless runtime-compiler region. `golden.test.ts` holds the committed transcript of info → ps → psscan → pstree → netscan → cmdline → malfind (`__fixtures__/golden/mem-tools.txt`): never edit it by hand, delete it and rerun after an intentional change.

The outputs are a teaching model, and the man page says so: real memory tools rebuild these lists from raw kernel structures whose layout differs between Windows builds. The Evidence Browser's Processes tab (`src/features/evidence-browser/memory/`) shows the `psscan` list with an "In active list?" column, by the same rule as `listProcesses`.

Never import here: anything outside `src/sim`.
