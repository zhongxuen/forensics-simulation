import { Badge } from "@/components/ui/badge";
import { CandleMark } from "@/components/ui/candle-mark";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Stamp } from "@/components/ui/stamp";
import {
  BadgePopDemo,
  LineFlashDemo,
  MenuDemo,
  SplitPaneDemo,
  SweepDemo,
} from "./case-pieces-demos";
import { Replay } from "./replay";
import { motionVariants, Specimen, type SpecimenState } from "./specimen";
import { Code, Section } from "./styleguide-ui";

const DISPLAY_ONLY_REASON = "Display only: nothing to point at, focus, or press.";

const DISPLAY_ONLY: Partial<Record<SpecimenState, string>> = {
  hover: DISPLAY_ONLY_REASON,
  focus: DISPLAY_ONLY_REASON,
  disabled: DISPLAY_ONLY_REASON,
  loading: DISPLAY_ONLY_REASON,
  error: DISPLAY_ONLY_REASON,
};

/** Effects in the Motion section: shown live, twice, so there's no frozen state to draw. */
const LIVE_ONLY_REASON =
  "A motion demo: the live copies above, in full and reduced motion, are the whole story.";

const LIVE_ONLY: Partial<Record<SpecimenState, string>> = {
  hover: LIVE_ONLY_REASON,
  focus: LIVE_ONLY_REASON,
  disabled: LIVE_ONLY_REASON,
  loading: LIVE_ONLY_REASON,
  error: LIVE_ONLY_REASON,
};

/** Only the live copy of an interactive demo is drawn: its hover and focus come from using it. */
const INTERACTIVE_DEMO_REASON =
  "Drawn live: point at it or reach it with Tab to see this state. The frozen pictures can't hold it open.";

const TYPE_ROLES = [
  {
    role: "type-display",
    spec: "48/52 · semibold · tight",
    use: "The landing page's H1 only",
    sample: "Incident Room",
  },
  {
    role: "type-page-title",
    spec: "30/36 · semibold",
    use: "The H1 on every other page",
    sample: "The clean copy",
  },
  {
    role: "type-section-title",
    spec: "20/28 · semibold",
    use: "H2",
    sample: "Your written permission",
  },
  {
    role: "type-eyebrow",
    spec: "12/16 · semibold · uppercase · wide · text-muted",
    use: "The label above a title",
    sample: "Case 1 · About 15 minutes",
  },
  {
    role: "type-body",
    spec: "16/28",
    use: "Reading",
    sample: "A laptop arrives in a sealed bag, with a handover form and a signed letter.",
  },
  {
    role: "type-small",
    spec: "14/20",
    use: "Captions, metadata, help",
    sample: "Hints are free, and using one never counts against you.",
  },
  {
    role: "type-data",
    spec: "Geist Mono 13 (14 from sm) · tabular figures",
    use: "Paths, hashes, refs, times",
    sample: "disk:qf-lt-03:mft/1234 · 2026-04-13 08:02:17Z",
  },
] as const;

