import type { Rng } from "../../core/rng";
import { zonedParts } from "../time";
import type { Instant } from "../types";
import {
  GenerateError,
  type MachineSpec,
  type NoiseDensity,
  type NoiseProfileId,
  type NoiseSpec,
  type StoryAction,
} from "./types";
import type { MachineState } from "./world";

/**
 * Seeded benign activity around the story (docs/plan/03-case-format-and-generator.md §Noise
 * profiles). Without it every case reads like a stage with two actors on it: whatever is in the
 * logs must be the answer, because nothing else is there. Noise is what makes finding the answer
 * a skill rather than a reading exercise, and turning the density up or down makes a case harder
 * or easier **without touching the story**.
 *
 * Noise is made of the same story actions as everything else, so it goes through the same handlers
 * and leaves the same kinds of artefacts. It keeps to a small, deliberately dull vocabulary —
 * ordinary documents, ordinary sites, ordinary programs — and it never touches an account, a file,
 * an address or a program the story uses. `tests/content` checks the harder promise: nothing noise
 * leaves behind ever matches a report question's `acceptedEvidence`.
 */

export interface NoiseProfile {
  readonly id: NoiseProfileId;
  readonly summary: string;
  /** The hours of the machine's own local day it is busy in. */
  readonly busyHours: readonly number[];
  /** How many things happen in a busy hour, on one machine, at each density. */
  readonly rate: Readonly<Record<NoiseDensity, number>>;
  /** What can happen, each equally likely. */
  readonly kinds: readonly NoiseKind[];
}

type NoiseKind = "save-document" | "browse" | "look-up" | "run-program" | "web-visit" | "sign-in";

export const NOISE_PROFILES: Readonly<Record<NoiseProfileId, NoiseProfile>> = {
  "office-day": {
    id: "office-day",
    summary: "An ordinary working day: people sign in, save things, and read a few sites.",
    busyHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    rate: { none: 0, low: 1, medium: 2, high: 4 },
    kinds: ["save-document", "browse", "look-up", "run-program", "sign-in"],
  },
  "quiet-night": {
    id: "quiet-night",
    summary: "The office is empty. Only the machine itself is doing anything.",
    busyHours: [22, 23, 0, 1, 2, 3, 4, 5],
    rate: { none: 0, low: 1, medium: 1, high: 2 },
    kinds: ["look-up", "run-program"],
  },
  "server-idle": {
    id: "server-idle",
    summary: "A server ticking over: requests from the office, lookups, scheduled jobs.",
    busyHours: Array.from({ length: 24 }, (_, hour) => hour),
    rate: { none: 0, low: 1, medium: 2, high: 3 },
    kinds: ["web-visit", "look-up", "run-program"],
  },
};

/** Dull on purpose, and never anything a story would use. */
const DOCUMENTS = [
  "pallet-counts.txt",
  "trailer-checks.txt",
  "gate-rota.txt",
  "fuel-log.txt",
  "tyre-order.txt",
  "week-notes.txt",
];
const SITES = ["updates.example", "mail.example", "maps.example", "parts.example"];
const PROGRAMS = ["notepad.exe", "calc.exe", "backup-check.exe", "printspool.exe"];
const PAGES = ["/", "/dockets", "/dockets/week", "/health", "/reports/daily"];

const HOUR = 3_600_000;
/** Above this, a case's evidence stops being something a beginner can read. */
const MAX_NOISE_ACTIONS = 1200;

export interface NoiseWindow {
  readonly from: Instant;
  readonly to: Instant;
  /**
   * When a machine stops being a working machine and becomes evidence: its hand-over. Nothing
   * happens on it after that, so neither does any background activity — and the hashes on the
   * form go on matching the image.
   */
  readonly stops?: ReadonlyMap<string, Instant>;
}

/**
 * The benign activity for one case, in time order. Deterministic: the same seed, machines and
 * window always give the same list, in the same order, because every choice comes from `rng` and
 * the machines and hours are walked in a fixed order.
 */
