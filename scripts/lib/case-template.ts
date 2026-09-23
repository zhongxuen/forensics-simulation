/**
 * The starting files `pnpm case:new <id>` writes: a case that already validates, builds its
 * evidence and plays to the end, with every piece of copy marked TODO for the author to replace,
 * and the playthrough that finishes it.
 *
 * Pure string building, so `tests/content/case-toolkit.test.ts` can prove the template still
 * validates and still plays without writing anything to disk. The story is deliberately the
 * smallest one worth having — somebody signs in, writes a file, and somebody else deletes it that
 * night — because it is the shape most cases start from, and it exercises the disk, the logs and
 * the report in one go.
 */

/** A seed from the id, so two new cases don't start with the same background activity. */
export function seedFor(id: string): number {
  let hash = 2166136261;
  for (const char of id) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/** The machine a new case starts with. Rename it once the case has a shape. */
const MACHINE = "qf-lt-09";
const FILE_PATH = "C:\\Users\\mara\\Documents\\note-0514.txt";
const DELETED_AT = "2026-05-14T22:14:35Z";

export function caseTemplate(id: string): string {
  return `# ${id}: a new case. Replace every TODO, then run \`pnpm case:validate ${id}\` and
# \`pnpm case:play ${id}\`. The format is described in src/content/cases/README.md, and the
# authoring checklist is in docs/plan/99-reference.md.
#
# Write the story first. Everything else — the objectives, the report, the debrief — is checked
# against it, and the evidence is generated from it by \`pnpm evidence:build\`. Nobody writes
# evidence by hand.
id: ${id}
version: 1
title: "TODO: the case's name, in sentence case"
client:
  org: Quillfen Freight
  signedBy: "TODO: who signed the letter, with their job"
  letter: |
    TODO: the letter the client signed, in their words. It says which machine may be examined
    and which may not. The player reads this first, on the workstation, before anything is
    touched (docs/plan/99-reference.md, rule 1).
estimatedMinutes: 20
seed: ${seedFor(id)}
hook: "TODO: one line that makes a complete beginner want to open this case"
learningGoals:
  - "TODO: what the player will learn, in plain words"
  - "TODO: a second thing they'll learn"
concepts: [] # lesson ids for every idea this case needs
briefing:
  scenario: >-
    TODO: what happened, and who asked for help. Re-introduce the cast in a line: "Noor
    Halvorsen, your mentor at Candlewright Security, ..."
  role: >-
    TODO: who the player is in this case, and which workstation they're working from.
  authorization: >-
    TODO: who signed, and exactly what may be examined. Nothing outside it is touched.

machines:
  - id: ${MACHINE} # TODO: rename to the machine this case is really about
    kind: windows-laptop
    baseline: office-laptop-v1
    zone: Europe/London
    ip: 10.60.0.29
    accounts: [mara]
  - id: ir-ws-01
    kind: linux-workstation
    baseline: analyst-workstation-v1
    zone: Europe/London

# The ground truth: who did what, on which machine, at which instant. Times always carry a zone.
story:
  - at: "2026-05-14T08:05:00Z"
    actor: user:mara
    on: ${MACHINE}
    do: logon
    with: { account: mara, type: interactive }

  - id: file-written
    at: "2026-05-14T08:20:00Z"
    actor: user:mara
    on: ${MACHINE}
    do: create-file
    path: '${FILE_PATH}'
    content: |
      TODO: what is in the file this case is about.

  - at: "2026-05-14T17:00:00Z"
    actor: user:mara
    on: ${MACHINE}
    do: logoff
    with: { account: mara }

  - at: "2026-05-14T22:10:00Z"
    actor: attacker
    on: ${MACHINE}
    do: logon
    with: { account: mara, type: remote, from: 10.60.0.27 }

  - id: file-deleted
    at: "${DELETED_AT}"
    actor: attacker
    on: ${MACHINE}
    do: delete-file
    path: '${FILE_PATH}'

  - at: "2026-05-14T22:16:00Z"
    actor: attacker
    on: ${MACHINE}
    do: logoff
    with: { account: mara }

  - at: "2026-05-15T09:30:00Z"
    actor: analyst
    on: ir-ws-01
    do: hand-over
    with:
      item: ${MACHINE}
      by: "TODO: who handed the machine over"

noise: { profile: office-day, density: low }

evidence:
  disks: [${MACHINE}]
  logs: [security, sysmon-lite]
  memory: []

beats:
  - on: start
    speaker: mentor-noor
    text: "TODO: the first line of the case, from a character."
  - on: complete
    speaker: mentor-noor
    text: "TODO: a closing line that names what the player worked out."

objectives:
  - id: read-the-letter
    description: Read the client's letter and say what is in scope.
    why: Every case starts with somebody asking, in writing, and saying what may be examined.
    success: You know what you may look at, and what you may not.
    check:
      kind: commandRun
      pattern: "^\\\\s*cat\\\\b"
  - id: find-the-file
    description: Find the deleted file on a copy of the disk, and pin it to the board.
    why: A finding that isn't on the board is a memory, and the report can't point at a memory.
    success: The record is on the board, with your note about why it matters.
    check:
      kind: all
      of:
        - { kind: commandRun, pattern: "^\\\\s*lsfs\\\\b" }
        - { kind: pinned, evidence: "disk:${MACHINE}:mft/*note-0514*" }
  - id: answer-the-report
    description: Answer the report's question about when the file was deleted.
    why: A finding nobody can check is not a finding. The time comes from the evidence.
    success: Your answer points at the record that shows it.
    check:
      kind: reported
      question: when-deleted

hints:
  read-the-letter:
    - The case starts with a letter from the client. It is in your case folder, waiting to be read.
    - Every file on the workstation can be read from the terminal.
    - "Use \`cat\` and the name of the letter."
  find-the-file:
    - An examiner never works on the drive itself. Copy it first, then ask the copy.
    - Deleting a file leaves its record behind, and one command lists only those records.
    - "Copy the drive with \`acquire\`, list what was deleted with \`lsfs -d\`, then \`pin\` the record."
  answer-the-report:
    - The report asks when, not what. Something in the evidence says exactly when.
    - Deleting a file is recorded, and the record carries the time it happened.
    - Answer with the time on the record that shows the file being deleted.

report:
  questions:
    - id: when-deleted
      ask: "TODO: the question, as the player reads it."
      type: timestamp
      answer: "${DELETED_AT}"
      toleranceSeconds: 60
      answerFrom: file-deleted
      acceptedEvidence:
        - "disk:${MACHINE}:mft/*note-0514*"
      explain: >-
        TODO: what this answer means, without giving the next one away.

debrief:
  summary: "TODO: what the player worked out, in one or two sentences."
  whatYouLearned:
    - "TODO: the first learning goal, in the past tense"
    - "TODO: the second learning goal, in the past tense"
  ethicsNote: >-
    TODO: what this would mean in the real world, who it would affect, and what makes it right
    here. The machine belongs to the client, and the client asked. An account name is not a
    finding about a person.
  defensiveTakeaway: "TODO: what the client should change so this can't happen again."
  nextTease: "TODO: a one-line hook for the next case."
  furtherReading: []
`;
}

export function playthroughTemplate(id: string): string {
  return `# The scripted run \`pnpm case:play ${id}\` and CI use to check ${id} still finishes.
#
# Steps: run: <command>, pin: <evidence pattern>, report: <question id> with answer: <text>,
# answer: <text> with objective: <id>, or reset: true. Add ticks: [ids] to say what a step should
# tick, and the run fails if it doesn't.
case: ${id}
description: "TODO: what this playthrough shows."
steps:
  - run: cat letter.txt
    ticks: [read-the-letter]
  - run: acquire /dev/evidence/${MACHINE} --out images/${MACHINE}.img
  - run: lsfs images/${MACHINE}.img -r -d
  - run: 'pin -m "TODO — why this record matters"'
    ticks: [find-the-file]
  - report: when-deleted
    answer: "${DELETED_AT}"
    verdict: supported
    ticks: [answer-the-report]
expect:
  complete: true
  objectives: [read-the-letter, find-the-file, answer-the-report]
  supported: true
`;
}
