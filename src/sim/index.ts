/**
 * The simulation engine's public API. Code outside src/sim imports from "@/sim" (runtime) or
 * "@/sim/types" (types only), never from the folders inside.
 */
export * from "./types";

export { step } from "./core/step";
export { createInitialState, DEFAULT_START_TIME, scenarioStartMs } from "./core/scenario";
export { ScenarioError } from "./core/scenario-error";
export { createRng, deriveSeed, normalizeSeed, seedFromString } from "./core/rng";
// formatInstant comes from the evidence model: the same output with no options, plus zoned display.
export { fixedClock, parseInstant, steppingClock } from "./core/clock";
export { exitCodeFor, formatError, isFsError, isUsageError } from "./core/errors";
export { deepFreeze } from "./core/freeze";
export {
  inspectPath,
  userCanAccess,
  type FileAccess,
  type InspectOptions,
  type PathInspection,
} from "./core/inspect";
export { formatArgv } from "./core/output";
export {
  deserializeState,
  serializeState,
  STATE_FORMAT,
  STATE_VERSION,
  type SnapshotError,
} from "./core/serialize";
export {
  appendCommand,
  createRun,
  deserializeRun,
  replay,
  scenarioClock,
  serializeRun,
  RUN_FORMAT,
  RUN_VERSION,
  type ReplayOptions,
  type ScenarioLookup,
} from "./core/replay";
export { renderTranscript } from "./core/transcript";
export { stableStringify } from "./core/stable-json";

export { BUILTIN_TOOLS, defaultRegistry, SECURITY_TOOLS } from "./tools";
export { FORENSICS_TOOLS } from "./tools/forensics";
// The Evidence Browser opens images through the disk tools' own calls (docs/plan/05 §Evidence Browser).
export {
  browsableImages,
  browseImage,
  BROWSER_TOOL,
  type BrowsableImage,
  type BrowsedImage,
} from "./tools/forensics/browse";
export { clusterReuse, clusterRanges, type ClusterReuse } from "./tools/forensics/shared";
// The Timeline view (docs/plan/09-timeline.md §The view) shows times the way the tool prints them.
export { sourceZone, timelineTime } from "./tools/forensics/timeline";
export { LINUX_COMMANDS } from "./tools/commands";
export { commandGroups } from "./tools/commands/help";
export { listTools } from "./tools/catalog";
export { createRegistry } from "./tools/registry";
export { renderHelp, renderManPage, REAL_WORLD_HEADING, SIMULATED_NOTICE } from "./tools/help";
export { TOOL_CATEGORIES, TOOL_CATEGORY_LABELS } from "./tools/types";

export { MAX_HISTORY, MAX_OUTPUT_LINES } from "./shell/run";
export {
  closestMatches,
  completeCommandName,
  completePath,
  editDistance,
  suggestNextCommands,
  suggestPath,
} from "./shell/complete";
export { checkShellCommand } from "./shell/validate";
export { CLEAR_SCREEN, stripAnsi } from "./core/ansi";

export * as vfs from "./fs/ops";
export { formatMode, formatOctal, parseOctalMode } from "./fs/mode";
export { MAX_SYMLINK_DEPTH, resolvePath } from "./fs/resolve";

export { canReach, hostById, reachableHosts, resolveHostname, servicesOn } from "./net/graph";
export { discoveredHost, hostMapState, isDiscovered, selectTopology } from "./net/discovery";

// The evidence model (docs/plan/02-evidence-model.md). Its types come through "./types" above.
// The fluent test builder is a namespace, like `vfs` above, because `disk`, `memory` and
// `evidence` are far too common a set of words to take from the top level: `build.disk("x")`.
export * as build from "./evidence/builder";
// The evidence generator (docs/plan/03-case-format-and-generator.md): story -> evidence.
export {
  ACTION_KINDS,
  BASELINE_IDS,
  BASELINES,
  EvidencePatternError,
  generate,
  GenerateError,
  generateEvidence,
  getBaseline,
  LOGON_TYPES,
  MACHINE_KINDS,
  NOISE_DENSITIES,
  NOISE_PROFILE_IDS,
  NOISE_PROFILES,
  requireAcceptedEvidence,
  resolveAcceptedEvidence,
  type Actor,
  type Baseline,
  type CaseSpec,
  type EvidenceSelection,
  type GenerateResult,
  type LogonType,
  type MachineKind,
  type MachineSpec,
  type NoiseDensity,
  type NoiseProfileId,
  type NoiseSpec,
  type StoryAction,
  type StoryActionKind,
  type TracedArtefact,
  type TraceEntry,
} from "./evidence";

export {
  ArtefactRefSchema,
  attachEvidence,
  base64ByteLength,
  baseName,
  ByteWriter,
  decodeBase64,
  deviceAt,
  devicePlacard,
  DiskImageSchema,
  encodeBase64,
  evidenceSession,
  EVIDENCE_ROOT,
  EvidenceSetSchema,
  FileRecordSchema,
  formatInstant,
  formatOffset,
  formatRef,
  HandoverItemSchema,
  HASH_ALGORITHMS,
  hashHex,
  IMAGE_FORMAT_MAGIC,
  imageAt,
  imageBytes,
  imageHash,
  isArtefactRef,
  isBase64,
  isEvidencePath,
  isHashAlgorithm,
  isImageId,
  isKnownZone,
  isLogSource,
  KNOWN_EVENT_IDS,
  LogRecordSchema,
  LogSourceSchema,
  MacbTimesSchema,
  md5,
  MemoryImageSchema,
  mountRead,
  mountWrite,
  parentPath,
  parseRef,
  PartitionSchema,
  pathsForImage,
  readOriginal,
  rememberOutput,
  renderLog,
  resolveRef,
  setBlocker,
  SECURITY_EVENTS,
  sha1,
  sha256,
  SYSMON_LITE_EVENTS,
  toHex,
  utf8Bytes,
  withAcquiredImage,
  UTC_ZONE,
  ZONE_TABLE,
  zonedParts,
  zoneOffsetMinutes,
  zonePeriodAt,
  type AttachedItem,
  type AttachOptions,
  type DiskView,
  type EventInfo,
  type EvidenceSession,
  type FormatInstantOptions,
  type HashAlgorithm,
  type MountWriteOptions,
  type OriginalRead,
  type RecalledLine,
  type RenderLogOptions,
  type ZoneEntry,
  type ZonedParts,
  type ZonePeriod,
} from "./evidence";
// The super-timeline (docs/plan/09-timeline.md): the `timeline` tool and the Timeline view.
export {
  buildTimeline,
  compareEntries,
  CONNECTION,
  isMacbKind,
  macbKind,
  PROCESS_START,
  TIMELINE_SOURCES,
} from "./evidence";
