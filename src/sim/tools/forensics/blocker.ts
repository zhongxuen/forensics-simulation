/**
 * blocker: turns a piece of evidence's write-blocker on or off, and shows which are on.
 *
 * A write-blocker sits between a drive and the computer and lets reads through while stopping
 * writes. Without one, plugging a drive in is enough to change it: the operating system opens
 * files to index and preview them, and every file it opens gets a new access time. This command
 * is the simulated version of that switch (docs/plan/04-disk-tools.md §How evidence reaches the
 * terminal).
 */
import { columns, failure, stdout } from "../../core/output";
import type { OutputLine, SimResult, SimState } from "../../core/types";
import { imageAt, setBlocker, type AttachedItem } from "../../evidence/session";
import { compareNames } from "../../fs/tree";
import { parseArgs } from "../args";
import type { Tool } from "../types";
import { banner, delivered, requireEvidence } from "./shared";

const NAME = "blocker";

export const blocker: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner: "switch a piece of evidence's write-blocker on or off, and see which are on.",
    usage: ["blocker", "blocker on <device>", "blocker off <device>"],
    description: [
      "Evidence arrives on this workstation as a device under /dev/evidence, one per drive you were handed. A write-blocker sits in front of each one: the workstation can read the drive through it, but nothing can write to the drive.",
      "That matters more than it sounds. Plugging a drive into an ordinary computer changes it: the operating system opens files while it lists folders and makes previews, and every file it opens gets a new access time. Those times are evidence too.",
      "Run blocker on its own to see every attached device and whether its blocker is on. They all start on, which is how evidence is meant to arrive.",
    ],
    options: [
      { flags: "on <device>", text: "Put the write-blocker back in front of that device." },
      {
        flags: "off <device>",
        text: "Take the write-blocker away, so reading the drive changes it. Reset machine puts it back.",
      },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      { command: "blocker", text: "See every device and whether its write-blocker is on." },
      {
        command: "blocker off /dev/evidence/qf-lt-07",
        text: "Take the write-blocker away, and watch what reading the drive does to it.",
      },
      {
        command: "blocker on /dev/evidence/qf-lt-07",
        text: "Put it back before you read anything else.",
      },
    ],
    concept: [
      "The first rule of handling digital evidence is that examining it must not change it. A hardware write-blocker is how that rule is kept for a drive: it passes read commands through and refuses write commands, so the drive you hand back is the drive you were given.",
      "The second rule is that you can prove it. You take a hash of the drive before and after, and if the two match, nothing changed. Turn the blocker off here and the hash moves, which is exactly how a real examiner would find out.",
    ],
    realWorld: [
      "Hardware write-blockers such as the Tableau and WiebeTech ranges, which sit between the drive and the examiner's machine.",
      "FTK Imager's read-only attach, and mounting a disk image read-only on Linux (mount -o ro,noload) or with a software blocker.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, []);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [action, device, extra] = parsed.value.positionals;
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "device", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const session = requireEvidence(state);
    if (!session.ok) return failure(NAME, session.error, state);

    if (action === undefined) return listDevices(state);
    if (action !== "on" && action !== "off") {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "action", value: action, reason: "unknown-value" },
        state,
      );
    }
    if (device === undefined) {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "device" }, state);
    }

    const item = Object.values(session.value.attached).find(
      (attached) => attached.path === device || attached.id === device,
    );
    if (!item) return failure(NAME, { code: "NOT_EVIDENCE", name: device }, state);

    const on = action === "on";
    const next = setBlocker(state, item.id, on);
    const output: OutputLine[] = [
      banner(NAME, `write-blocker ${on ? "ON" : "OFF"} for ${item.path}`),
      stdout(""),
      ...(on
        ? [
            stdout("Reads of this drive go through the blocker again. Nothing you do from here"),
            stdout("can change it."),
          ]
        : [
            stdout("This workstation can now write to the original drive. Reading a file on it"),
            stdout("will set a new access time on that file, and the drive's hash will move with"),
            stdout("it. That change lasts for the rest of this run."),
            stdout(""),
            stdout(`Put it back with: blocker on ${item.path}`),
          ]),
    ];
    return delivered(next, `${NAME} ${action} ${device}`, output);
  },
};

/** Every attached device, what it is, and whether its write-blocker is on. */
function listDevices(state: SimState): SimResult {
  const session = state.evidence;
  const items: readonly AttachedItem[] = session
    ? [...Object.values(session.attached)].sort((x, y) => compareNames(x.id, y.id))
    : [];
  const output: OutputLine[] = [banner(NAME, "write-blockers on this workstation"), stdout("")];

  if (items.length === 0) {
    output.push(stdout("  (no evidence is attached to this workstation)"));
  } else {
    const rows = items.map((item) => {
      const image = session ? imageAt(session, item.path) : undefined;
      const what = image
        ? `${image.device.model}, serial ${image.device.serial}`
        : "attached evidence";
      return [item.path, item.blocker ? "on" : "off", what];
    });
    const table = columns([["DEVICE", "BLOCKER", "WHAT IT IS"], ...rows]);
    output.push(...table.map((line) => stdout(`  ${line}`)));
  }
  output.push(
    stdout(""),
    stdout("A write-blocker lets this computer read a drive but never write to it, so"),
    stdout("examining the evidence cannot change it. Leave them on."),
  );
  return delivered(state, NAME, output);
}
