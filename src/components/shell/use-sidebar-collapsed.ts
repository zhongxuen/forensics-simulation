import { updateSettings, useSettings } from "@/lib/settings";

function setSidebarCollapsed(collapsed: boolean) {
  updateSettings({ sidebarCollapsed: collapsed });
}

/**
 * Whether the desktop sidebar is collapsed to an icon rail: the `sidebarCollapsed` setting
 * (src/lib/settings).
 *
 * CSS reads the <html> `data-sidebar` attribute, which the settings module keeps in step
 * (SettingsBootScript sets it before first paint), so the layout itself never waits for React.
 * The server render says "expanded"; right after hydration React re-renders with the saved value,
 * which only updates labels and ARIA state.
 */
export function useSidebarCollapsed(): readonly [boolean, (collapsed: boolean) => void] {
  return [useSettings().sidebarCollapsed, setSidebarCollapsed];
}
