"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Every keyboard shortcut the prompt understands, in plain words. */
export const TERMINAL_SHORTCUTS: readonly { keys: string; does: string }[] = [
  { keys: "Enter", does: "Run the command" },
  { keys: "↑ / ↓", does: "Bring back earlier commands" },
  { keys: "Tab", does: "Finish a command or file name (press it again to list the choices)" },
  { keys: "→ at the end", does: "Accept the faint suggestion" },
  { keys: "Ctrl+R", does: "Search earlier commands as you type" },
  { keys: "Ctrl+A / Ctrl+E", does: "Jump to the start / end of the line" },
  { keys: "Ctrl+U / Ctrl+K", does: "Delete everything before / after the cursor" },
  { keys: "Ctrl+L", does: "Clear the screen" },
  { keys: "Ctrl+C", does: "Abandon the line you're typing (copies instead, if text is selected)" },
  { keys: "Esc, then Tab", does: "Leave the prompt without completing" },
  { keys: "Shift+Tab", does: "Move to the output, to scroll back through it" },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="The same keys a real Linux terminal uses."
      actions={
        <Button variant="primary" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <table className="w-full text-left text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">Keys</th>
            <th scope="col">What they do</th>
          </tr>
        </thead>
        <tbody>
          {TERMINAL_SHORTCUTS.map((shortcut) => (
            <tr key={shortcut.keys} className="border-b border-subtle last:border-0">
              <th
                scope="row"
                className="py-2 pr-4 align-top font-mono font-normal whitespace-nowrap text-primary"
              >
                {shortcut.keys}
              </th>
              <td className="py-2 text-secondary">{shortcut.does}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
