import type { ReactNode } from "react";
import { FOCUS_RING } from "@/components/shell/shell-styles";
import { cx } from "@/lib/cx";

/** The styleguide's own text links. */
export const STYLEGUIDE_LINK = cx(
  "rounded-sm font-medium text-accent underline-offset-4 hover:text-accent-hover hover:underline",
  FOCUS_RING,
);

interface SectionProps {
  id: string;
  title: string;
  /** One or two sentences on what the section shows. */
  intro: ReactNode;
  children: ReactNode;
}

/** A top-level styleguide section, linked from the page's section nav. */
export function Section({ id, title, intro, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8">
      <h2 id={`${id}-title`} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-2 max-w-3xl leading-7 text-secondary">{intro}</div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

/** An inline code name: a token, a class, a file path. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-surface-overlay px-1 py-0.5 font-mono text-[0.9em] text-primary">
      {children}
    </code>
  );
}
