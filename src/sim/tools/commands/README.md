# src/sim/tools/commands

The Linux command set (`md-files/05-terminal-module.md`, "Command set (v1)"), one file per command: `pwd ls cd tree`, `cat less head tail touch mkdir rm cp mv stat file`, `grep wc sort uniq cut sed echo`, `whoami id ps uname env history date`, `chmod chown sudo`, `ping hostname ifconfig`, `man help clear exit`. Each is a pure function over `SimState` using the virtual filesystem, supports the options a learner would try, fails realistically (with typed errors) on the rest, and has beginner-first help with a CONCEPT section, shown by `--help` and `man`.

Adding one: a file here and one line in `index.ts`. `shared.ts` holds the input-reading and error-wording helpers; `regex.ts` turns grep and sed patterns into matchers. Tests sit next to the code (`*.test.ts`), grouped by kind of command.

Never import here: anything outside `src/sim`.
