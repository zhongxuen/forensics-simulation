import type { Metadata } from "next";
import Link from "next/link";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";
import { StoredDataControls } from "./stored-data-controls";

export const metadata: Metadata = { title: "What we store – Candlewright: Incident Room" };

const LINK = cx("rounded-sm text-accent underline underline-offset-4", FOCUS_RING);
const KEY = "font-mono text-base text-primary";

/**
 * "What we store" (docs/plan/00-overview.md §7 and 05 §Saving case runs): the two keys, what's in
 * each, what leaves the browser, and the buttons to export, import and clear it all.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:py-16">
      <p className="type-eyebrow">Privacy</p>
      <h1 className="mt-2 type-page-title">What we store</h1>
      <p className="mt-4 text-lg leading-8 text-secondary">
        Two things, both saved in this browser only. There are no accounts, no cookies and no
        database.
      </p>

      <section aria-labelledby="stored-settings" className="mt-10">
        <h2 id="stored-settings" className="type-section-title text-primary">
          Your settings
        </h2>
        <p className="mt-3 type-body text-secondary">
          Under <code className={KEY}>incident-room:settings</code>: things like light or dark,
          beginner mode, your terminal&apos;s colours and how much moves on screen. Change them in{" "}
          <Link href="/settings" className={LINK}>
            Settings
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="stored-cases" className="mt-10">
        <h2 id="stored-cases" className="type-section-title text-primary">
          Your cases
        </h2>
        <p className="mt-3 type-body text-secondary">
          Under <code className={KEY}>incident-room:cases:v1</code>: for each case you&apos;ve
          opened, the commands you typed and the drives you opened in the Evidence Browser (so the
          case can be rebuilt when you come back), the findings you pinned, your notes, your report
          draft, and which objectives you&apos;ve ticked and hints you&apos;ve seen. A case takes
          half an hour or so, so it&apos;s kept if you close the tab. If your browser blocks saving,
          the case still plays, and isn&apos;t kept.
        </p>
      </section>

      <section aria-labelledby="stored-leaves" className="mt-10">
        <h2 id="stored-leaves" className="type-section-title text-primary">
          What leaves your browser
        </h2>
        <div className="mt-3 space-y-4 type-body text-secondary">
          <p>
            Nothing you type, with one exception: when you ask the mentor something, your question
            and what the mentor needs to answer it are sent to get you an answer.
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
      </section>

      <section aria-labelledby="stored-controls" className="mt-10">
        <h2 id="stored-controls" className="type-section-title text-primary">
          Take it with you, or clear it
        </h2>
        <p className="mt-3 mb-6 type-body text-secondary">
          Export your cases to a file to move them to another browser, then import that file there.
          An import is checked before it&apos;s kept, and nothing in it runs until you open the
          case.
        </p>
        <StoredDataControls />
      </section>
    </main>
  );
}