export function planNoise(
  noise: NoiseSpec | undefined,
  machines: readonly MachineState[],
  window: NoiseWindow,
  rng: Rng,
): StoryAction[] {
  if (!noise || noise.density === "none") return [];
  const profile = NOISE_PROFILES[noise.profile];
  const perHour = profile.rate[noise.density];
  if (perHour === 0) return [];

  const actions: StoryAction[] = [];
  for (const machine of machines) {
    // The analyst's own workstation is not part of the client's week.
    if (!machine.disk) continue;
    const accounts = noiseAccounts(machine.spec, machine);
    const until = Math.min(window.to, window.stops?.get(machine.id) ?? window.to);
    for (let at = floorHour(window.from); at < until; at += HOUR) {
      const local = zonedParts(at, machine.zone);
      if (!profile.busyHours.includes(local.hour)) continue;
      for (let i = 0; i < perHour; i++) {
        const minute = rng.int(0, 59);
        const second = rng.int(0, 59);
        const when = at + minute * 60_000 + second * 1000;
        if (when < window.from || when >= until) continue;
        const kind = rng.pick(profile.kinds);
        const action = makeAction(kind, machine, accounts, when, rng);
        if (action) actions.push(action);
      }
    }
  }

  if (actions.length > MAX_NOISE_ACTIONS) {
    throw new GenerateError(
      `this case would have ${actions.length} pieces of background activity, which is more than a beginner can read through. Lower noise.density, or shorten the story.`,
      "noise",
    );
  }
  return actions.sort((a, b) => a.at - b.at);
}

/** The accounts noise may act as: the people on the machine, never its built-in ones. */
function noiseAccounts(spec: MachineSpec, machine: MachineState): string[] {
  const named = new Set((spec.accounts ?? []).map((name) => name.toLowerCase()));
  return [...machine.accounts.values()]
    .filter((account) => named.has(account.name.toLowerCase()))
    .map((account) => account.name);
}

function makeAction(
  kind: NoiseKind,
  machine: MachineState,
  accounts: readonly string[],
  at: Instant,
  rng: Rng,
): StoryAction | undefined {
  const account = accounts.length > 0 ? rng.pick(accounts) : undefined;
  const home =
    account === undefined ? undefined : machine.accounts.get(account.toLowerCase())?.home;
  const actor =
    account === undefined ? ({ kind: "system" } as const) : ({ kind: "user", account } as const);
  const on = machine.id;

  switch (kind) {
    case "save-document":
      if (account === undefined || home === undefined) return undefined;
      return {
        at,
        actor,
        on,
        do: "create-file",
        path: `${home}\\Documents\\${rng.pick(DOCUMENTS)}`,
        content: `${rng.int(2, 40)} counted, ${rng.int(0, 6)} still to check.\n`,
      };
    case "browse":
      if (account === undefined) return undefined;
      return { at, actor, on, do: "browse", url: `https://${rng.pick(SITES)}/`, account };
    case "look-up":
      return {
        at,
        actor: { kind: "system" },
        on,
        do: "dns-query",
        query: rng.pick(SITES),
        type: "A",
        answer: `198.51.100.${rng.int(10, 240)}`,
      };
    case "run-program": {
      const program = rng.pick(PROGRAMS);
      return {
        at,
        actor: { kind: "system" },
        on,
        do: "run-process",
        name: program,
        path: `C:\\Windows\\System32\\${program}`,
        user: account ?? "SYSTEM",
      };
    }
    case "web-visit":
      return {
        at,
        actor: { kind: "system" },
        on,
        do: "web-request",
        path: rng.pick(PAGES),
        method: "GET",
        status: "200",
        clientIp: `10.60.0.${rng.int(20, 60)}`,
        bytes: String(rng.int(200, 9000)),
        userAgent: "Quillfen dispatch board",
      };
    case "sign-in":
      if (account === undefined) return undefined;
      return { at, actor, on, do: "logon", account, type: "interactive" };
  }
}

function floorHour(at: Instant): Instant {
  return at - (at % HOUR);
}
