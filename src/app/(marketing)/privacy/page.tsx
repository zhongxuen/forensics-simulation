import type { Metadata } from "next";
import Link from "next/link";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "What we store – Candlewright: Incident Room" };

const LINK = cx("rounded-sm text-accent underline underline-offset-4", FOCUS_RING);

/**
 * "What we store" (placeholder). It says what is true today: settings only. File 05 adds saved
 * case runs and the "Clear everything" button (docs/plan/00-overview.md §7), and updates this page
 * in the same change.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        What we store
      </h1>
      <div className="mt-6 space-y-4 text-lg leading-8 text-secondary">
        <p>
          Right now, only your settings: things like beginner mode and how much moves on screen.
          They&apos;re saved in this browser only, under one name,{" "}
          <code className="font-mono text-base text-primary">incident-room:settings</code>, and
          never leave your device.
        </p>
        <p>
          There are no accounts, no cookies and no database. Nothing you type in the terminal is
          saved or sent anywhere.
        </p>
        <p>
          If you allow it, we count anonymous events like &ldquo;a page was opened&rdquo;, never
          anything you type and nothing that says who you are. You can turn that off in{" "}
          <Link href="/settings" className={LINK}>
            Settings
          </Link>
          , and it&apos;s off whenever your browser asks sites not to track it.
        </p>
      </div>
    </main>
  );
}
