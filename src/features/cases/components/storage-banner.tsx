import { InfoIcon } from "@/components/ui/icons";
import type { SaveStatus } from "@/lib/case-storage";
import { cx } from "@/lib/cx";

/**
 * Says calmly whether the case is being kept (docs/plan/05-workspace-ui.md §Saving case runs).
 * When storage is blocked or full the game plays on, and this banner says it won't be kept, on a
 * line of its own. When saving works, one quiet line says where (99 §Voice, "Saving": never
 * promise more), small enough to sit in the workspace's header.
 */
export function StorageBanner({ status, className }: { status: SaveStatus; className?: string }) {
  if (status === "blocked") {
    return (
      <p
        role="status"
        className={cx(
          "flex items-start gap-2 rounded-lg border border-l-4 border-subtle border-l-status-info bg-surface-raised px-4 py-2 type-small text-primary",
          className,
        )}
      >
        <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-status-info" />
        <span>
          This browser isn&apos;t letting us save, so this case won&apos;t be kept if you close the
          tab.
        </span>
      </p>
    );
  }
  return (
    <p role="status" className={cx("type-small text-muted", className)}>
      {status === "saved" ? "Saved in this browser only." : ""}
    </p>
  );
}
