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
export { LINUX_COMMANDS } from "./tools/commands";
export { commandGroups } from "./tools/commands/help";
export { listTools } from "./tools/catalog";
export { createRegistry } from "./tools/registry";
export { renderHelp, renderManPage, SIMULATED_NOTICE } from "./tools/help";
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
export {
  ArtefactRefSchema,
  base64ByteLength,
  baseName,
  decodeBase64,
  DiskImageSchema,
  encodeBase64,
  EvidenceSetSchema,
  FileRecordSchema,
  formatInstant,
  formatOffset,
  formatRef,
  HandoverItemSchema,
  isArtefactRef,
  isBase64,
  isImageId,
  isKnownZone,
  isLogSource,
  KNOWN_EVENT_IDS,
  LogRecordSchema,
  LogSourceSchema,
  MacbTimesSchema,
  MemoryImageSchema,
  mountRead,
  mountWrite,
  parentPath,
  parseRef,
  PartitionSchema,
  renderLog,
  resolveRef,
  SECURITY_EVENTS,
  SYSMON_LITE_EVENTS,
  UTC_ZONE,
  ZONE_TABLE,
  zonedParts,
  zoneOffsetMinutes,
  zonePeriodAt,
  type DiskView,
  type EventInfo,
  type FormatInstantOptions,
  type MountWriteOptions,
  type RenderLogOptions,
  type ZoneEntry,
  type ZonedParts,
  type ZonePeriod,
} from "./evidence";
