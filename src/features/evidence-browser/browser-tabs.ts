import type { ComponentType } from "react";
import type { BrowsedImage, EvidenceSet, SimState } from "@/sim/types";
import { FilesView } from "./components/files-view";

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
 * pane first opens, so a tab added here arrives with it. File 08 adds a Processes tab from
 * `./memory/` with one line; the tabs only show once there's more than one to choose from.
 */
export const BROWSER_TABS: readonly BrowserTab[] = [
  {
    id: "files",
    label: "Files",
    available: (evidence) => evidence.disks.length > 0,
    Component: FilesView,
  },
];
