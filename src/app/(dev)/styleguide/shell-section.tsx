import type { ReactNode } from "react";
import { MissionProgressSummary } from "@/components/shell/mission-progress";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";
import { Sidebar } from "@/components/shell/sidebar";
import { StartHereLink } from "@/components/shell/start-here-link";
import { FIRST_STEP } from "@/lib/next-step";
import { PaletteDemo, SearchButtonPicture } from "./palette-demo";
import { Specimen, type SpecimenState } from "./specimen";
import { Code, Section } from "./styleguide-ui";

const DISPLAY_ONLY_REASON = "Display only: nothing to point at, focus, or press.";

/** For components that show information and take no input. */
const DISPLAY_ONLY: Partial<Record<SpecimenState, string>> = {
  hover: DISPLAY_ONLY_REASON,
  focus: DISPLAY_ONLY_REASON,
  disabled: DISPLAY_ONLY_REASON,
  loading: DISPLAY_ONLY_REASON,
  error: DISPLAY_ONLY_REASON,
};

/** A strip of top bar, for the pieces that live in it. */
function TopBarFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-16 w-80 max-w-full items-center justify-end gap-3 rounded-lg border border-subtle bg-surface-base px-4">
      {children}
    </div>
  );
}

export function ShellSection({ id }: { id: string }) {
  return (
    <Section
      id={id}
      title="App shell"
      intro={
        <p>
          The frame every page in <Code>src/app/(app)</Code> renders in, from{" "}
          <Code>src/components/shell</Code>. Sidebar pieces follow your saved sidebar setting, so
          collapse the sidebar on any app page to see them as an icon rail.
        </p>
      }
    >
      <div className="space-y-8">
        <Specimen
          name="Start here button"
          source="src/components/shell/start-here-link.tsx"
          without={{
            disabled: "There's always somewhere to start, so Start here is never unavailable.",
            loading: "Its destination is known when the page renders; nothing loads first.",
            error: "It's a plain link with no input, so there's nothing to go wrong.",
          }}
          variants={[
            {
              label: "Sidebar card",
              render: () => (
                <div className="w-80 max-w-full rounded-lg border border-subtle bg-surface-raised p-3">
                  <StartHereLink step={FIRST_STEP} variant="sidebar" />
                </div>
              ),
            },
            {
              label: "Bottom bar (small screens)",
              render: () => (
                <div className="w-80 max-w-full rounded-lg border border-subtle bg-surface-base p-3">
                  <StartHereLink step={FIRST_STEP} variant="bar" />
                </div>
              ),
            },
            {
              label: "Inline (in page content)",
              render: () => <StartHereLink step={FIRST_STEP} variant="inline" />,
            },
          ]}
        >
          One click to the first mission, so a beginner never has to decide where to go. The only
          accent-filled control in the shell.
        </Specimen>

        <Specimen
          name="Sidebar"
          source="src/components/shell/sidebar.tsx"
          without={{
            disabled: "Every section is always open to explore. Nothing is locked.",
            loading: "The sections are a fixed list, known before the page renders.",
            error: "Links with no input, so there's nothing to go wrong.",
          }}
          variants={[
            {
              label: "Desktop sidebar",
              render: () => (
                <div className="h-200 w-80 max-w-full overflow-hidden rounded-lg border border-subtle bg-surface-raised">
                  <Sidebar variant="desktop" nextStep={FIRST_STEP} />
                </div>
              ),
            },
          ]}
        >
          The brand link, Start here, a link to each section with a plain-language subtitle, and the
          collapse toggle (the live copy&apos;s toggle changes your real sidebar setting). The
          section you&apos;re in gets an accent bar and tint; this page isn&apos;t in a section, so
          open any section to see it. On small screens the same contents open as a drawer, with a
          Close button.
        </Specimen>

        <Specimen
          name="Search and the command palette"
          source="src/components/shell/command-palette.tsx"
          without={{
            disabled: "Search is always available.",
            loading: "The list of places is known before the page renders.",
            error:
              "Searching can't fail. When nothing matches, the palette says so and suggests a section name.",
          }}
          variants={[
            {
              label: "Search button",
              render: (state) => (
                <TopBarFrame>
                  {state === "default" ? (
                    <PaletteDemo nextStep={FIRST_STEP} />
                  ) : (
                    <SearchButtonPicture />
                  )}
                </TopBarFrame>
              ),
            },
          ]}
        >
          Click the live button, or press <Code>Ctrl K</Code> (<Code>⌘K</Code> on a Mac) anywhere in
          the app, to jump to any place by typing. Arrow keys move, Enter opens, Escape closes.
        </Specimen>

        <Specimen
          name="Mission progress"
          source="src/components/shell/mission-progress.tsx"
          without={DISPLAY_ONLY}
          variants={[
            {
              label: "Just started: 0 of 4",
              render: () => (
                <TopBarFrame>
                  <MissionProgressSummary done={0} total={4} />
                </TopBarFrame>
              ),
            },
            {
              label: "Halfway: 2 of 4",
              render: () => (
                <TopBarFrame>
                  <MissionProgressSummary done={2} total={4} />
                </TopBarFrame>
              ),
            },
            {
              label: "Every objective done",
              render: () => (
                <TopBarFrame>
                  <MissionProgressSummary done={4} total={4} />
                </TopBarFrame>
              ),
            },
          ]}
        >
          The top bar&apos;s mission-progress slot: objectives done in the current mission. It only
          shows inside a mission, while a page renders <Code>ShowMissionProgress</Code>. The count
          beside the ring hides on the smallest screens; the ring keeps its accessible name.
        </Specimen>

        <Specimen
          name="Placeholder page"
          source="src/components/shell/section-placeholder.tsx"
          without={DISPLAY_ONLY}
          variants={[
            {
              label: "Placeholder page",
              render: () => (
                <div className="w-2xl max-w-full rounded-lg border border-subtle p-6">
                  <SectionPlaceholder headline="Your story starts here" nextStep={FIRST_STEP}>
                    <p>
                      A page that isn&apos;t built yet says what it will be, in plain words, and
                      points to where to start.
                    </p>
                  </SectionPlaceholder>
                </div>
              ),
            },
          ]}
        >
          Stands in for a section that isn&apos;t built yet. Its Start here button is the inline
          variant above.
        </Specimen>
      </div>
    </Section>
  );
}
