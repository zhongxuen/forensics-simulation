"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { Button } from "./button";
import { CheckIcon, CopyIcon } from "./icons";

export type CopyStatus = "idle" | "copied" | "error";

/** How long "Copied" shows before the button goes back to "Copy". */
const COPIED_MS = 2000;

interface CopyButtonProps {
  /** The text that goes on the clipboard. */
  text: string;
  /** The state to start in. For previews and tests; the button manages it after that. */
  initialStatus?: CopyStatus;
}

/**
 * Copies `text` to the clipboard. Says so for screen readers when it works, and explains what to
 * do instead when the browser won't allow it.
 */
export function CopyButton({ text, initialStatus = "idle" }: CopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>(initialStatus);
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const copy = async () => {
    window.clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      resetTimer.current = window.setTimeout(() => setStatus("idle"), COPIED_MS);
    } catch {
      // No clipboard access: an insecure page, a strict browser setting, or a refused permission.
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <p aria-live="polite" className="text-sm">
        {status === "copied" && <span className="sr-only">Copied to your clipboard.</span>}
        {status === "error" && (
          <span className="text-status-danger">
            Couldn&apos;t copy. Select the text and copy it yourself.
          </span>
        )}
      </p>
      <Button
        size="sm"
        variant="ghost"
        icon={status === "copied" ? <CheckIcon /> : <CopyIcon />}
        onClick={copy}
      >
        {status === "copied" ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

interface CodeBlockProps {
  code: string;
  /** What the code is: "Try this command". Also names the scrollable region. */
  title?: string;
  /** The language or kind of text, shown as a small label: "shell", "log". */
  language?: string;
  /** Adds a Copy button. */
  copyable?: boolean;
  /** The Copy button's starting state. For previews and tests. */
  initialCopyStatus?: CopyStatus;
  className?: string;
}

/**
 * Monospace text that should be read or typed exactly: a command, a config file, a log excerpt.
 * Scrolls sideways instead of wrapping, and the scroll area can be focused so keyboard users can
 * scroll it too.
 */
export function CodeBlock({
  code,
  title,
  language,
  copyable = false,
  initialCopyStatus,
  className,
}: CodeBlockProps) {
  const hasHeader = title !== undefined || language !== undefined || copyable;

  return (
    <div className={cx("rounded-lg border border-subtle bg-surface-raised", className)}>
      {hasHeader && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-subtle py-1.5 pr-1.5 pl-4">
          {title !== undefined && (
            <span className="text-sm font-medium text-secondary">{title}</span>
          )}
          {language !== undefined && (
            <span className="font-mono text-xs text-muted">{language}</span>
          )}
          {copyable && (
            <div className="ml-auto">
              <CopyButton text={code} initialStatus={initialCopyStatus} />
            </div>
          )}
        </div>
      )}
      <pre
        tabIndex={0}
        aria-label={title ?? (language !== undefined ? `${language} code` : "Code")}
        // The ring is drawn inside, so the rounded border around it doesn't cover it.
        className={cx(
          "overflow-x-auto px-4 py-3 font-mono text-sm leading-6 text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
          hasHeader ? "rounded-b-lg" : "rounded-lg",
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
