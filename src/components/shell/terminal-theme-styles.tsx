import { terminalThemeCss } from "@/lib/terminal-themes";

/**
 * The terminal colour themes as CSS: one `[data-terminal-theme="…"]` rule per theme, built from
 * src/content/themes. Render it once in the root layout. The learner's choice is the attribute on
 * <html> (set before first paint by SettingsBootScript); a theme preview puts it on its own box.
 *
 * Inserted as raw CSS, because React escapes the quotes in plain text children. It's safe: every
 * value is a validated theme id or a 6-digit hex colour (src/content/schemas/theme.ts).
 */
export function TerminalThemeStyles() {
  return <style dangerouslySetInnerHTML={{ __html: terminalThemeCss() }} />;
}
