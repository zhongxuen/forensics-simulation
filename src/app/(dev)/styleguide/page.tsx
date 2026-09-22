import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { auditContrast } from "@/lib/contrast-audit";
import { customPropertiesIn } from "@/lib/css-custom-properties";
import { cx } from "@/lib/cx";
import { CelebrationsSection } from "./celebrations-section";
import { ContrastSection } from "./contrast-section";
import { LessonComponentsSection } from "./lesson-components-section";
import { LessonSection } from "./lesson-section";
import { MotionToggle } from "./motion-toggle";
import { PrimitivesSection } from "./primitives-section";
import { SpacingScaleSection, TypeScaleSection } from "./scales-section";
import { ShellSection } from "./shell-section";
import { STYLEGUIDE_LINK } from "./styleguide-ui";

export const metadata: Metadata = {
  title: "Styleguide – Candlewright: Incident Room",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  { id: "primitives", label: "Primitives" },
  { id: "celebrations", label: "Beginner and celebration" },
  { id: "shell", label: "App shell" },
  { id: "lesson", label: "Lesson content" },
  { id: "lesson-components", label: "Lesson components" },
  { id: "type-scale", label: "Type scale" },
  { id: "spacing-scale", label: "Spacing scale" },
  { id: "contrast", label: "Contrast audit" },
] as const;

/**
 * Only called in development. The ignore comment stops Turbopack tracing the whole project into the
 * production server bundle for a read that never happens there.
 */
function readProjectFile(path: string): string {
  return readFileSync(join(/* turbopackIgnore: true */ process.cwd(), path), "utf8");
}

/**
 * Every component in every state, the type and spacing scales, and a contrast audit of the colour
 * tokens (md-files/02-design-system-and-app-shell.md). A developer tool: a 404 in production.
 *
 * Values are read from the stylesheets themselves, so this page can't drift from what ships:
 * colour tokens from src/styles/tokens.css, type and spacing from Tailwind's default theme.
 */
export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  const tokens = customPropertiesIn(readProjectFile("src/styles/tokens.css"), ":root");
  const tailwindTheme = customPropertiesIn(
    readProjectFile("node_modules/tailwindcss/theme.css"),
    "@theme default",
  );
  const audit = auditContrast(tokens);
  const rows = audit.flatMap((group) => group.rows);
  const failures = rows.filter((row) => !row.passes).length;

  return (
    <div className="flex-1 bg-surface-base text-primary">
      <header className="border-b border-subtle bg-surface-raised">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
          <p className="font-mono text-sm text-muted">Developer page · not in production builds</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Styleguide</h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-secondary">
            Every component in every state, the type and spacing scales, and a contrast check on
            every colour pair.
          </p>

          <div className="mt-6 max-w-2xl">
            <MotionToggle />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <nav aria-label="Styleguide sections">
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className={STYLEGUIDE_LINK}>
                      {section.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <a
              href="#contrast"
              className={cx(
                "rounded-md border px-2.5 py-1 text-sm font-semibold",
                failures === 0
                  ? "border-status-success text-status-success"
                  : "border-status-danger text-status-danger",
                FOCUS_RING,
              )}
            >
              {failures === 0
                ? `Contrast: all ${rows.length} pairs pass`
                : `Contrast: ${failures} of ${rows.length} pairs fail`}
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-20 px-4 py-12 sm:px-6 lg:px-10">
        <PrimitivesSection id="primitives" />
        <CelebrationsSection id="celebrations" />
        <ShellSection id="shell" />
        <LessonSection id="lesson" />
        <LessonComponentsSection id="lesson-components" />
        <TypeScaleSection id="type-scale" theme={tailwindTheme} />
        <SpacingScaleSection id="spacing-scale" theme={tailwindTheme} />
        <ContrastSection id="contrast" groups={audit} />
      </main>
    </div>
  );
}
