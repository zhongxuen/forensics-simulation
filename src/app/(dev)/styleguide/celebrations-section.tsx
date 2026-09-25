import { Callout } from "@/components/ui/callout";
import { CharacterMessage } from "@/components/ui/character-message";
import { MissionComplete } from "@/components/ui/mission-complete";
import { ObjectiveTick } from "@/components/ui/objective-tick";
import { ProgressRing } from "@/components/ui/progress-ring";
import {
  Cmd,
  CoachMarkCardPicture,
  CoachMarkDemo,
  LsSuccess,
  ObjectiveTickDemo,
  ProgressRingDemo,
  SecretFoundToastDemo,
  SecretFoundToastPicture,
} from "./celebrations-demos";
import { Replay } from "./replay";
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

const MISSION = {
  title: "Welcome to the team",
  skills: ["Linux", "Blue team"],
  line: "You read the team's rules and found your first hidden file.",
};

const MENTOR = { name: "Your mentor", role: "Senior analyst" };
const TEAM_LEAD = { name: "Team lead", role: "Runs every engagement" };
const MENTOR_LINE =
  "Welcome aboard. Everything on this team's practice network is make-believe, so you can't break anything real. Let's start by looking around.";

export function CelebrationsSection({ id }: { id: string }) {
  return (
    <Section
      id={id}
      title="Beginner and celebration"
      intro={
        <>
          <p>
            The pieces that guide a beginner and celebrate their wins, so every module does both the
            same way. Rewards live inside a mission: an objective ticked, a secret found, the
            mission complete. The reward colour (<Code>--reward</Code>) is kept for these alone.
          </p>
          <p className="mt-3">
            Celebrations appear twice: with full motion and with reduced motion, whatever the Motion
            setting above says. Reduced motion shows each one&apos;s finished, still version, which
            should still feel like a reward. Every effect ends within 1.5 seconds, never blocks a
            click, and any key skips it. Press <strong>Play again</strong> to watch one more time.
          </p>
        </>
      }
    >
      <div className="space-y-8">
        <Specimen
          name="Callout"
          source="src/components/ui/callout.tsx"
          without={DISPLAY_ONLY}
          variants={[
            {
              label: "Tip, new idea, heads up",
              render: () => (
                <div className="max-w-xl space-y-4">
                  <Callout kind="tip">
                    <p>
                      Press <kbd className="font-mono text-primary">Tab</kbd> to finish a file name
                      for you. It saves typing and avoids spelling slips.
                    </p>
                  </Callout>
                  <Callout kind="concept">
                    <p>
                      Every computer has numbered doors for different jobs. These doors are called{" "}
                      <strong className="text-primary">ports</strong>.
                    </p>
                  </Callout>
                  <Callout kind="warning">
                    <p>
                      On a real network, this would lock people out of their email. Your team only
                      does it with written permission.
                    </p>
                  </Callout>
                </div>
              ),
            },
          ]}
        >
          A short aside inside a lesson or briefing. Colour, icon and a written label together, so
          the kind never depends on colour alone. <Code>title</Code> replaces the label.
        </Specimen>

        <Specimen
          name="Coach mark"
          source="src/components/ui/coach-mark.tsx"
          without={{
            disabled: "Next and Skip tour always work: a tour never traps the learner.",
            loading: "Tour steps are written ahead of time, so nothing loads.",
            error:
              "If its target isn't on the page, the coach mark stays hidden rather than pointing at nothing.",
          }}
          variants={[
            {
              label: "First step",
              render: (state) =>
                state === "default" ? (
                  <CoachMarkDemo />
                ) : (
                  <div className="pt-2">
                    <CoachMarkCardPicture step={1} />
                  </div>
                ),
            },
            {
              label: "Last step",
              render: () => (
                <div className="pb-2">
                  <CoachMarkCardPicture step={2} />
                </div>
              ),
            },
          ]}
        >
          A guided-tour pointer for first runs. The live copy dims the page around one element,
          rings it (the ring pulses twice, then holds still; under reduced motion it holds still
          from the start), and shows this card beside it. The dimming lets clicks through, focus
          moves to the card, Escape skips, and focus goes back when the tour ends. The frozen
          pictures show the card alone.
        </Specimen>

        <Specimen
          name="Objective tick"
          source="src/components/ui/objective-tick.tsx"
          without={DISPLAY_ONLY}
          variants={[
            ...motionVariants(() => <ObjectiveTickDemo />, "Ticking one off"),
            {
              label: "Done, now, to do, and a bonus (already done when shown, so no celebration)",
              render: () => (
                <ul className="max-w-xl space-y-4">
                  <ObjectiveTick status="done" success={<LsSuccess />}>
                    Look around your home folder with <Cmd>ls</Cmd>.
                  </ObjectiveTick>
                  <ObjectiveTick
                    status="current"
                    details={
                      <p className="mt-2 type-small text-secondary">
                        Why: a welcome note says what the team expects of you.
                      </p>
                    }
                  >
                    Read the note called <Cmd>welcome.txt</Cmd>.
                  </ObjectiveTick>
                  <ObjectiveTick status="open">
                    Open the file called <Cmd>welcome.txt</Cmd>.
                  </ObjectiveTick>
                  <ObjectiveTick status="open" bonus>
                    Read the manual page for <Cmd>ls</Cmd>.
                  </ObjectiveTick>
                </ul>
              ),
            },
          ]}
        >
          One objective in a case&apos;s list. The <Code>current</Code> one is the brightest thing
          in the list: a &ldquo;Now&rdquo; eyebrow, an amber box, and its details open (they slide
          in when it becomes current). When the case checks it off, the box fills with the reward
          colour and a glow, and the success line slides in beneath, in <Code>text-primary</Code>{" "}
          behind a reward-coloured rule, so the colour marks the moment and the sentence stays easy
          to read. The box isn&apos;t a control: cases tick objectives, not players. Screen readers
          hear &ldquo;Done&rdquo;, &ldquo;Now&rdquo; or &ldquo;To do&rdquo; first, the current one
          is <Code>aria-current=&quot;step&quot;</Code>, and the success line is announced when it
          arrives.
        </Specimen>

        <Specimen
          name="Secret found toast"
          source="src/components/ui/secret-found-toast.tsx"
          without={{
            disabled: "Dismiss always works.",
            loading: "It appears the moment the secret is found; nothing loads first.",
            error: "It only ever reports good news.",
          }}
          variants={motionVariants((state) =>
            state === "default" ? (
              <Replay>
                <SecretFoundToastDemo />
              </Replay>
            ) : (
              <SecretFoundToastPicture />
            ),
          )}
        >
          Shown when the learner finds a hidden secret. The card pops in; its name is playful and
          its line says plainly what they found. It never takes focus, so it can&apos;t interrupt
          typing. The hover and focus pictures show its Dismiss button.
        </Specimen>

        <Specimen
          name="Mission complete"
          source="src/components/ui/mission-complete.tsx"
          without={DISPLAY_ONLY}
          variants={motionVariants(() => (
            <Replay>
              <div className="w-2xl max-w-full">
                <MissionComplete missionTitle={MISSION.title} skills={MISSION.skills}>
                  {MISSION.line}
                </MissionComplete>
              </div>
            </Replay>
          ))}
        >
          The celebration at the top of a mission debrief. With full motion the medal pops in with a
          burst of sparks, a scanline sweeps down and the heading glitches for a moment. Under
          reduced motion the medal, heading and skill badges are there from the start. The heading
          can take focus from code, so a debrief page can move focus to it.
        </Specimen>

        <Specimen
          name="Progress ring"
          source="src/components/ui/progress-ring.tsx"
          without={DISPLAY_ONLY}
          variants={[
            ...motionVariants(() => <ProgressRingDemo />, "Filling up"),
            {
              label: "None, some, and all objectives done",
              render: () => (
                <div className="flex items-center gap-6">
                  <ProgressRing value={0} max={4} label="Objectives done" />
                  <ProgressRing value={2} max={4} label="Objectives done" />
                  <ProgressRing value={4} max={4} label="Objectives done" />
                </div>
              ),
            },
            {
              label: "Sizes: sm (top bar, count shown beside it), md, lg",
              render: () => (
                <div className="flex items-center gap-6">
                  <span className="flex items-center gap-2 text-sm text-secondary">
                    <ProgressRing value={1} max={3} label="Objectives done" size="sm" />1 of 3
                  </span>
                  <ProgressRing value={1} max={3} label="Objectives done" size="md" />
                  <ProgressRing value={1} max={3} label="Objectives done" size="lg" />
                </div>
              ),
            },
          ]}
        >
          How many of this mission&apos;s objectives are done. The ring fills when the count
          changes, and turns the reward colour when everything is done. Screen readers hear it as a
          progress bar: &ldquo;Objectives done, 2 of 4&rdquo;.
        </Specimen>

        <Specimen
          name="Character message"
          source="src/components/ui/character-message.tsx"
          without={DISPLAY_ONLY}
          variants={[
            ...motionVariants(
              () => (
                <Replay>
                  <div className="max-w-xl">
                    <CharacterMessage speaker={MENTOR} typewriter>
                      {MENTOR_LINE}
                    </CharacterMessage>
                  </div>
                </Replay>
              ),
              "Typewriter",
            ),
            {
              label: "Mentor and teammate, without the typewriter",
              render: () => (
                <div className="max-w-xl space-y-5">
                  <CharacterMessage speaker={MENTOR}>
                    Try <Cmd>ls</Cmd>. It lists the files in the folder you&apos;re in.
                  </CharacterMessage>
                  <CharacterMessage speaker={TEAM_LEAD} tone="teammate">
                    Before we test anything, the owner gives us permission in writing. That&apos;s
                    what makes this job legal.
                  </CharacterMessage>
                </div>
              ),
            },
          ]}
        >
          A speech bubble for story beats and mentor lines. The typewriter is optional, takes at
          most 1.5 seconds however long the line, and any key finishes it. Under reduced motion the
          whole line shows at once. Screen readers always get the whole line at once. The names here
          are stand-ins until the story&apos;s cast is written (phase 08).
        </Specimen>
      </div>
    </Section>
  );
}
