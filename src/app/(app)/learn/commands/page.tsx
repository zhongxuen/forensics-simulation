import type { Metadata } from "next";
import Link from "next/link";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import { ManPage } from "@/features/learning";
import { getLesson } from "@/features/learning/server";
import { cx } from "@/lib/cx";
import { defaultRegistry, listTools, TOOL_CATEGORIES, TOOL_CATEGORY_LABELS } from "@/sim";

export const metadata: Metadata = {
  title: "Command manual",
  description: "Every command in Incident Room's terminal, with its manual page.",
};

const LINK = cx("rounded-sm font-mono font-medium text-accent hover:underline", FOCUS_RING);

/**
 * Every command's manual page on one page, grouped by what you'd use it for: where search results
 * and the reference drawer's command links land. The same pages `man` prints.
 */
export default function CommandManualPage() {
  const tools = listTools();
  const groups = TOOL_CATEGORIES.map((category) => ({
    category,
    label: TOOL_CATEGORY_LABELS[category],
    tools: tools.filter((tool) => tool.category === category),
  })).filter((group) => group.tools.length > 0);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-secondary">
        <Link
          href="/learn"
          className={cx("rounded-sm font-medium text-accent hover:underline", FOCUS_RING)}
        >
          Learn
        </Link>
        <span aria-hidden="true"> / </span>
        Command manual
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Every command, and what it does
      </h1>
      <p className="mt-4 text-lg leading-8 text-secondary">
        These are the manual pages the terminal shows when you type{" "}
        <code className="font-mono text-primary">man</code> and a command&apos;s name. Every tool
        here is simulated: it only works on Incident Room&apos;s practice workstation and evidence.
      </p>
      <SimulatedBadge className="mt-4" />

      <nav
        aria-labelledby="command-index"
        className="mt-8 rounded-xl border border-subtle bg-surface-raised p-5"
      >
        <h2 id="command-index" className="text-sm font-semibold tracking-wide text-secondary">
          Jump to a command
        </h2>
        <div className="mt-3 space-y-3">
          {groups.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                {group.label}
              </h3>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {group.tools.map((tool) => (
                  <li key={tool.name}>
                    <a href={`#${tool.name}`} className={LINK}>
                      {tool.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="mt-10 space-y-12">
        {groups.map((group) => (
          <section key={group.category} aria-labelledby={`group-${group.category}`}>
            <h2 id={`group-${group.category}`} className="text-2xl font-semibold tracking-tight">
              {group.label}
            </h2>
            <div className="mt-4 space-y-8">
              {group.tools.map((tool) => (
                <section
                  key={tool.name}
                  id={tool.name}
                  aria-labelledby={`command-${tool.name}`}
                  className="scroll-mt-24"
                >
                  <h3 id={`command-${tool.name}`} className="font-mono text-lg font-semibold">
                    {tool.name}
                  </h3>
                  <p className="mt-1 leading-7 text-secondary">
                    {tool.summary.charAt(0).toUpperCase() + tool.summary.slice(1)}
                  </p>
                  <ManPage name={tool.name} className="mt-3" />
                  <LessonLink name={tool.name} />
                </section>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** The lesson a command's manual page points at, as a link, when it has one. */
function LessonLink({ name }: { name: string }) {
  const id = defaultRegistry.get(name)?.help.lesson;
  const lesson = id === undefined ? undefined : getLesson(id);
  if (!lesson) return null;
  return (
    <p className="mt-2 leading-7 text-secondary">
      The lesson behind it:{" "}
      <Link
        href={`/learn/${lesson.id}`}
        className={cx("rounded-sm font-medium text-accent hover:underline", FOCUS_RING)}
      >
        {lesson.title}
      </Link>
    </p>
  );
}
