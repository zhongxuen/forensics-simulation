"use client";

import { Tabs } from "@/components/ui/tabs";
import { BROWSER_TABS, type EvidenceBrowserProps } from "../browser-tabs";

/**
 * The Evidence Browser (docs/plan/05-workspace-ui.md §Evidence Browser), modelled on Autopsy: a
 * tree of drives, partitions and folders, a table of records with their MACB times, and a detail
 * view with Text, Hex, Metadata and Real-world equivalent tabs. Every read goes through the
 * engine (`browse`), so the write-blockers apply exactly as they do in the terminal, and pins land
 * on the same case board as the terminal's `pin`.
 *
 * Each view is a tab from BROWSER_TABS; with only one available, it shows without a tab bar.
 */
export function EvidenceBrowser(props: EvidenceBrowserProps) {
  const tabs = BROWSER_TABS.filter((tab) => tab.available(props.evidence));
  if (tabs.length === 0) {
    return (
      <p className="text-secondary">
        There&apos;s nothing here to browse yet: this case has no drives or memory captures.
      </p>
    );
  }
  if (tabs.length === 1) {
    const { Component } = tabs[0] as (typeof tabs)[number];
    return <Component {...props} />;
  }
  return (
    <Tabs
      label="Evidence Browser views"
      tabs={tabs.map(({ id, label, Component }) => ({
        id,
        label,
        content: <Component {...props} />,
      }))}
    />
  );
}
