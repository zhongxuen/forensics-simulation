import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ButtonLink, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  InboxIcon,
  LightbulbIcon,
  PlayIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { Panel } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import { Spinner } from "@/components/ui/spinner";
import { StatTile } from "@/components/ui/stat-tile";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import type { ToastTone } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { DialogDemo, DialogPicture, ToastDemo, ToastPicture } from "./primitives-demos";
import { motionVariants, Specimen, type SpecimenState } from "./specimen";
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

const NO_ERROR_ON_CONTROL =
  "A control doesn't hold an error itself. The message next to it says what happened and what to try.";

/** Pictures of an open tooltip need room below for it. */
function TooltipRoom({ children }: { children: ReactNode }) {
  return <div className="min-h-36 w-80 max-w-full">{children}</div>;
}

const BUTTON_VARIANTS: ReadonlyArray<{ variant: ButtonVariant; label: string; text: string }> = [
  { variant: "primary", label: "Primary: the one main action", text: "Start mission" },
  { variant: "secondary", label: "Secondary", text: "Show me a hint" },
  { variant: "ghost", label: "Ghost: low emphasis", text: "Skip for now" },
  { variant: "danger", label: "Danger: throws something away", text: "Restart mission" },
];

const BUTTON_SIZES: readonly ButtonSize[] = ["sm", "md", "lg"];

const BADGE_TONES: readonly BadgeTone[] = [
  "neutral",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
  "reward",
  "evidence-tag",
];

const BADGE_WORDS: Readonly<Record<BadgeTone, string>> = {
  neutral: "Linux",
  accent: "New",
  success: "Online",
  warning: "Weak password",
  danger: "Exposed",
  info: "Port 22",
  reward: "Secret found!",
  "evidence-tag": "log:security/57",
};

const TOAST_TONES: readonly ToastTone[] = ["info", "success", "warning", "danger"];

function missionTabs(disableNotes: boolean): TabItem[] {
  return [
    {
      id: "objectives",
      label: "Objectives",
      content: <p className="text-secondary">Look around your home folder.</p>,
    },
    {
      id: "hints",
      label: "Hints",
      content: <p className="text-secondary">Hints are free. Take one whenever you like.</p>,
    },
    {
      id: "notes",
      label: "Notes",
      content: <p className="text-secondary">Write down anything you want to remember.</p>,
      disabled: disableNotes,
    },
  ];
}

const LS_OUTPUT = `recruit@hq:~$ ls -a
.  ..  .secret-plans.txt  notes.txt  welcome.txt`;

