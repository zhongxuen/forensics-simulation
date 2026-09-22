"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  resetSettings,
  updateSettings,
  useSettings,
  type ReducedMotionOverride,
  type Settings,
} from "@/lib/settings";
import {
  ChangeSettingsProvider,
  RadioGroup,
  SettingCard,
  Switch,
  type RadioOption,
} from "./controls";

const MOTION_OPTIONS: ReadonlyArray<RadioOption<ReducedMotionOverride>> = [
  {
    value: "system",
    label: "Match my device",
    detail: "Follows your device's own setting for less motion.",
  },
  {
    value: "reduce",
    label: "Fewer animations",
    detail: "Nothing moves or flashes. Celebrations still show, standing still.",
  },
  {
    value: "full",
    label: "All animations",
    detail: "Plays every effect, even if your device asks for less motion.",
  },
];

type Notice = "unsaved" | "reset" | "reset-unsaved" | null;

const NOTICE_TEXT: Readonly<Record<Exclude<Notice, null>, string>> = {
  unsaved:
    "This browser isn't letting us save settings, so they'll go back to how they started when you reload the page. Everything else works the same.",
  reset: "Your settings are back to how they started.",
  "reset-unsaved":
    "Your settings are back to how they started. This browser isn't letting us save settings, so that's how they'll stay.",
};

interface SettingsFormProps {
  /**
   * Cards for settings a feature owns (the terminal's look), built from ./controls. They sit
   * after the beginner mode card, and their changes report "couldn't save" like every other row.
   */
  children?: ReactNode;
}

/**
 * The /settings page's controls. Every change applies at once and is saved in this browser
 * through src/lib/settings; with storage blocked it still applies until the page is reloaded,
 * and a line underneath says so.
 */
export function SettingsForm({ children }: SettingsFormProps) {
  const settings = useSettings();
  const [notice, setNotice] = useState<Notice>(null);

  const change = (changes: Partial<Settings>) => {
    setNotice(updateSettings(changes) ? null : "unsaved");
  };

  return (
    <ChangeSettingsProvider value={change}>
      <div className="space-y-6">
        <SettingCard
          title="Sidebar"
          description="The menu on the left. Changes wide screens only: on a phone it opens from the menu button instead."
        >
          <Switch
            checked={settings.sidebarCollapsed}
            onChange={(checked) => change({ sidebarCollapsed: checked })}
            label="Keep the sidebar small"
            detail="Shrinks it to a column of icons, so cases get more room. Point at an icon to see its name."
          />
        </SettingCard>

        <SettingCard
          title="Beginner mode"
          description="Extra help in the terminal, for when you're new to typing commands."
        >
          <Switch
            checked={settings.beginnerMode}
            onChange={(checked) => change({ beginnerMode: checked })}
            label="Show beginner help in the terminal"
            detail="Explains every error in plain words underneath it, and suggests commands to try. Turn it off for a cleaner screen."
          />
        </SettingCard>

        {children}

        <SettingCard
          title="Animations"
          description="Ticks, sparkles and other moving effects. Turning them down never hides anything."
        >
          <RadioGroup
            legend="How much should move on screen?"
            value={settings.reducedMotionOverride}
            options={MOTION_OPTIONS}
            onChange={(value) => change({ reducedMotionOverride: value })}
          />
        </SettingCard>

        <SettingCard
          title="Anonymous counts"
          description="Counts like “a case was opened” or “a step was ticked”, added up so we can find the parts that are too hard. Never anything you type, and nothing that says who you are."
        >
          <Switch
            checked={settings.usageCounts}
            onChange={(checked) => change({ usageCounts: checked })}
            label="Send anonymous usage counts"
            detail="Off sends nothing at all. If your browser asks websites not to track it (Do Not Track or Global Privacy Control), nothing is sent either way. The “What we store” page has the details."
          />
        </SettingCard>

        <SettingCard
          title="Start fresh"
          description="Puts every setting on this page back to how it started."
        >
          <Button
            variant="secondary"
            onClick={() => setNotice(resetSettings() ? "reset" : "reset-unsaved")}
          >
            Reset settings
          </Button>
        </SettingCard>

        <p role="status" className="min-h-6 text-base leading-7 text-secondary">
          {notice && NOTICE_TEXT[notice]}
        </p>
      </div>
    </ChangeSettingsProvider>
  );
}
