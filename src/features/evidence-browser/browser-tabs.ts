import type { ComponentType } from "react";
import type { BrowsedImage, EvidenceSet, SimState } from "@/sim/types";
import { FilesView } from "./components/files-view";
import { ProcessesView } from "./memory/processes-view";

/** What the Evidence Browser, and each of its tabs, gets from the workspace. */
export interface EvidenceBrowserProps {
  /** The workstation's latest engine state: which images are attached, and their blockers. */
  readonly sim: SimState;
  /** The case's evidence, as handed over: the handover form and the drives' display zone. */
  readonly evidence: EvidenceSet;
  /**
   * Opens a disk image through the engine at its workstation path, write-blocker and all.
   * Undefined when nothing is there to open. The browser has no other way to read an image.
   */
  readonly browse: (path: string) => BrowsedImage | undefined;
  /** The artefact refs on the case board. */
  readonly pins: readonly string[];
  readonly onPin: (ref: string) => void;
  readonly onUnpin: (ref: string) => void;
  /** Puts a command at the terminal's prompt, unrun, and brings the terminal into view. */
  readonly showInTerminal: (line: string) => void;
  /**
   * "Explain this" on the selected row (docs/plan/14-mentor.md §Spec). What is sent is the row as
   * this view renders it, with a plain-language `fallback` to show if the mentor is unavailable —
   * never the evidence set. Absent when the mentor isn't wired in, and then no button shows.
   */
  readonly explainRow?: (row: {
    readonly text: string;
    readonly title?: string;
    readonly fallback: string;
  }) => void;
  /**
   * The latest request to show one artefact ("Show in Evidence Browser" on a case board card). A
   * new request has a new `id`. The browser selects it on a drive that's already open, and never
   * opens a drive by itself: opening an original with its blocker off would change it.
   */
  readonly reveal?: { readonly ref: string; readonly id: number };
}

export interface BrowserTab {
  readonly id: string;
  readonly label: string;
  /** Whether this case has anything for the tab to show. */
  readonly available: (evidence: EvidenceSet) => boolean;
  readonly Component: ComponentType<EvidenceBrowserProps>;
}

/**
 * The Evidence Browser's views, in tab order. The browser loads as one chunk when the Evidence
 * pane first opens, so a tab added here arrives with it. Processes (file 08, `./memory/`) shows
 * when the case has a memory image; the tabs only show once there's more than one to choose from.
 */
export const BROWSER_TABS: readonly BrowserTab[] = [
  {
    id: "files",
    label: "Files",
    available: (evidence) => evidence.disks.length > 0,
    Component: FilesView,
  },
  {
    id: "processes",
    label: "Processes",
    available: (evidence) => evidence.memory.length > 0,
    Component: ProcessesView,
  },
];
