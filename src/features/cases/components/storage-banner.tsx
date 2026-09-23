import { InfoIcon } from "@/components/ui/icons";
import type { SaveStatus } from "@/lib/case-storage";

/**
 * Says calmly whether the case is being kept (docs/plan/05-workspace-ui.md §Saving case runs).
 * When storage is blocked or full the game plays on, and this banner says it won't be kept. When
 * saving works, one quiet line says where (99 §Voice, "Saving": never promise more).
 */
export function StorageBanner({ status }: { status: SaveStatus }) {
  if (status === "blocked") {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-lg border border-l-4 border-subtle border-l-status-info bg-surface-raised px-4 py-3 text-sm leading-6 text-primary"
      >
        <InfoIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-status-info" />
        <span>
          This browser isn&apos;t letting us save, so this case won&apos;t be kept if you close the
          tab.
        </span>
      </p>
    );
  }
  return (
    <p role="status" className="text-sm text-muted">
      {status === "saved" ? "Saved in this browser only." : ""}
    </p>
  );
}
