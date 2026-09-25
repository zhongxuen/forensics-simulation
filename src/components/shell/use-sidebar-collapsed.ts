"use client";

import { createContext, useContext } from "react";
import { updateSettings, useSettings } from "@/lib/settings";

type SidebarCollapsed = readonly [boolean, (collapsed: boolean) => void];

function setSidebarCollapsed(collapsed: boolean) {
  updateSettings({ sidebarCollapsed: collapsed });
}

/**
 * The sidebar state the app shell decides for the page, when it isn't the saved setting: inside a
 * case run the sidebar starts collapsed to the rail, and toggling it there lasts until you leave
 * the case, without touching the saved setting.
 */
export const SidebarViewContext = createContext<SidebarCollapsed | null>(null);

/**
 * Whether the desktop sidebar is collapsed to an icon rail: the `sidebarCollapsed` setting
 * (src/lib/settings), unless the app shell overrides it for the page (SidebarViewContext).
 *
 * CSS reads the <html> `data-sidebar` attribute, which the settings module keeps in step
 * (SettingsBootScript sets it before first paint), and the shell's `data-sidebar-view` for an
 * override (the `rail:` variant in src/styles/globals.css), so the layout itself never waits for
 * React. The server render says "expanded"; right after hydration React re-renders with the saved
 * value, which only updates labels and ARIA state.
 */
export function useSidebarCollapsed(): SidebarCollapsed {
  const override = useContext(SidebarViewContext);
  const saved = useSettings().sidebarCollapsed;
  return override ?? [saved, setSidebarCollapsed];
}
