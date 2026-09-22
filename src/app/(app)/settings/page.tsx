import type { Metadata } from "next";
import Link from "next/link";
import { SettingsForm } from "@/components/settings/settings-form";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { TerminalLookSettings } from "@/features/terminal";
import { getAppSection } from "@/lib/app-sections";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: getAppSection("settings").label };

export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Make the app work your way
      </h1>
      <p className="mt-4 text-lg leading-8 text-secondary">
        Changes apply straight away. Your settings are saved in this browser only.{" "}
        <Link
          href="/privacy"
          className={cx("rounded-sm text-accent underline underline-offset-4", FOCUS_RING)}
        >
          See what we store
        </Link>
      </p>
      <div className="mt-8">
        <SettingsForm>
          <TerminalLookSettings />
        </SettingsForm>
      </div>
    </div>
  );
}
