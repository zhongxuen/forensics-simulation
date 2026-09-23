/**
 * The evidence generator's public surface (docs/plan/03-case-format-and-generator.md).
 *
 * `generate(caseSpec)` plays a written story against a clean machine and hands back the disk,
 * memory and log evidence it would really have left, plus the trace that says which action left
 * what. It is pure and seeded, like the rest of `src/sim`: no clock, no I/O, no unseeded
 * randomness, so the same case always produces the same bytes.
 */
export { generate, generateEvidence, noiseWindow } from "./generate";
export { EvidencePatternError, requireAcceptedEvidence, resolveAcceptedEvidence } from "./accepted";
export { ACTION_KINDS, ACTIONS, applyAction } from "./actions";
export { BASELINE_IDS, BASELINES, getBaseline } from "./baselines";
export { NOISE_PROFILES, planNoise } from "./noise";
export { freezeDisk } from "./snapshot";
export {
  GenerateError,
  LOGON_TYPES,
  MACHINE_KINDS,
  NOISE_DENSITIES,
  NOISE_PROFILE_IDS,
} from "./types";
export type {
  ActionBase,
  ActionOf,
  Actor,
  CaseSpec,
  EvidenceSelection,
  GenerateResult,
  LogonType,
  MachineKind,
  MachineSpec,
  NoiseDensity,
  NoiseProfileId,
  NoiseSpec,
  StoryAction,
  StoryActionKind,
  TracedArtefact,
  TraceEntry,
} from "./types";
export type { Baseline, BaselineFile, BaselineHomeFile, BaselineProcess } from "./baselines";
export type { NoiseProfile, NoiseWindow } from "./noise";
