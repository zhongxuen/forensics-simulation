import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";
import { Annotated, MiniTerminal, PacketDiagram, Quiz } from "../components/lesson-mdx";
import { Term } from "../glossary/term";

/**
 * How lesson MDX renders: prose styled with the design tokens, highlighted code blocks, and the
 * components a lesson may use: <Term>, and the interactive ones from prompt 09.2 (<Quiz>,
 * <MiniTerminal>, <PacketDiagram>, <Annotated>). <TryIt> was left out when this was vendored: it
 * read the mission catalog (VENDORED.md).
 */

/** How each highlighted language is labelled above its code block. */
const LANGUAGE_LABELS: Readonly<Record<string, string>> = {
  shellscript: "shell",
  bash: "shell",
  sh: "shell",
  shell: "shell",
  console: "terminal",
  http: "HTTP",
  json: "JSON",
  html: "HTML",
  javascript: "JavaScript",
  js: "JavaScript",
  sql: "SQL",
  log: "log",
  yaml: "YAML",
  ini: "config",
  python: "Python",
  diff: "changes",
};

type CodeBlockProps = ComponentPropsWithoutRef<"pre"> & {
  "data-language"?: string;
  "data-title"?: string;
};

function LessonCodeBlock({
  children,
  "data-language": language,
  "data-title": title,
}: CodeBlockProps) {
  const label =
    language === undefined || language === "text"
      ? undefined
      : (LANGUAGE_LABELS[language] ?? language);

  return (
    <div className="mt-6 rounded-lg border border-subtle bg-surface-raised">
      {(title !== undefined || label !== undefined) && (
        <div className="flex items-center gap-3 border-b border-subtle px-4 py-1.5">
          {title !== undefined && (
            <span className="text-sm font-medium text-secondary">{title}</span>
          )}
          {label !== undefined && (
            <span className="ml-auto font-mono text-xs text-muted">{label}</span>
          )}
        </div>
      )}
      <pre
        // Scrolls sideways, so keyboard users need to be able to focus it.
        tabIndex={0}
        aria-label={title ?? (label !== undefined ? `${label} example` : "Example")}
        className="overflow-x-auto px-4 py-3 font-mono text-sm leading-6 text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
      >
        {children}
      </pre>
    </div>
  );
}

function LessonCode({
  className,
  "data-code-block": codeBlock,
  ...props
}: ComponentPropsWithoutRef<"code"> & { "data-code-block"?: string }) {
  // Inside a code block, LessonCodeBlock does the styling.
  if (codeBlock !== undefined) return <code className={className} {...props} />;
  return (
    <code
      className="rounded-md border border-subtle bg-surface-raised px-1.5 py-0.5 font-mono text-[0.875em] text-primary"
      {...props}
    />
  );
}

function LessonLink({ href = "", children, ...props }: ComponentPropsWithoutRef<"a">) {
  const className = cx(
    "rounded-sm font-medium text-accent underline underline-offset-4 hover:text-accent-hover",
    FOCUS_RING,
  );
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} className={className} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} target="_blank" rel="noreferrer" {...props}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export const LESSON_COMPONENTS: MDXComponents = {
  h2: ({ className, ...props }) => (
    <h2
      className={cx(
        "mt-12 scroll-mt-24 text-2xl font-semibold tracking-tight text-balance text-primary first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cx("mt-8 scroll-mt-24 text-xl font-semibold text-balance text-primary", className)}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={cx("mt-6 scroll-mt-24 font-semibold text-primary", className)} {...props} />
  ),
  p: (props) => <p className="mt-4 text-lg leading-8 text-pretty text-primary" {...props} />,
  a: LessonLink,
  ul: (props) => (
    <ul
      className="mt-4 list-disc space-y-2 pl-6 text-lg leading-8 text-primary marker:text-muted"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mt-4 list-decimal space-y-2 pl-6 text-lg leading-8 text-primary marker:text-muted"
      {...props}
    />
  ),
  li: (props) => <li className="pl-1 [&>p]:mt-2" {...props} />,
  strong: (props) => <strong className="font-semibold text-primary" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="mt-6 border-l-4 border-strong pl-4 text-secondary [&>p]:text-secondary"
      {...props}
    />
  ),
  hr: () => <hr className="my-10 border-subtle" />,
  table: (props) => (
    <div className="mt-6 overflow-x-auto rounded-lg border border-subtle">
      <table className="w-full border-collapse text-left" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-b border-strong bg-surface-raised px-4 py-2 text-sm font-semibold text-primary"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border-b border-subtle px-4 py-2 align-top leading-7 text-primary" {...props} />
  ),
  code: LessonCode,
  pre: LessonCodeBlock,
  Term,
  Quiz,
  MiniTerminal,
  PacketDiagram,
  Annotated,
};
