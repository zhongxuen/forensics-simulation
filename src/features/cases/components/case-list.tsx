import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";
import type { CaseListing } from "../run/catalog";

/**
 * The case list on /cases: every case, playable or not, in order. Every case page opens, so a
 * case still being written says so on its own page rather than hiding here.
 */
export function CaseList({ listings }: { listings: readonly CaseListing[] }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2">
      {listings.map((listing) => (
        <li key={listing.slug}>
          <Link
            href={`/cases/${listing.slug}`}
            className={cx(
              "block h-full rounded-xl border border-subtle bg-surface-raised p-5 hover:border-accent",
              FOCUS_RING,
            )}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-primary">{listing.title}</span>
              {!listing.caseDef && <Badge tone="neutral">Coming in a later update</Badge>}
            </span>
            <span className="mt-2 block leading-7 text-secondary">{listing.summary}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
