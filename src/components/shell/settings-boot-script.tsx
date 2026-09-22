import { SETTINGS_BOOT_SCRIPT } from "@/lib/settings/boot-script";

/**
 * Applies the saved settings (sidebar collapsed, motion) to <html> before first paint, so the
 * page never flashes the wrong layout. Render it once, at the top of <body> in the root layout:
 * the root layout is always server-rendered, so the script runs from the HTML (React never runs
 * scripts it renders itself).
 */
export function SettingsBootScript() {
  return <script dangerouslySetInnerHTML={{ __html: SETTINGS_BOOT_SCRIPT }} />;
}
