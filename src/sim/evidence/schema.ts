// zod/mini, not zod: the loader runs these in the browser, and full Zod adds about 90 KB that
// can't be tree-shaken (see src/lib/settings/schema.ts). The generator (Node) uses the same file.
import * as z from "zod/mini";
import { base64ByteLength, isBase64 } from "./base64";
import { isArtefactRef, isImageId } from "./refs";
import { isKnownZone } from "./time";
import { LOG_SOURCES, type ArtefactRef } from "./types";

/**
 * Zod schemas for every evidence type (docs/plan/02-evidence-model.md §Evidence set). Objects are
 * strict, so a misspelt key from the generator fails instead of vanishing. Beyond the shapes, the
 * schemas check what keeps refs and tools honest: ids and record numbers are unique, every pid a
 * connection, module, region or string names is a process in the image, file sizes match their
 * content, and every display zone is in the offset table.
 */

const count = () => z.int().check(z.nonnegative());
const instant = () => z.int();
const base64 = () => z.string().check(z.refine(isBase64, "must be padded base64"));
const imageId = () =>
  z
    .string()
    .check(z.refine(isImageId, "must be lowercase letters, digits, dots, dashes or underscores"));
const zoneName = () =>
  z
    .string()
    .check(
      z.refine(isKnownZone, "must be UTC or a zone in the offset table (src/sim/evidence/time.ts)"),
    );

export const LogSourceSchema = z.enum(LOG_SOURCES);

export const ArtefactRefSchema = z.custom<ArtefactRef>(isArtefactRef, "must be an artefact ref");

export const MacbTimesSchema = z.strictObject({
  m: instant(),
  a: instant(),
  c: instant(),
  b: instant(),
});

export const FileRecordSchema = z
  .strictObject({
    record: count(),
    path: z.string().check(z.regex(/^[A-Za-z]:\\/, "must be a Windows path such as C:\\Users")),
    size: count(),
    contentB64: base64(),
    times: MacbTimesSchema,
    deleted: z.boolean(),
    clusters: z.array(count()),
    owner: z.string(),
    kind: z.enum(["file", "dir"]),
  })
  .check(
    z.superRefine((file, ctx) => {
      const length = base64ByteLength(file.contentB64);
      if (file.kind === "file" && length !== file.size) {
        ctx.addIssue({
          code: "custom",
          path: ["size"],
          message: `size ${file.size} doesn't match the ${length} content bytes`,
        });
      }
      if (file.kind === "dir" && length !== 0) {
        ctx.addIssue({
          code: "custom",
          path: ["contentB64"],
          message: "a directory has no content",
        });
      }
    }),
  );

export const PartitionSchema = z.strictObject({
  index: count(),
  label: z.string(),
  fs: z.literal("NTFS-like"),
  startSector: count(),
  sectors: count(),
});

export const DiskImageSchema = z
  .strictObject({
    id: imageId(),
    device: z.strictObject({ model: z.string(), serial: z.string() }),
    sectorSize: z.literal(512),
    sectors: count(),
    partitions: z.array(PartitionSchema),
    records: z.array(FileRecordSchema),
    unallocatedB64: base64(),
    clusterSize: z.int().check(z.positive()),
  })
  .check(
    z.superRefine((disk, ctx) => {
      unique(
        ctx,
        disk.records.map((r) => r.record),
        ["records"],
        "record number",
      );
      unique(
        ctx,
        disk.partitions.map((p) => p.index),
        ["partitions"],
        "partition index",
      );
    }),
  );

const protection = z.enum([
  "PAGE_READONLY",
  "PAGE_READWRITE",
  "PAGE_EXECUTE_READ",
  "PAGE_EXECUTE_READWRITE",
]);

export const MemoryImageSchema = z
  .strictObject({
    id: imageId(),
    capturedAt: instant(),
    host: z.string(),
    processes: z.array(
      z.strictObject({
        pid: count(),
        ppid: count(),
        name: z.string(),
        path: z.string(),
        cmdline: z.string(),
        createdAt: instant(),
        exitedAt: z.optional(instant()),
        user: z.string(),
        threads: count(),
        unlinked: z.optional(z.boolean()),
      }),
    ),
    connections: z.array(
      z.strictObject({
        pid: count(),
        proto: z.enum(["TCPv4", "UDPv4"]),
        local: z.string(),
        remote: z.string(),
        state: z.enum(["ESTABLISHED", "LISTENING", "CLOSE_WAIT", "SYN_SENT"]),
        createdAt: instant(),
      }),
    ),
    modules: z.array(
      z.strictObject({ pid: count(), path: z.string(), base: count(), size: count() }),
    ),
    regions: z.array(
      z.strictObject({
        pid: count(),
        base: count(),
        size: count(),
        protection,
        backedBy: z.optional(z.string()),
        previewB64: base64(),
      }),
    ),
    strings: z.array(
      z.strictObject({ offset: count(), value: z.string(), pid: z.optional(count()) }),
    ),
  })
  .check(
    z.superRefine((image, ctx) => {
      unique(
        ctx,
        image.processes.map((p) => p.pid),
        ["processes"],
        "pid",
      );
      unique(
        ctx,
        image.regions.map((r) => r.base),
        ["regions"],
        "region base",
      );
      const pids = new Set(image.processes.map((p) => p.pid));
      for (const key of ["connections", "modules", "regions", "strings"] as const) {
        image[key].forEach((item: { pid?: number }, i) => {
          if (item.pid !== undefined && !pids.has(item.pid)) {
            ctx.addIssue({
              code: "custom",
              path: [key, i, "pid"],
              message: `pid ${item.pid} isn't a process in this image`,
            });
          }
        });
      }
    }),
  );

export const LogRecordSchema = z.strictObject({
  seq: count(),
  source: LogSourceSchema,
  at: instant(),
  host: z.string(),
  eventId: z.optional(count()),
  fields: z.record(z.string(), z.string()),
});

export const HandoverItemSchema = z.strictObject({
  item: z.string(),
  hashes: z.optional(
    z.strictObject({
      md5: z.string().check(z.regex(/^[0-9a-f]{32}$/)),
      sha256: z.string().check(z.regex(/^[0-9a-f]{64}$/)),
    }),
  ),
  receivedAt: instant(),
  by: z.string(),
});

export const EvidenceSetSchema = z
  .strictObject({
    caseId: z.string(),
    seed: z.int(),
    disks: z.array(DiskImageSchema),
    memory: z.array(MemoryImageSchema),
    logs: z.array(LogRecordSchema),
    zones: z.partialRecord(z.enum([...LOG_SOURCES, "disk"]), zoneName()),
    handover: z.array(HandoverItemSchema),
  })
  .check(
    z.superRefine((set, ctx) => {
      unique(
        ctx,
        set.disks.map((d) => d.id),
        ["disks"],
        "disk id",
      );
      unique(
        ctx,
        set.memory.map((m) => m.id),
        ["memory"],
        "memory image id",
      );
      unique(
        ctx,
        set.logs.map((l) => `${l.source}/${l.seq}`),
        ["logs"],
        "log source and seq",
      );
    }),
  );

function unique(
  ctx: { addIssue(issue: { code: "custom"; path: (string | number)[]; message: string }): void },
  values: readonly (string | number)[],
  path: (string | number)[],
  what: string,
): void {
  const seen = new Set<string | number>();
  values.forEach((value, i) => {
    if (seen.has(value)) {
      ctx.addIssue({ code: "custom", path: [...path, i], message: `duplicate ${what}: ${value}` });
    }
    seen.add(value);
  });
}