export function PrimitivesSection({ id }: { id: string }) {
  return (
    <Section
      id={id}
      title="Primitives"
      intro={
        <p>
          The building blocks every screen is made of, from <Code>src/components/ui</Code>. They use
          the semantic colour tokens only, show keyboard focus with the same ring, and take data
          through props: none of them fetch anything or read app state.
        </p>
      }
    >
      <div className="space-y-8">
        <Specimen
          name="Button"
          source="src/components/ui/button.tsx"
          without={{ error: NO_ERROR_ON_CONTROL }}
          variants={[
            ...BUTTON_VARIANTS.map(({ variant, label, text }) => ({
              label,
              render: (state: SpecimenState) => (
                <Button
                  variant={variant}
                  disabled={state === "disabled"}
                  loading={state === "loading"}
                >
                  {text}
                </Button>
              ),
            })),
            {
              label: "With an icon",
              render: (state: SpecimenState) => (
                <Button
                  icon={<LightbulbIcon />}
                  disabled={state === "disabled"}
                  loading={state === "loading"}
                >
                  Show me a hint
                </Button>
              ),
            },
            {
              label: "Icon only (its label is the accessible name and a native tooltip)",
              render: (state: SpecimenState) => (
                <Button
                  variant="ghost"
                  label="Search"
                  icon={<SearchIcon />}
                  disabled={state === "disabled"}
                  loading={state === "loading"}
                />
              ),
            },
            {
              label: "Sizes: sm, md, lg",
              render: (state: SpecimenState) => (
                <div className="flex flex-wrap items-center gap-3">
                  {BUTTON_SIZES.map((size) => (
                    <Button
                      key={size}
                      size={size}
                      variant="primary"
                      disabled={state === "disabled"}
                      loading={state === "loading"}
                    >
                      Start mission
                    </Button>
                  ))}
                </div>
              ),
            },
          ]}
        >
          Says what happens when pressed: &ldquo;Start mission&rdquo;, not &ldquo;OK&rdquo;. While
          loading it shows a spinner, ignores presses, and keeps its label and its place in the tab
          order. Disabled buttons use muted colours instead of fading out.
        </Specimen>

        <Specimen
          name="Button link"
          source="src/components/ui/button.tsx"
          without={{
            disabled: "A link is never disabled. If there's nowhere to go, it isn't shown.",
            loading: "The page it opens shows its own loading state.",
            error: NO_ERROR_ON_CONTROL,
          }}
          variants={[
            {
              label: "Primary",
              render: () => (
                <ButtonLink href="#primitives" variant="primary" icon={<PlayIcon />}>
                  Start here
                </ButtonLink>
              ),
            },
            {
              label: "Secondary",
              render: () => (
                <ButtonLink href="#primitives" icon={<ArrowRightIcon />}>
                  See all missions
                </ButtonLink>
              ),
            },
          ]}
        >
          A link dressed as a button, for actions that go somewhere.
        </Specimen>

        <Specimen
          name="Badge"
          source="src/components/ui/badge.tsx"
          without={DISPLAY_ONLY}
          variants={[
            {
              label: "Outline",
              render: () => (
                <div className="flex max-w-xl flex-wrap gap-2">
                  {BADGE_TONES.map((tone) => (
                    <Badge key={tone} tone={tone}>
                      {BADGE_WORDS[tone]}
                    </Badge>
                  ))}
                </div>
              ),
            },
            {
              label: "Solid",
              render: () => (
                <div className="flex max-w-xl flex-wrap gap-2">
                  {BADGE_TONES.map((tone) => (
                    <Badge key={tone} tone={tone} appearance="solid">
                      {BADGE_WORDS[tone]}
                    </Badge>
                  ))}
                </div>
              ),
            },
            {
              label: "Monospace, with an icon",
              render: () => (
                <div className="flex flex-wrap gap-2">
                  <Badge tone="info" mono>
                    10.0.0.12
                  </Badge>
                  <Badge tone="success" icon={<CheckCircleIcon />}>
                    Done
                  </Badge>
                </div>
              ),
            },
          ]}
        >
          A short label. Every tone carries a word, so colour is never the only signal. The reward
          tone is kept for celebrations. <Code>evidence-tag</Code> is for artefact refs: an amber
          outline in monospace, like the tag on an evidence bag (its solid form is the subtle amber
          fill, because a solid amber chip would read as a button). <Code>popKey</Code> pops the
          badge once when it changes: see Motion below.
        </Specimen>

        <Specimen
          name="Spinner"
          source="src/components/ui/spinner.tsx"
          without={DISPLAY_ONLY}
          variants={motionVariants(() => (
            <span className="inline-flex items-center gap-2 text-secondary">
              <Spinner />
              Loading the practice network
            </span>
          ))}
        >
          A loading ring, always next to words that say what&apos;s loading. Under reduced motion it
          stands still.
        </Specimen>

        <Specimen
          name="Simulated badge"
          source="src/components/ui/simulated-badge.tsx"
          without={{
            disabled: "It's always there and always explains itself. It can't be switched off.",
            loading: "Its explanation is fixed text, so nothing loads.",
            error: "It only opens an explanation, so there's nothing to go wrong.",
          }}
          variants={[
            {
              label: "Medium (panels, page headers)",
              render: (state: SpecimenState) => (
                <TooltipRoom>
                  <SimulatedBadge open={state === "default" ? undefined : true} />
                </TooltipRoom>
              ),
            },
            {
              label: "Small (tight toolbars)",
              render: (state: SpecimenState) => (
                <TooltipRoom>
                  <SimulatedBadge size="sm" open={state === "default" ? undefined : true} />
                </TooltipRoom>
              ),
            },
            {
              label: "Compact (the shell's top bar and other headers)",
              render: (state: SpecimenState) => (
                <TooltipRoom>
                  <SimulatedBadge size="compact" open={state === "default" ? undefined : true} />
                </TooltipRoom>
              ),
            },
          ]}
        >
          The marker that says nothing here is real, so nobody mistakes simulated output for a real
          tool&apos;s. It can&apos;t be dismissed. Hover, focus or tap it to see why it&apos;s
          there. Its look is <Code>tape</Code>: a dashed warning outline, never a fill, so it
          can&apos;t be mistaken for an amber button. <strong>Once per view:</strong> the
          shell&apos;s top bar carries one, and so does every terminal (a lesson&apos;s practice
          terminal can stand on its own). Nothing else adds another.
        </Specimen>

        <Specimen
          name="Tooltip"
          source="src/components/ui/tooltip.tsx"
          without={{
            disabled: "The trigger can be disabled; the tooltip itself has no disabled state.",
            loading: "Tooltip text is written ahead of time, so nothing loads.",
            error: "It only shows text, so there's nothing to go wrong.",
          }}
          variants={[
            {
              label: "Below (default)",
              render: (state: SpecimenState) => (
                <TooltipRoom>
                  <Tooltip
                    open={state === "default" ? undefined : true}
                    content="A port is a numbered door into a computer. Different programs listen at different doors."
                  >
                    <Button size="sm">What&apos;s a port?</Button>
                  </Tooltip>
                </TooltipRoom>
              ),
            },
          ]}
        >
          A short explanation beside a control. Opens on hover, keyboard focus and tap; Escape
          closes it, and the pointer can move onto it without it vanishing. Only for extra detail:
          anything needed to act belongs on the page.
        </Specimen>

        <Specimen
          name="Card"
          source="src/components/ui/card.tsx"
          without={DISPLAY_ONLY}
          variants={[
            {
              label: "Raised, and overlay inside it",
              render: () => (
                <Card as="article" className="w-96 max-w-full">
                  <h4 className="font-semibold">The office network</h4>
                  <p className="mt-1 text-secondary">Four computers, one of them switched off.</p>
                  <Card elevation="overlay" padding="sm" className="mt-4">
                    <p className="font-mono text-sm">10.0.0.12</p>
                  </Card>
                </Card>
              ),
            },
          ]}
        >
          A surface that groups related content, one step above the page.
        </Specimen>

        <Specimen
          name="Card link"
          source="src/components/ui/card.tsx"
          without={{
            disabled: "A link is never disabled. If there's nowhere to go, it isn't shown.",
            loading: "The page it opens shows its own loading state.",
            error: NO_ERROR_ON_CONTROL,
          }}
          variants={[
            {
              label: "Card link",
              render: () => (
                <Card href="#primitives" className="w-96 max-w-full">
                  <p className="text-sm text-muted">Mission 1 · about 8 minutes</p>
                  <p className="mt-1 font-semibold">Welcome to the team</p>
                  <p className="mt-1 text-secondary">Meet the team and learn the rules.</p>
                </Card>
              ),
            },
          ]}
        >
          With <Code>href</Code>, the whole card is one link. Keep its content short and free of
          other controls.
        </Specimen>

        <Specimen
          name="Panel"
          source="src/components/ui/panel.tsx"
          without={DISPLAY_ONLY}
          variants={[
            {
              label: "Default",
              render: () => (
                <Panel
                  title="Objectives"
                  titleAs="h4"
                  className="w-96 max-w-full"
                  actions={<Badge>1 of 3</Badge>}
                >
                  <p className="text-secondary">Look around your home folder.</p>
                </Panel>
              ),
            },
            {
              label: "Terminal tone",
              render: () => (
                <Panel
                  title="Terminal"
                  titleAs="h4"
                  tone="terminal"
                  className="w-96 max-w-full"
                  actions={<SimulatedBadge size="sm" />}
                >
                  <p>
                    <span className="text-term-green">recruit@hq</span>:
                    <span className="text-term-blue">~</span>$ ls
                  </p>
                  <p>notes.txt welcome.txt</p>
                  <p className="text-term-dim"># These are the files in your home folder.</p>
                </Panel>
              ),
            },
          ]}
        >
          A working surface with a header bar, for the objectives list, the terminal and the map.
          Calm and readable; celebrations happen elsewhere. The terminal tone uses the terminal
          palette that phase 05 builds on.
        </Specimen>

        <Specimen
          name="Tabs"
          source="src/components/ui/tabs.tsx"
          without={{
            loading: "Tabs switch between content that's already on the page.",
            error: "Switching tabs can't fail.",
          }}
          variants={[
            ...motionVariants(
              (state: SpecimenState) => (
                <Tabs
                  label="Mission views"
                  tabs={missionTabs(state === "disabled")}
                  className="w-96 max-w-full"
                />
              ),
              "Tabs",
            ),
          ]}
        >
          Switch views in place. Tab reaches the selected tab; arrow keys move between tabs and
          select as they go, skipping unavailable ones; Home and End jump to the ends. The selected
          tab gets an accent bar, not only a colour change, and the bar slides to the tab you pick
          (instantly under reduced motion). The disabled picture turns off Notes.
        </Specimen>

        <Specimen
          name="Dialog"
          source="src/components/ui/dialog.tsx"
          without={{
            disabled: "The dialog has no disabled state. Its buttons can be disabled on their own.",
            error:
              "Errors show inside the dialog's content, as a line of text or a Callout, so the learner keeps their place.",
          }}
          variants={[
            {
              label: "Panel",
              render: (state: SpecimenState) => (
                <div className="w-lg max-w-full">
                  <DialogPicture loading={state === "loading"} />
                </div>
              ),
            },
          ]}
        >
          A modal on the native <Code>&lt;dialog&gt;</Code> element: it traps focus, Escape or a
          click outside closes it, and focus goes back to where it was. The pictures show its panel
          in place; the loading picture shows the main action working.
          <div className="mt-3">
            <DialogDemo />
          </div>
        </Specimen>

        <Specimen
          name="Progress bar"
          source="src/components/ui/progress-bar.tsx"
          without={{
            hover: DISPLAY_ONLY_REASON,
            focus: DISPLAY_ONLY_REASON,
            disabled: DISPLAY_ONLY_REASON,
            error:
              "A stalled task says so in words beside the bar; the bar itself only shows how far along it is.",
          }}
          variants={[
            ...motionVariants(
              (state) => (
                <ProgressBar
                  label="Checking the office network"
                  value={state === "loading" ? undefined : 3}
                  max={8}
                  showValue
                  className="w-80 max-w-full"
                />
              ),
              "Accent",
            ),
            {
              label: "Reward (celebrations only)",
              render: (state: SpecimenState) => (
                <ProgressBar
                  label="Objectives done"
                  value={state === "loading" ? undefined : 3}
                  max={3}
                  showValue
                  tone="reward"
                  className="w-80 max-w-full"
                />
              ),
            },
          ]}
        >
          How far along something is. Leave out <Code>value</Code> while the total is unknown and
          the loading version slides back and forth (it stands still under reduced motion). Changes
          to the value grow the bar smoothly, or instantly under reduced motion.
        </Specimen>

        <Specimen
          name="Stat tile"
          source="src/components/ui/stat-tile.tsx"
          without={{
            hover: DISPLAY_ONLY_REASON,
            focus: DISPLAY_ONLY_REASON,
            disabled: DISPLAY_ONLY_REASON,
            error:
              "When a number can't be worked out, say so in the hint instead of showing a wrong one.",
          }}
          variants={[
            {
              label: "Neutral and toned",
              render: (state: SpecimenState) => (
                <div className="grid w-lg max-w-full grid-cols-2 gap-3">
                  <StatTile
                    label="Computers found"
                    value={4}
                    hint="in the office network"
                    loading={state === "loading"}
                  />
                  <StatTile
                    label="Open doors (ports)"
                    value={2}
                    hint="one shouldn't be open"
                    tone="warning"
                    icon={<InboxIcon />}
                    loading={state === "loading"}
                  />
                </div>
              ),
            },
          ]}
        >
          One number with its label. A tone colours the number, but the label and hint always say
          what it means.
        </Specimen>

        <Specimen
          name="Code block"
          source="src/components/ui/code-block.tsx"
          without={{
            disabled: "Code can always be read, scrolled and copied.",
            loading: "The code arrives with the page.",
          }}
          variants={[
            {
              label: "With a Copy button",
              render: (state: SpecimenState) => (
                <CodeBlock
                  code={LS_OUTPUT}
                  title="Try this command"
                  language="shell"
                  copyable
                  initialCopyStatus={state === "error" ? "error" : undefined}
                  className="w-lg max-w-full"
                />
              ),
            },
          ]}
        >
          Text to read or type exactly. It scrolls sideways instead of wrapping, and the scroll area
          takes keyboard focus. The error picture shows what happens when the browser won&apos;t
          allow copying.
        </Specimen>

        <Specimen
          name="Empty state"
          source="src/components/ui/empty-state.tsx"
          without={DISPLAY_ONLY}
          variants={[
            {
              label: "Empty state",
              render: () => (
                <EmptyState
                  titleAs="h4"
                  icon={<SearchIcon />}
                  title="Your network map is still dark"
                  description="It lights up as you discover computers during missions."
                  action={
                    <ButtonLink href="#primitives" variant="primary" icon={<PlayIcon />}>
                      Start your first mission
                    </ButtonLink>
                  }
                  className="w-lg max-w-full"
                />
              ),
            },
          ]}
        >
          Never &ldquo;No data&rdquo;: what will be here, why it&apos;s empty, and the one action
          that fills it. Its button is a Button link, shown above in every state.
        </Specimen>

        <Specimen
          name="Toast"
          source="src/components/ui/toast.tsx"
          without={{
            disabled: "A toast has no disabled state. Leave it out instead.",
            loading: "Toasts report something that already happened.",
            error: "The danger tone is how a toast reports a problem.",
          }}
          variants={TOAST_TONES.map((tone) => ({
            label: tone.charAt(0).toUpperCase() + tone.slice(1),
            render: () => (
              <div className="w-96 max-w-full">
                <ToastPicture tone={tone} />
              </div>
            ),
          }))}
        >
          A brief message about something that just happened: icon, colour and words together.
          Toasts stack in a <Code>ToastViewport</Code>, a polite live region; danger toasts are
          announced straight away and stay until dismissed. The others can leave on their own,
          pausing while the pointer or focus is on them.
          <div className="mt-3">
            <ToastDemo />
          </div>
        </Specimen>
      </div>
    </Section>
  );
}
