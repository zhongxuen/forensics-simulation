# src/components/shell

The app shell that every page in `src/app/(app)` renders inside: the sidebar ("Start here" button, section links, "What we store" link, collapse toggle), the mobile menu drawer, the top bar (section title, mission-progress slot, SIMULATED marker, search button), the command palette (⌘K / Ctrl+K), and the main content region with its skip link. Also `SectionPlaceholder` for pages that aren't built yet.

- Section names, routes, subtitles and search keywords come from `src/lib/app-sections.ts`; the "Start here" destination from `src/lib/next-step.ts`.
- The mission-progress slot is empty until a mission page renders `ShowMissionProgress` (phase 06).
- `leave-guard.tsx` — while a page renders `<LeaveGuard when>` (a mission run in progress), clicks on links to other pages and command-palette navigation ask "Leave this mission?" first, and the browser's own leave-page prompt guards reloads and closing the tab. Same-page links are never interrupted. There are no accounts, XP or levels, so the top bar has no profile or score.
- The command palette's shortcut ignores key presses that something else already handled (`event.defaultPrevented`), so a focused terminal can keep Ctrl+K for itself. With something typed, it also searches lessons, glossary words and command manual pages: the index is a static file built with the app (`/search-index.json`), loaded by `useSearchIndex` the first time the palette opens and searched with `searchIndex` from `src/lib/search.ts`.
- `terminal-theme-styles.tsx` — `TerminalThemeStyles`, rendered once in the root layout: one CSS rule per terminal colour theme (`src/lib/terminal-themes.ts`), switched by `data-terminal-theme` on `<html>`.
- The sidebar's collapsed state is the `sidebarCollapsed` setting (`src/lib/settings`), read through `useSidebarCollapsed`. `SettingsBootScript` (rendered in the root layout) applies saved settings to `<html>` before first paint. Style the collapsed rail with the `rail:` variant from `src/styles/globals.css`.
- The bottom of the sidebar links to "What we store" (`/privacy`), so it's one click from every app page.
- `error-state.tsx` — `ErrorState`, what every error screen shows (`src/app/(app)/error.tsx`, `(marketing)/error.tsx`, `global-error.tsx`): "Something went wrong on our end, not yours", what it means for a mission in progress, Try again, and two ways on. It counts that an error screen was shown, with the error's digest only (phase 11).
- `usage-analytics.tsx` — `UsageAnalytics`, in the root layout: after hydration, and only on a Vercel deployment, it lazily loads `usage-analytics-scripts.tsx` (Vercel Web Analytics and Speed Insights), which loads nothing under Do Not Track, Global Privacy Control, or with the `usageCounts` setting off (`md-files/metrics.md`).
- `loading-practice-computer.tsx` — the moment's placeholder a terminal page shows when it's opened from a link inside the app, while the terminal's code arrives.
- Built from `src/components/ui` primitives and tokens. Nothing here reads mission data itself.

Never import here: features, `src/app`, `src/sim`, or `src/content`.
