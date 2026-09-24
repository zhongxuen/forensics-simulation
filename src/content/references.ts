/**
 * What the Learning Center points at outside its own lessons (docs/plan/13-learning-center.md):
 *
 * - CITATIONS: the primary sources lessons cite in their `cites` frontmatter. Every lesson cites at
 *   least one. Each entry names the exact section, checked against the document itself before it
 *   went in (the `checked` date), never written from memory.
 * - EXTERNAL_LESSONS: Hacker Simulation's gentler lessons, which lessons here link to as "Start here
 *   if this is new" through `externalPrerequisites` instead of repeating them.
 * - findDeadReferences: cross-reference checking over the whole catalog (vendored from
 *   ../hacker-simulation/src/content/references.ts, with citations added). Dead links are the
 *   standard failure mode of a docs system, so CI catches them rather than a reader.
 *
 * Data and pure functions only: the test that runs the check decides where each catalog comes from.
 */

// ---------------------------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------------------------

export interface Citation {
  /** Stable id used in lesson frontmatter: `rfc-3227-s2-1`. */
  readonly id: string;
  /** The document's short name, as people cite it: "NIST SP 800-86", "RFC 3227". */
  readonly source: string;
  /** The document's full title. */
  readonly title: string;
  /** Who published it, and when. */
  readonly publisher: string;
  readonly year: number;
  /** The part being cited, exactly as the document numbers and names it. */
  readonly section: string;
  /** What that part says that the lesson relies on, in one plain sentence. */
  readonly supports: string;
  /** Where to read it, free of charge where it can be; for a book, the publisher's page. */
  readonly url: string;
  /** When the section number and wording were checked against the document (YYYY-MM-DD). */
  readonly checked: string;
}

const SP_800_86 = {
  source: "NIST SP 800-86",
  title: "Guide to Integrating Forensic Techniques into Incident Response",
  publisher: "National Institute of Standards and Technology",
  year: 2006,
  url: "https://doi.org/10.6028/NIST.SP.800-86",
} as const;

const FSFA = {
  source: "Carrier",
  title: "File System Forensic Analysis",
  publisher: "Brian Carrier, Addison-Wesley Professional",
  year: 2005,
  url: "https://www.informit.com/store/file-system-forensic-analysis-9780321268174",
} as const;

