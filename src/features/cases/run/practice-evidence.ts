import { build } from "@/sim";
import type { EvidenceSet } from "@/sim/types";

/**
 * The practice case's evidence, made with the evidence builder (src/sim/evidence/builder.ts)
 * instead of the generator, until file 03's fixture case merges. Small on purpose: one disk with a
 * deleted file, a few log records and the handover form. It's only ever loaded with a dynamic
 * `import()` (run/evidence.ts), so it's never in a page's first download. The laptop's clock
 * showed UK time, so the Evidence Browser's local-time toggle has a zone to show.
 */
export const PRACTICE_EVIDENCE: EvidenceSet = build
  .evidence("practice", { host: "qf-lt-03" })
  .disk(
    build
      .disk("qf-lt-03", { model: "QX-128 solid-state drive", serial: "QX-0000-0303" })
      .file("C:\\Users\\yard\\Documents\\rota.txt", {
        content: "Mon: early shift loads bay 2\nTue: pallet count\n",
        at: "2026-04-09T15:10:00Z",
        owner: "yard",
      })
      .file("C:\\Users\\yard\\Documents\\fuel-log.csv", {
        content: "date,vehicle,litres\n2026-04-10,QF-TRK-2,180\n",
        at: "2026-04-10T16:42:00Z",
        owner: "yard",
      })
      .file("C:\\Users\\yard\\Downloads\\invoice-viewer.exe", {
        content: "MZ\u0090\u0000practice",
        at: "2026-04-11T19:40:31Z",
        owner: "yard",
        deleted: true,
      }),
  )
  .log(
    "security",
    "2026-04-11T07:58:00Z",
    { TargetUserName: "yard", LogonType: "2" },
    { eventId: 4624 },
  )
  .log(
    "security",
    "2026-04-11T19:39:55Z",
    { TargetUserName: "yard", LogonType: "10", IpAddress: "203.0.113.24" },
    { eventId: 4624 },
  )
  .log("security", "2026-04-11T19:52:10Z", { TargetUserName: "yard" }, { eventId: 4634 })
  .zone("disk", "Europe/London")
  .handover("qf-lt-03", { hashes: true, receivedAt: "2026-04-12T09:00:00Z" })
  .build();
