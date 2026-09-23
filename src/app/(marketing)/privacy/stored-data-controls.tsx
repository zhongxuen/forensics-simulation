"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DownloadIcon } from "@/components/ui/icons";
import type { CaseStorage } from "@/lib/case-storage";

interface StoredDataControlsProps {
  /** Where runs are saved. The browser's, unless a test passes its own. */
  storage?: CaseStorage;
}

/**
 * The storage modules, and the schemas they bring (all of `zod/mini`), load when a button is
 * pressed: this page is otherwise text, and they'd more than double its script.
 */
async function loadStores(storage: CaseStorage | undefined) {
  const [cases, settings] = await Promise.all([
    storage ?? import("@/lib/case-storage").then((module) => module.caseStorage),
    import("@/lib/settings"),
  ]);
  return { cases, resetSettings: settings.resetSettings };
}

/**
 * Clear everything, Export my cases and Import, for /privacy. Import validates the file with the
 * same schema as storage and never runs anything: a case replays its log only when it's opened.
 */
export function StoredDataControls({ storage }: StoredDataControlsProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const fileId = useId();

  const clearEverything = async () => {
    setConfirmClear(false);
    const { cases, resetSettings } = await loadStores(storage);
    const casesCleared = cases.clear();
    const settingsCleared = resetSettings();
    setMessage(
      casesCleared && settingsCleared
        ? "Everything is cleared. Your cases and settings are back to new."
        : "Some of it couldn't be cleared. This browser isn't letting this page change its site data. Clear this site's data in your browser's settings instead.",
    );
  };

  const exportCases = async () => {
    const { cases } = await loadStores(storage);
    const blob = new Blob([cases.exportText()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "incident-room-cases.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Your cases are saved as incident-room-cases.json.");
  };

  const importCases = async (file: File | undefined) => {
    if (!file) return;
    const { cases } = await loadStores(storage);
    const result = cases.importText(await file.text());
    if (fileRef.current) fileRef.current.value = "";
    setMessage(
      result.ok
        ? `Imported ${result.imported === 1 ? "1 case" : `${result.imported} cases`}. Open a case to pick it up where it was left.`
        : result.reason,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" icon={<DownloadIcon />} onClick={() => void exportCases()}>
          Export my cases
        </Button>
        <label htmlFor={fileId} className="sr-only">
          Import cases from a file
        </label>
        <input
          ref={fileRef}
          id={fileId}
          type="file"
          accept="application/json,.json"
          tabIndex={-1}
          className="sr-only"
          onChange={(event) => void importCases(event.target.files?.[0])}
        />
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          Import
        </Button>
        <Button variant="danger" onClick={() => setConfirmClear(true)}>
          Clear everything
        </Button>
      </div>

      <p role="status" className="leading-7 text-secondary">
        {message}
      </p>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear everything?"
        description="Every saved case and all your settings in this browser will be deleted. Export your cases first if you want to keep them."
        size="sm"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Keep everything
            </Button>
            <Button variant="danger" onClick={() => void clearEverything()}>
              Clear everything
            </Button>
          </>
        }
      />
    </div>
  );
}