export const CITATIONS: readonly Citation[] = [
  {
    id: "nist-sp-800-86-s3",
    ...SP_800_86,
    section: "§3, Performing the Forensic Process",
    supports:
      "Forensics follows four phases, collection, examination, analysis and reporting, and the integrity of the data is protected throughout.",
    checked: "2026-09-23",
  },
  {
    id: "nist-sp-800-86-s3-1-2",
    ...SP_800_86,
    section: "§3.1.2, Acquiring the Data",
    supports:
      "Acquire the data, verify its integrity by comparing message digests of the original and the copy, and keep a chain of custody: who had the evidence, what they did and when.",
    checked: "2026-09-23",
  },
  {
    id: "nist-sp-800-86-s4-2-2",
    ...SP_800_86,
    section: "§4.2.2, Data File Integrity",
    supports:
      "A write-blocker stops the examiner's computer writing to the original, and a message digest of the original and the copy proves they match.",
    checked: "2026-09-23",
  },
  {
    id: "nist-sp-800-86-s5-2-1-3",
    ...SP_800_86,
    section: "§5.2.1.3, Prioritizing Data Collection",
    supports:
      "Volatile data changes over time, so collect it in order, starting with network connections and login sessions, before the computer is powered down.",
    checked: "2026-09-23",
  },
  {
    id: "rfc-3227-s2-1",
    source: "RFC 3227",
    title: "Guidelines for Evidence Collection and Archiving",
    publisher: "Internet Engineering Task Force",
    year: 2002,
    section: "§2.1, Order of Volatility",
    supports:
      "Collect evidence from the most volatile to the least: registers and cache, then memory and the process table, then temporary file systems, then disk, then remote logs, then archives.",
    url: "https://www.rfc-editor.org/rfc/rfc3227#section-2.1",
    checked: "2026-09-23",
  },
  {
    id: "rfc-3227-s2-2",
    source: "RFC 3227",
    title: "Guidelines for Evidence Collection and Archiving",
    publisher: "Internet Engineering Task Force",
    year: 2002,
    section: "§2.2, Things to avoid",
    supports:
      "Don't shut down until evidence collection is complete, and don't trust the programs on the system being examined.",
    url: "https://www.rfc-editor.org/rfc/rfc3227#section-2.2",
    checked: "2026-09-23",
  },
  {
    id: "nist-ir-8387-s3-2",
    source: "NIST IR 8387",
    title: "Digital Evidence Preservation: Considerations for Evidence Handlers",
    publisher: "National Institute of Standards and Technology",
    year: 2022,
    section: "§3.2, Digital Image and File Storage Considerations (items 1 and 9)",
    supports:
      "Document where each image came from and how it was made, hash it as close to collection as possible, and store the hashes separately from the image.",
    url: "https://doi.org/10.6028/NIST.IR.8387",
    checked: "2026-09-23",
  },
  {
    id: "fips-180-4",
    source: "FIPS 180-4",
    title: "Secure Hash Standard (SHS)",
    publisher: "National Institute of Standards and Technology",
    year: 2015,
    section: "§1, Introduction, and §6.2, SHA-256",
    supports:
      "SHA-256 turns a message of any length into a 256-bit message digest, and any change to the message will, with a very high probability, give a different digest.",
    url: "https://doi.org/10.6028/NIST.FIPS.180-4",
    checked: "2026-09-23",
  },
  {
    id: "rfc-1321-s1",
    source: "RFC 1321",
    title: "The MD5 Message-Digest Algorithm",
    publisher: "Internet Engineering Task Force",
    year: 1992,
    section: "§1, Executive Summary",
    supports: "MD5 turns a message of any length into a 128-bit fingerprint, or message digest.",
    url: "https://www.rfc-editor.org/rfc/rfc1321#section-1",
    checked: "2026-09-23",
  },
  {
    id: "rfc-6151-s2-1",
    source: "RFC 6151",
    title: "Updated Security Considerations for the MD5 Message-Digest and the HMAC-MD5 Algorithms",
    publisher: "Internet Engineering Task Force",
    year: 2011,
    section: "§2.1, Collision Resistance",
    supports:
      "MD5 collisions can be found in about a minute on a laptop, so MD5 is no longer acceptable where collision resistance is required.",
    url: "https://www.rfc-editor.org/rfc/rfc6151#section-2.1",
    checked: "2026-09-23",
  },
  // The Disk track. Carrier's book isn't free to read; the publisher's page lists its contents,
  // which is where the chapter and section names below were checked.
  {
    id: "carrier-fsfa-ch5",
    ...FSFA,
    section: "Chapter 5, PC-based Partitions (DOS Partitions; Analysis Considerations)",
    supports:
      "A PC drive is divided into partitions by a table near its start that gives where each one begins and how long it is, and an examiner checks the space no partition claims.",
    checked: "2026-09-24",
  },
  {
    id: "carrier-fsfa-ch8",
    ...FSFA,
    section: "Chapter 8, File System Analysis (Content Category; Metadata Category)",
    supports:
      "A file system's data falls into categories, content in data units and metadata about each file, and deleting a file leaves both behind until the space is allocated to something else.",
    checked: "2026-09-24",
  },
  {
    id: "carrier-fsfa-ch11",
    ...FSFA,
    section: "Chapter 11, NTFS Concepts (Everything is a File; MFT Concepts)",
    supports:
      "In NTFS every file and folder has an entry in the Master File Table, and the file system's own bookkeeping is stored as files too.",
    checked: "2026-09-24",
  },
  {
    id: "carrier-fsfa-ch13",
    ...FSFA,
    section: "Chapter 13, NTFS Data Structures (Standard File Attributes)",
    supports:
      "Each file's $STANDARD_INFORMATION attribute holds four times: when it was created, when its content was last modified, when its MFT entry was last modified, and when it was last accessed.",
    checked: "2026-09-24",
  },
  {
    id: "ms-learn-file-times",
    source: "Microsoft Learn",
    title: "File Times",
    publisher: "Microsoft",
    year: 2018,
    section: "The whole page, which has no numbered sections",
    supports:
      "NTFS stores file times in UTC, may delay updating a file's last-access time by up to an hour, and SetFileTime can change a file's times without changing its content.",
    url: "https://learn.microsoft.com/en-us/windows/win32/sysinfo/file-times",
    checked: "2026-09-24",
  },
  {
    id: "garfinkel-2007-carving",
    source: "Garfinkel",
    title: "Carving contiguous and fragmented files with fast object validation",
    publisher: "Digital Investigation 4S, pp. S2–S12 (Elsevier), from the 2007 DFRWS conference",
    year: 2007,
    section: "§1, Introduction; §3.2, Fragmentation distribution; §5.1.1, Header/footer carving",
    supports:
      "Carving rebuilds files from their content instead of the metadata that points to it; 6% of the files recovered from the study's drives were fragmented; and header/footer carving cuts out everything between a start marker and an end marker.",
    url: "https://hdl.handle.net/10945/38489",
    checked: "2026-09-24",
  },
];

