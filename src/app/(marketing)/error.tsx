"use client";

import { ErrorState } from "@/components/shell/error-state";

/** The landing page or "What we store" broke: the footer stays. */
export default function SiteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex w-full flex-1 flex-col justify-center px-6 py-16">
      <ErrorState error={error} retry={retry} area="site" />
    </main>
  );
}
