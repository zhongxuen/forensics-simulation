import { WORKSTATION } from "@/content/sandbox/workstation";
import type { FsEntrySpec } from "@/sim/types";
import type { RunnableCase } from "./case-definition";

/**
 * A short practice case, playable with the workstation's own commands (`ls`, `cat`, `grep`),
 * until file 03's case format and file 04's disk tools merge. It exercises the whole runner:
 * a briefing, objectives that tick from engine events, hints, story lines, and a save. Its
 * evidence comes from the evidence builder (practice-evidence.ts), loaded only when the Evidence
 * pane opens.
 *
 * Names are from the story world (docs/plan/99-reference.md): Quillfen Freight's yard office
 * laptop `qf-lt-03`, Theo, Noor and Kit. Quillfen's owner never speaks and isn't named.
 */

const CASE_DIR = "/home/examiner/cases/practice";

const LETTER = `Candlewright Security, letter of engagement

Client:   Quillfen Freight, a family haulage yard (quillfen.example)
Signed:   the owner of Quillfen Freight
Counter-signed: Theo Ashgrove, team lead, Candlewright Security

We ask Candlewright Security to examine one computer: the yard office
laptop, qf-lt-03, handed over on 12 April 2026.

You may examine: the laptop's disk, and the office logs we send with it.
You may not examine: staff members' own phones, or any computer that
isn't ours.

The laptop has been acting strangely since the weekend. Please tell us
what happened, and what we should fix.
`;

const HANDOVER = `Evidence handover form
Item:      qf-lt-03 (yard office laptop)
Received:  2026-04-12 09:00 UTC
From:      Quillfen Freight office
Sealed bag: QF-0412
Condition: powered off, lid closed, charger included
`;

const NOTES = `# Kit's scratch notes. You found them!
Always read the letter before touching anything.
The seal number on the bag has to match the form.
`;

const PRACTICE_FILES: readonly FsEntrySpec[] = [
  { path: `${CASE_DIR}/letter.txt`, content: LETTER },
  { path: `${CASE_DIR}/handover.txt`, content: HANDOVER },
  { path: `${CASE_DIR}/.kit-notes.txt`, content: NOTES },
];

const host = WORKSTATION.scenario.network.hosts[0];
if (!host) throw new Error("practice case: the workstation scenario has no host");

export const PRACTICE_CASE: RunnableCase = {
  id: "practice",
  slug: "practice",
  title: "Practice: the first morning",
  hook: "A laptop has arrived in a sealed bag. Before anyone opens it, you check the paperwork.",
  estimatedMinutes: 5,
  client: {
    org: "Quillfen Freight",
    signedBy: "the owner of Quillfen Freight",
    scope:
      "The yard office laptop, qf-lt-03, and the office logs sent with it. Nothing else: not staff phones, not anyone else's computers.",
  },
  briefing: {
    opening: [
      {
        speaker: "teammate-theo",
        text: "Morning! Quillfen Freight's laptop came in overnight. Before anything else, read what they signed.",
      },
      {
        speaker: "mentor-noor",
        text: "The letter is in your case folder. If it isn't in the letter, we don't touch it.",
      },
    ],
    situation:
      "Quillfen Freight, a small family haulage yard, says their yard office laptop has been acting strangely since the weekend. They've sent it to Candlewright in a sealed bag, with a handover form. Your first job is the paperwork: what may you examine, and did the bag arrive as it left?",
  },
  objectives: [
    {
      id: "read-letter",
      description: "Read the signed letter: `letter.txt` in `cases/practice`.",
      why: "The letter says what you may examine. Everything else is off limits, however tempting.",
      success: "You read the letter: the laptop and its logs are in scope, staff phones aren't.",
      hints: [
        "The letter is a text file in your case folder. Which command shows what's inside a file?",
        "Go to the folder with `cd cases/practice`, then print the file there.",
        "Type `cat cases/practice/letter.txt` and press Enter.",
      ],
      check: {
        kind: "event",
        event: "file.read",
        match: { path: `${CASE_DIR}/letter.txt` },
      },
    },
    {
      id: "find-seal",
      description: "Find the seal number in `handover.txt` by searching for the word `Sealed`.",
      why: "The seal number on the bag must match the form. If it doesn't, someone may have opened it on the way.",
      success: "You found seal QF-0412 on the form. It matches the bag on your desk.",
      hints: [
        "You don't need to read the whole form: there's a command that prints only the lines containing a word.",
        "`grep` prints the lines of a file that contain the word you give it.",
        "Type `grep Sealed cases/practice/handover.txt` and press Enter.",
      ],
      check: { kind: "commandRun", pattern: "^grep\\s.*Sealed.*handover\\.txt" },
    },
    {
      id: "hidden-notes",
      name: "Kit's secret stash",
      optional: true,
      description: "Find the hidden file in the case folder, and read it.",
      why: "Files whose names start with a dot don't show in a plain listing. Examiners always look for them.",
      success: "You found Kit's hidden notes. Everyone hides something in a dot file.",
      hints: [
        "A plain listing leaves some files out. Is there an option that shows everything?",
        "`ls -a` shows files whose names start with a dot.",
        "Type `ls -a cases/practice` to see its name, then `cat` it.",
      ],
      check: { kind: "event", event: "file.read", match: { path: `${CASE_DIR}/.kit-notes.txt` } },
    },
  ],
  story: [
    {
      on: "start",
      speaker: "teammate-kit",
      text: "Hi, I'm Kit, analyst. Shout if you get stuck. I got stuck on this exact form last week.",
    },
    {
      on: { objective: "read-letter" },
      speaker: "mentor-noor",
      text: "Good. Now you know the edges of the job. Next, check the bag arrived as it left.",
    },
    {
      on: "complete",
      speaker: "teammate-theo",
      text: "Letter read, seal checked. That's the habit that keeps our findings trusted. Nice work.",
    },
  ],
  defensiveTakeaway:
    "Keep a written list of what each examination may cover, and seal and log every device you hand over. It's what lets a court, or a client, trust what the examiners find.",
  seed: WORKSTATION.seed,
  scenario: {
    ...WORKSTATION.scenario,
    id: "case-practice",
    network: {
      ...WORKSTATION.scenario.network,
      hosts: [{ ...host, fs: { entries: [...(host.fs?.entries ?? []), ...PRACTICE_FILES] } }],
    },
  },
};