const CITATIONS_BY_ID: ReadonlyMap<string, Citation> = new Map(
  CITATIONS.map((citation) => [citation.id, citation]),
);

/** The citation with this id, or undefined. */
export function getCitation(id: string): Citation | undefined {
  return CITATIONS_BY_ID.get(id);
}

// ---------------------------------------------------------------------------------------------
// Hacker Simulation's lessons, linked as prerequisites
// ---------------------------------------------------------------------------------------------

/** Where Hacker Simulation's Learning Center lives. */
export const HACKER_SIMULATION_LEARN_URL = "https://hacker-simulation.vercel.app/learn";

export interface ExternalLesson {
  /** The lesson's id on Hacker Simulation, which is also its address there. */
  readonly id: string;
  /** Its title there, copied exactly. */
  readonly title: string;
}

/** The six gentler lessons docs/plan/13-learning-center.md lists, with their titles there. */
export const EXTERNAL_LESSONS = [
  { id: "forensics-what-logs-are", title: "What a log really is" },
  { id: "forensics-timelines", title: "Putting events in order" },
  { id: "forensics-evidence-care", title: "Don't change what you're looking at" },
  { id: "blue-incident-response", title: "What to do when something goes wrong" },
  { id: "blue-reading-alerts", title: "Telling real warnings from noise" },
  { id: "crypto-hashing", title: "Hashing: a fingerprint for data" },
] as const satisfies readonly ExternalLesson[];

export type ExternalLessonId = (typeof EXTERNAL_LESSONS)[number]["id"];

export const EXTERNAL_LESSON_IDS = EXTERNAL_LESSONS.map((lesson) => lesson.id) as [
  ExternalLessonId,
  ...ExternalLessonId[],
];

/** The Hacker Simulation lesson with this id, or undefined. */
export function getExternalLesson(id: string): ExternalLesson | undefined {
  return EXTERNAL_LESSONS.find((lesson) => lesson.id === id);
}

/** The lesson's address on Hacker Simulation. */
export function externalLessonUrl(id: ExternalLessonId): string {
  return `${HACKER_SIMULATION_LEARN_URL}/${id}`;
}

// ---------------------------------------------------------------------------------------------
// Dead references
// ---------------------------------------------------------------------------------------------

