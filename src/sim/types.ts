/**
 * Shared simulation types. This is the only part of src/sim that src/content may import, so every
 * type mission content needs (scenario specs, events, errors) is re-exported here. Besides types,
 * it exports only the constant lists of event types and error codes, so content schemas can
 * validate against them (and, for the evidence model, the list of log sources).
 */
export { SIM_EVENT_TYPES } from "./core/events";
export { LOG_SOURCES } from "./evidence/types";
export { FS_ERROR_CODES, SIM_ERROR_CODES } from "./core/errors";
export type { NothingToPinReason } from "./core/errors";
export type {
  ExecCommand,
  FileChange,
  FlagDef,
  Machine,
  OutputLine,
  ScenarioSpec,
  Session,
  SimCommand,
  SimContext,
  SimEvent,
  SimEventType,
  SimResult,
  SimState,
} from "./core/types";
export type {
  BadArgumentReason,
  FsError,
  FsErrorCode,
  FsErrorDetail,
  SimError,
  SimErrorCode,
} from "./core/errors";
export type { Run, ReplayResult, ReplayStep } from "./core/replay";
export type { Rng } from "./core/rng";
export type { Clock } from "./core/clock";
export type {
  Account,
  Accounts,
  DirNode,
  FileNode,
  FsActor,
  FsEntrySpec,
  FsSpec,
  GroupSpec,
  NodeKind,
  StatInfo,
  SymlinkNode,
  UserSpec,
  Vfs,
  VfsNode,
  VfsSnapshot,
} from "./fs/types";
export type {
  DiscoveredHost,
  DiscoveredService,
  DiscoveredTopology,
  DiscoveryState,
  Host,
  HostSpec,
  HttpPage,
  HttpProfile,
  NetworkGraph,
  NetworkInterface,
  NetworkSpec,
  OsFamily,
  OsProfile,
  Protocol,
  Service,
  Subnet,
  TopologyLink,
  TopologyNode,
  TopologyNodeState,
  TopologySubnet,
} from "./net/types";
export type {
  Tool,
  ToolCategory,
  ToolContext,
  ToolHelp,
  ToolRegistry,
  ToolSummary,
} from "./tools/types";
export type {
  ShellAssignment,
  ShellCommand,
  ShellCondition,
  ShellListItem,
  ShellPipeline,
  ShellRedirect,
  ShellSimpleCommand,
  ShellWord,
  ShellWordPart,
} from "./shell/types";
export type { AttachedItem, EvidenceSession, RecalledLine } from "./evidence/session";
export type { BrowsableImage, BrowsedImage } from "./tools/forensics/browse";
export type { DiskView } from "./evidence/disk";
export type { ClusterReuse } from "./tools/forensics/shared";
export type { TimelineEntry, TimelineSource } from "./evidence/timeline";
export type {
  ArtefactRef,
  DiskImage,
  EvidenceSet,
  FileRecord,
  HandoverItem,
  Instant,
  LogRecord,
  LogSource,
  MacbTimes,
  MemoryConnection,
  MemoryImage,
  MemoryModule,
  MemoryProcess,
  MemoryRegion,
  MemoryString,
  ParsedRef,
  Partition,
  ResolvedArtefact,
  ZonedSource,
} from "./evidence/types";
