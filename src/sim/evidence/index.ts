/**
 * The evidence model's public surface. Tools inside src/sim import from here; code outside src/sim
 * goes through "@/sim" and "@/sim/types", which re-export it.
 */
export * from "./types";
export { decodeBase64, encodeBase64, base64ByteLength, isBase64 } from "./base64";
export { ByteWriter, utf8Bytes } from "./bytes";
export {
  hashHex,
  isHashAlgorithm,
  md5,
  sha1,
  sha256,
  toHex,
  HASH_ALGORITHMS,
  type HashAlgorithm,
} from "./hash";
export { imageBytes, imageHash, IMAGE_FORMAT_MAGIC } from "./image";
// The fluent test builder keeps its own namespace: `build.disk("x")`, `build.evidence("case-01")`.
export * as build from "./builder";
export {
  formatInstant,
  formatOffset,
  isKnownZone,
  UTC_ZONE,
  ZONE_TABLE,
  zonedParts,
  zoneOffsetMinutes,
  zonePeriodAt,
  type FormatInstantOptions,
  type ZoneEntry,
  type ZonedParts,
  type ZonePeriod,
} from "./time";
export { formatRef, isArtefactRef, isImageId, isLogSource, parseRef, resolveRef } from "./refs";
export {
  baseName,
  mountRead,
  mountWrite,
  parentPath,
  type DiskView,
  type MountWriteOptions,
} from "./disk";
export {
  KNOWN_EVENT_IDS,
  renderLog,
  SECURITY_EVENTS,
  SYSMON_LITE_EVENTS,
  type EventInfo,
  type RenderLogOptions,
} from "./logs";
export {
  ArtefactRefSchema,
  DiskImageSchema,
  EvidenceSetSchema,
  FileRecordSchema,
  HandoverItemSchema,
  LogRecordSchema,
  LogSourceSchema,
  MacbTimesSchema,
  MemoryImageSchema,
  PartitionSchema,
} from "./schema";