export interface LessonReferences {
  readonly id: string;
  readonly prerequisites: readonly string[];
  readonly relatedMissions: readonly string[];
  readonly relatedCommands: readonly string[];
  readonly glossaryTerms: readonly string[];
  /** Citation ids from the lesson's `cites`. */
  readonly cites?: readonly string[];
  /** Glossary ids used by <Term id="…"> in the lesson's body. */
  readonly termsInBody?: readonly string[];
  /** Mission ids used by <TryIt mission="…"> in the lesson's body. */
  readonly missionsInBody?: readonly string[];
}

export interface GlossaryReferences {
  readonly id: string;
  readonly relatedTerms: readonly string[];
  readonly relatedLessons: readonly string[];
}

export interface MissionReferences {
  readonly id: string;
  /** Lesson ids the mission teaches or relies on. */
  readonly concepts: readonly string[];
}

export interface ContentCatalog {
  readonly lessons: readonly LessonReferences[];
  readonly glossary: readonly GlossaryReferences[];
  readonly missions: readonly MissionReferences[];
  /** Every command a learner can type: the engine's tools plus the terminal's own commands. */
  readonly commands: readonly string[];
  /** Every citation id. Leave out to check against CITATIONS. */
  readonly citations?: readonly string[];
}

export type ReferenceKind = "lesson" | "mission" | "command" | "glossary term" | "citation";

export interface DeadReference {
  /** Where the reference is written: `lesson foundations-chain-of-custody`, `glossary hash`. */
  readonly source: string;
  /** The field holding it: `prerequisites`, `relatedTerms`, `<Term> in body`, `cites`. */
  readonly field: string;
  readonly kind: ReferenceKind;
  /** The id that doesn't resolve. */
  readonly target: string;
}

/** Every reference in `catalog` that points at nothing, in catalog order. */
export function findDeadReferences(catalog: ContentCatalog): DeadReference[] {
  const known: Readonly<Record<ReferenceKind, ReadonlySet<string>>> = {
    lesson: new Set(catalog.lessons.map((lesson) => lesson.id)),
    mission: new Set(catalog.missions.map((mission) => mission.id)),
    command: new Set(catalog.commands),
    "glossary term": new Set(catalog.glossary.map((entry) => entry.id)),
    citation: new Set(catalog.citations ?? CITATIONS.map((citation) => citation.id)),
  };

  const dead: DeadReference[] = [];
  const check = (
    source: string,
    field: string,
    kind: ReferenceKind,
    targets: readonly string[],
  ) => {
    for (const target of targets) {
      if (!known[kind].has(target)) dead.push({ source, field, kind, target });
    }
  };

  for (const lesson of catalog.lessons) {
    const source = `lesson ${lesson.id}`;
    check(source, "prerequisites", "lesson", lesson.prerequisites);
    check(source, "relatedMissions", "mission", lesson.relatedMissions);
    check(source, "relatedCommands", "command", lesson.relatedCommands);
    check(source, "glossaryTerms", "glossary term", lesson.glossaryTerms);
    check(source, "cites", "citation", lesson.cites ?? []);
    check(source, "<Term> in body", "glossary term", [...new Set(lesson.termsInBody ?? [])]);
    check(source, "<TryIt> in body", "mission", [...new Set(lesson.missionsInBody ?? [])]);
  }
  for (const entry of catalog.glossary) {
    const source = `glossary ${entry.id}`;
    check(source, "relatedTerms", "glossary term", entry.relatedTerms);
    check(source, "relatedLessons", "lesson", entry.relatedLessons);
  }
  for (const mission of catalog.missions) {
    check(`mission ${mission.id}`, "concepts", "lesson", mission.concepts);
  }

  return dead;
}

/** One line a content author can act on. */
export function describeDeadReference(reference: DeadReference): string {
  return `${reference.source} → ${reference.field}: no ${reference.kind} with id "${reference.target}"`;
}
