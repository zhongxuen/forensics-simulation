"use client";

import { ErrorState } from "@/components/shell/error-state";

/** A page inside the app broke: the shell (sidebar, top bar, the SIMULATED marker) stays. */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState error={error} retry={retry} area="app" />;
}
