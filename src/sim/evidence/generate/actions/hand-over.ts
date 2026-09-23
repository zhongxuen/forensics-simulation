import { hashHex } from "../../hash";
import { imageBytes } from "../../image";
import type { ActionOf } from "../types";
import { type ActionContext } from "../world";
import { freezeDisk } from "../snapshot";

/**
 * Evidence changes hands, and somebody signs for it. The form says what was handed over, when, and
 * by whom — and for a disk, the two hashes taken at that moment.
 *
 * Those hashes are the promise the rest of the case rests on: any later reading of the evidence
 * has to leave them unchanged, or it was not a copy, it was a change. The generator holds the
 * story to the same rule, and refuses to build a case whose disk is touched after its form is
 * signed.
 */
export function applyHandOver(ctx: ActionContext, action: ActionOf<"hand-over">): void {
  const item = action.item ?? ctx.machine.id;
  const disk = ctx.world.disks.get(item);
  const wantsHashes = action.hashes ?? disk !== undefined;

  if (wantsHashes && !disk) {
    ctx.fail(
      `there is no disk image called "${item}" to take hashes of. Hand over a machine with a disk, or set hashes: false.`,
    );
  }

  const hashes = disk
    ? (() => {
        const bytes = imageBytes(freezeDisk(disk));
        return { md5: hashHex("md5", bytes), sha256: hashHex("sha256", bytes) };
      })()
    : undefined;
  if (disk && hashes) ctx.world.handoverHashes.set(item, hashes.sha256);

  ctx.world.handover.push({
    item,
    ...(wantsHashes && hashes ? { hashes } : {}),
    receivedAt: ctx.at,
    by: action.by,
  });
}
