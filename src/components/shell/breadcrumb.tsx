import Link from "next/link";
import type { AppSection } from "@/lib/app-sections";
import { cx } from "@/lib/cx";
import { FOCUS_RING } from "./shell-styles";

interface BreadcrumbProps {
  /** The section the page is in, or undefined outside every section. */
  section: AppSection | undefined;
  /** The page's own title, for a page inside a section ("The clean copy"). */
  title: string | undefined;
}

/**
 * The top bar's "where am I": `Cases / The clean copy` (UIUX.md G4). On a page inside a section,
 * the section is a link back up to it; on the section's own page, it's the one crumb. The sidebar
 * already highlights the section and the page's H1 names the page, so this is the way back up
 * rather than a third label for the same thing.
 */
export function Breadcrumb({ section, title }: BreadcrumbProps) {
  if (!section) return <div className="min-w-0 flex-1" />;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-2 text-sm sm:text-base">
        {title === undefined ? (
          <li className="truncate font-semibold text-primary" aria-current="page">
            {section.label}
          </li>
        ) : (
          <>
            <li className="shrink-0">
              <Link
                href={section.href}
                className={cx(
                  "rounded-sm text-secondary underline-offset-4 hover:text-primary hover:underline",
                  FOCUS_RING,
                )}
              >
                {section.label}
              </Link>
            </li>
            <li aria-hidden="true" className="shrink-0 text-muted">
              /
            </li>
            <li className="min-w-0 truncate font-semibold text-primary" aria-current="page">
              {title}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