export function TypeRolesSection({ id }: { id: string }) {
  return (
    <Section
      id={id}
      title="Type roles"
      intro={
        <p>
          Seven named roles (UIUX.md §4.2), as <Code>@utility</Code> classes in{" "}
          <Code>src/styles/typography.css</Code>. A component names the job its text does instead of
          picking a size, so a heading, a label and a hint can&apos;t drift into the same grey{" "}
          <Code>text-sm</Code>. Each sets size, line height and weight together; colour stays the
          component&apos;s choice, except the eyebrow, which is always <Code>text-muted</Code>.
        </p>
      }
    >
      <div className="divide-y divide-subtle border-y border-subtle">
        {TYPE_ROLES.map(({ role, spec, use, sample }) => (
          <div
            key={role}
            className="grid gap-x-6 gap-y-2 py-5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-baseline"
          >
            <div>
              <Code>{role}</Code>
              <p className="mt-1 type-small text-muted">{spec}</p>
              <p className="type-small text-secondary">{use}</p>
            </div>
            {/* Class names are spelled out in TYPE_ROLES so Tailwind finds and generates them. */}
            <p className={role}>{sample}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-10 type-section-title">Together</h3>
      <div className="mt-4 max-w-2xl rounded-xl border border-subtle p-6">
        <p className="type-eyebrow">Case 1 · About 15 minutes</p>
        <p className="mt-1 type-page-title">The clean copy</p>
        <p className="mt-3 type-body text-secondary">
          A laptop arrives with a handover form. Make a copy you can prove, then find the note left
          on its desktop.
        </p>
        <p className="mt-6 type-section-title">The situation</p>
        <p className="mt-2 type-body text-secondary">
          The form gives the drive&apos;s fingerprint: <span className="type-data">sha256</span>{" "}
          <span className="type-data break-all text-primary">9f2c…41ab</span>.
        </p>
        <p className="mt-3 type-small text-muted">Saved in this browser only.</p>
      </div>
    </Section>
  );
}

export function CasePiecesSection({ id }: { id: string }) {
  return (
    <Section
      id={id}
      title="Case pieces"
      intro={
        <p>
          The primitives the case screens are built from (UIUX.md, prompt UX.1): the brand mark, the
          letter a client signs, evidence tags, the overflow menu, the split between terminal and
          views, loading skeletons and the Case closed stamp. Each uses only colour pairs the
          contrast audit measures.
        </p>
      }
    >
      <div className="space-y-8">
        <Specimen
          name="Candle mark"
          source="src/components/ui/candle-mark.tsx"
          without={DISPLAY_ONLY}
          variants={[
            {
              label: "In the sidebar's tile, and at sizes in the current text colour",
              render: () => (
                <div className="flex items-center gap-6">
                  <span className="flex size-9 items-center justify-center rounded-md border border-accent/40 bg-accent-subtle text-accent">
                    <CandleMark className="size-5" />
                  </span>
                  <CandleMark className="size-6 text-primary" />
                  <CandleMark className="size-10 text-accent" />
                  <CandleMark className="size-16 text-secondary" />
                </div>
              ),
            },
          ]}
        >
          Candlewright&apos;s mark: a candle and its flame, the lamp the evidence room works by. An
          inline SVG in <Code>currentColor</Code>, hidden from screen readers, so it always sits
          beside the name. It replaced the sibling&apos;s <Code>&gt;▌</Code> prompt.
        </Specimen>

        <Specimen
          name="Letter card"
          source="src/components/ui/card.tsx"
          without={DISPLAY_ONLY}
          variants={[
            {
              label: 'variant="letter", with signed',
              render: () => (
                <Card
                  as="article"
                  variant="letter"
                  padding="lg"
                  className="w-xl max-w-full"
                  signed="Delia Quillfen, owner, Quillfen Freight"
                >
                  <p className="type-eyebrow">Your written permission</p>
                  <p className="mt-3 type-body">
                    Please examine the yard office laptop,{" "}
                    <span className="type-data">qf-lt-03</span>, and tell us what happened to it.
                  </p>
                  <ul className="mt-4 space-y-1.5 type-small">
                    <li className="flex gap-2">
                      <span aria-hidden="true" className="text-status-success">
                        ✓
                      </span>
                      <span>
                        <span className="sr-only">You may: </span>examine the laptop qf-lt-03
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span aria-hidden="true" className="text-status-danger">
                        ✕
                      </span>
                      <span>
                        <span className="sr-only">Out of scope: </span>any other machine in the yard
                      </span>
                    </li>
                  </ul>
                </Card>
              ),
            },
          ]}
        >
          A document you were handed, for the case&apos;s most important ethical beat: the
          client&apos;s signed permission. The raised surface with a top rule in{" "}
          <Code>--status-info</Code>, the permission colour, and a &ldquo;Signed:&rdquo; line at the
          foot from <Code>signed</Code>. Paper-toned by its layout, not a new colour.
        </Specimen>

        <Specimen
          name="Evidence tag"
          source="src/components/ui/badge.tsx"
          without={DISPLAY_ONLY}
          variants={[
            {
              label: 'tone="evidence-tag": outline and solid',
              render: () => (
                <div className="flex max-w-xl flex-wrap gap-2">
                  <Badge tone="evidence-tag">disk:qf-lt-03:mft/1234</Badge>
                  <Badge tone="evidence-tag">log:security/57</Badge>
                  <Badge tone="evidence-tag" appearance="solid">
                    mem:qf-srv-01:pid/4376
                  </Badge>
                </div>
              ),
            },
          ]}
        >
          An artefact ref, shown the way an evidence bag is tagged: amber outline, monospace. For
          the board&apos;s cards, the report&apos;s evidence picker and anywhere else a pin is
          named.
        </Specimen>

        <Specimen
          name="Menu"
          source="src/components/ui/menu.tsx"
          without={{
            hover: INTERACTIVE_DEMO_REASON,
            focus: INTERACTIVE_DEMO_REASON,
            loading: "Its actions are written ahead of time, so nothing loads.",
            error: "Opening a list can't fail. An action that can says so where it runs.",
          }}
          variants={[
            {
              label: "The ⋯ Case menu (the disabled picture turns off one item)",
              render: (state: SpecimenState) => <MenuDemo withDisabled={state === "disabled"} />,
            },
          ]}
        >
          A button that opens a short list of actions, for the ones that don&apos;t belong at eye
          level (UIUX.md §4.3): the &ldquo;⋯ Case&rdquo; menu holds Start the case again, which
          still asks first. The ARIA menu button pattern: Enter, Space or Arrow Down opens it on the
          first item, Arrow Up on the last; arrows, Home, End and a first letter move; Enter picks;
          Escape closes; focus always goes back to the button. Tab or a click outside closes it.
        </Specimen>

        <Specimen
          name="Split pane"
          source="src/components/ui/split-pane.tsx"
          without={{
            hover: INTERACTIVE_DEMO_REASON,
            focus: INTERACTIVE_DEMO_REASON,
            disabled: "The handle always moves. A layout too narrow for two panes shows one.",
            loading: "It holds panes that load on their own.",
            error: "Moving a handle can't fail.",
          }}
          variants={motionVariants(() => (
            <SplitPaneDemo />
          ))}
        >
          The terminal and the case views side by side, with a handle between them (the window
          splitter pattern). The handle is a <Code>role=&quot;separator&quot;</Code> whose{" "}
          <Code>aria-valuenow</Code> is the left pane&apos;s width in percent. Drag it; Arrow Left
          and Right move it 5%; Home and End snap it to the narrowest and widest; double-click (or
          Enter) puts it back. A keyboard move eases into place, instantly under reduced motion.
        </Specimen>

        <Specimen
          name="Skeleton"
          source="src/components/ui/skeleton.tsx"
          without={DISPLAY_ONLY}
          variants={motionVariants(() => (
            <Skeleton label="Loading the timeline" rows={4} className="w-96 max-w-full" />
          ))}
        >
          Grey rows in the shape of what&apos;s coming, while a pane loads, instead of a spinner and
          a sentence. A slow shimmer crosses them; under reduced motion they stand still. Screen
          readers hear the label once, as a status.
        </Specimen>

        <Specimen
          name="Stamp"
          source="src/components/ui/stamp.tsx"
          without={DISPLAY_ONLY}
          variants={motionVariants(() => (
            <Replay>
              <div className="px-4 py-6">
                <Stamp celebrate>Case closed</Stamp>
              </div>
            </Replay>
          ))}
        >
          The debrief&apos;s one big moment. With <Code>celebrate</Code> it lands: drops in large,
          overshoots and settles, tilted 4°. Under reduced motion it&apos;s already stamped. Reward
          violet, because it marks a moment rather than carrying text to read.
        </Specimen>
      </div>
    </Section>
  );
}

export function MotionSection({ id }: { id: string }) {
  return (
    <Section
      id={id}
      title="Motion"
      intro={
        <p>
          The primitives&apos; share of UIUX.md §5. Each scales with <Code>--motion-scale</Code>, so
          under reduced motion it lands on its still state at once, and each is shown here twice:
          full motion, then reduced. <Code>tests/unit/motion.test.ts</Code> holds every one to 1.5
          seconds (the shimmer, a loading indicator, may loop). The tab underline&apos;s slide is on
          the Tabs specimen, and the Case closed stamp on the Stamp specimen, above.
        </p>
      }
    >
      <div className="space-y-8">
        <Specimen
          name="Badge pop"
          source="animate-badge-pop · Badge popKey"
          without={LIVE_ONLY}
          variants={motionVariants(() => (
            <BadgePopDemo />
          ))}
        >
          A tab&apos;s count pops once when it changes: &ldquo;something landed here&rdquo;. Pass{" "}
          <Code>popKey</Code> only once something has changed, so a badge that loads with the page
          stays still.
        </Specimen>

        <Specimen
          name="Line flash"
          source="animate-line-flash"
          without={LIVE_ONLY}
          variants={motionVariants(() => (
            <LineFlashDemo />
          ))}
        >
          The line <Code>pin</Code> just pinned flashes amber, then settles on its own background:
          it links the action to where it went.
        </Specimen>

        <Specimen
          name="Sweep highlight"
          source="fx-sweep animate-sweep"
          without={LIVE_ONLY}
          variants={motionVariants(() => (
            <SweepDemo />
          ))}
        >
          One pass of light across a line, left to right: the MATCH from{" "}
          <Code>hashsum --verify</Code>, the case&apos;s key moment. <Code>fx-sweep</Code> draws the
          band and parks it off the line at rest; <Code>--sweep-colour</Code> picks its light (the
          accent unless set). A MISMATCH gets no motion at all.
        </Specimen>
      </div>
    </Section>
  );
}
