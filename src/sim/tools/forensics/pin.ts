/**
 * pin: puts a line of evidence on the case board.
 *
 * Every forensics tool sets an artefact ref on the lines that show a piece of evidence
 * (`OutputLine.ref`, docs/plan/02-evidence-model.md §Artefact refs). `pin` reads the last of those
 * outputs back and turns one line into a `board.pinned` event. The board itself is built from
 * those events (file 10), so nothing about the board is stored in the engine.
 */
import { failure, stdout } from "../../core/output";
import type { OutputLine, SimEvent } from "../../core/types";
import type { RecalledLine } from "../../evidence/session";
import { optionValue, parseArgs } from "../args";
import type { Tool } from "../types";
import { banner, requireEvidence } from "./shared";

const NAME = "pin";

/** Longer than a note wants to be: a pin points at evidence, it doesn't hold the report. */
const MAX_NOTE = 200;

export const pin: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner: "put a line of evidence on the case board, with a note about why it matters.",
    usage: ["pin", "pin <line>", 'pin <line> -m "why this matters"'],
    description: [
      "The case board is where the findings of an investigation collect. Pinning a line puts the piece of evidence that line shows on the board, so the report can point back at it.",
      "Run pin on its own and it takes the last line of the last evidence tool's output that names something. Give it a line number and it takes that line instead.",
      "-m adds your note: what you think this shows, in your own words. The evidence and the note stay together, which is what turns a screenful of output into a finding.",
      "Lines that name nothing, such as headings and totals, cannot be pinned. A pin has to point at a file, a record, a process or a log entry, or a report built on it has nothing underneath.",
    ],
    options: [
      { flags: "-m, --message <note>", text: "Your note about why this line matters." },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      { command: "pin", text: "Pin the last line that named a piece of evidence." },
      {
        command: 'pin 4 -m "the invoice the office says went missing"',
        text: "Pin line 4 of the last output, with a note.",
      },
    ],
    concept: [
      "A report is only as good as what it points at. Saying a file was deleted at half past seven is a claim; saying it is record 51 on the drive from qf-lt-07, with the times to match, is evidence someone else can check.",
      "That is why every finding here carries a ref, a short string naming exactly one piece of evidence. Two examiners with the same image and the same ref see the same thing, which is the whole point.",
      "It also keeps you honest as you go. Pinning as you find things, with a note about why, means the report writes itself from evidence rather than from memory of what you thought an hour ago.",
    ],
    realWorld: [
      "Autopsy's tags and bookmarks, and its Interesting Items and Reports panels.",
      "The notes and bookmark features in X-Ways Forensics and EnCase.",
      "In everyday practice: the running notes file and the exhibit list that end up as the report's appendix.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, [
      { names: ["-m", "--message"], key: "message", takesValue: true },
    ]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [wanted, extra] = parsed.value.positionals;
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "line", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const note = optionValue(parsed.value, "message");
    if (note !== undefined && note.length > MAX_NOTE) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "--message", value: note, reason: "too-long" },
        state,
      );
    }
    const session = requireEvidence(state);
    if (!session.ok) return failure(NAME, session.error, state);

    const lines = session.value.lastOutput;
    const pinnable = lines.flatMap((line, index) => (line.ref ? [index + 1] : []));
    if (lines.length === 0) {
      return failure(NAME, { code: "NOTHING_TO_PIN", reason: "no-output" }, state);
    }

    let number: number;
    if (wanted === undefined) {
      const last = pinnable[pinnable.length - 1];
      if (last === undefined) {
        return failure(NAME, { code: "NOTHING_TO_PIN", reason: "no-ref" }, state);
      }
      number = last;
    } else {
      if (!/^\d{1,4}$/.test(wanted) || Number(wanted) < 1 || Number(wanted) > lines.length) {
        return failure(
          NAME,
          { code: "BAD_ARGUMENT", argument: "line", value: wanted, reason: "out-of-range" },
          state,
        );
      }
      number = Number(wanted);
    }

    const line = lines[number - 1] as RecalledLine;
    if (!line.ref) {
      return failure(NAME, { code: "NOTHING_TO_PIN", reason: "no-ref", line: number }, state);
    }

    const event: SimEvent = {
      type: "board.pinned",
      ref: line.ref,
      line: line.text.trim(),
      ...(note === undefined ? {} : { note }),
    };
    const output: OutputLine[] = [
      banner(NAME, "pinned to the case board"),
      stdout(""),
      { stream: "stdout", text: `  ${line.ref}`, ref: line.ref },
      stdout(`  from  ${session.value.lastCommand}, line ${number}`),
      stdout(`        ${line.text.trim()}`),
      ...(note === undefined ? [] : [stdout(`  note  ${note}`)]),
      stdout(""),
      ...(pinnable.length > 1
        ? [
            stdout(
              `Other lines you can pin from that output: ${pinnable.filter((n) => n !== number).join(", ")}.`,
            ),
          ]
        : []),
      stdout("The board keeps the ref, so your report can point at this exact record."),
    ];
    // `pin` deliberately leaves the remembered output alone, so pinning a second line from the
    // same output works.
    return { state, output, events: [event], exitCode: 0 };
  },
};
