/**
 * The golden run: a fixed command list against the fixture scenario. Its transcript and final
 * state are committed under golden/, and any change to either fails the golden test. It covers
 * every tool, success and failure, firewalls, symlinks, permissions, traversal, and flags.
 */
import type { Run, SimCommand } from "../types";
import { FIXTURE_SCENARIO, FIXTURE_SEED } from "./scenario";

const exec = (...argv: string[]): SimCommand => ({ type: "exec", argv });

export const GOLDEN_RUN: Run = {
  seed: FIXTURE_SEED,
  scenarioId: FIXTURE_SCENARIO.id,
  commands: [
    // netscan, webprobe and hashid were dropped when this was vendored (VENDORED.md); ping keeps
    // the network model and the seeded RNG in the run.
    exec("ping", "--help"),
    exec("ping", "-c", "2", "10.0.1.20"),
    exec("ping", "-c", "1", "db-01"),
    exec("ping", "-c", "1", "10.0.2.40"),
    exec("ping", "mystery-box"),
    exec("ifconfig"),
    exec("logview"),
    exec("logview", "/var/log/auth.log", "--grep", "failed"),
    exec("logview", "logs/syslog", "--level", "error", "--count"),
    exec("logview", "/var/log/private.log"),
    exec("logview", "/etc/shadow"),
    exec("logview", "/tmp/loop-a"),
    exec("logview", "/home/alex/todo.txt"),
    exec("logview", "../../../../home/recruit/.secret-note"),
    {
      type: "exec",
      argv: ["logview", "--grep", "ssh"],
      stdin: "cron ok\nsshd restarted\nssh key added\n",
    },
    exec("sl"),
    exec(),
  ],
};
