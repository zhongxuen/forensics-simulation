"use client";

import { ErrorState } from "@/components/shell/error-state";
import "@/styles/globals.css";

/**
 * The last line: the root layout itself broke, so this replaces the whole document (Next.js
 * global-error). It brings its own <html>, <body> and styles, and says the same calm thing as
 * every other error screen.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en" className="h-full bg-surface-base text-primary antialiased">
      <body className="flex min-h-full flex-col px-6 py-16 font-sans">
        <title>Something went wrong – Candlewright: Incident Room</title>
        <main className="flex flex-1 flex-col justify-center">
          <ErrorState error={error} retry={retry} area="page" />
        </main>
      </body>
    </html>
  );
}
