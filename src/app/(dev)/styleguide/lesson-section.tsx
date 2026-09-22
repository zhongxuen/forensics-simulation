import { renderLessonBody, TableOfContents } from "@/features/learning/server";
import { Code, Section } from "./styleguide-ui";

/** A lesson body that uses every element lessons render, run through the real pipeline. */
const SAMPLE = `
## The one-sentence version

Every computer has numbered doors called <Term id="port">ports</Term>. A program waiting behind one
is a <Term id="service">service</Term>. Hover over, focus or tap either word to see its
definition.

## How it actually works

When a message arrives, its port number says which program it's for. Type \`netscan\` in a
mission to see which doors a practice computer has open.

### What a scan looks like

\`\`\`console title="Try this"
$ netscan 10.0.0.12
10.0.0.12  22/open  remote login   (simulated)
10.0.0.12  80/open  web server     (simulated)
\`\`\`

\`\`\`http
GET /index.html HTTP/1.1
Host: shop.example
\`\`\`

\`\`\`log
2026-09-13 02:14:07 sshd: failed login for admin from 10.0.0.66
\`\`\`

| Port | Usually runs |
| ---- | ------------ |
| \`22\` | Remote logins |
| \`80\` | A website |

## Common misconceptions

- **"An open port is a weakness."** Not on its own. It's a door someone meant to open.
- **"Closing every port is safest."** Then nothing works, including the things people need.

> Security testers only scan networks they have written permission to test.
`;

export async function LessonSection({ id }: { id: string }) {
  const { content, toc } = await renderLessonBody(SAMPLE, "styleguide sample");

  return (
    <Section
      id={id}
      title="Lesson content"
      intro={
        <>
          A sample lesson body rendered through the real pipeline (<Code>renderLessonBody</Code>):
          prose, <Code>&lt;Term&gt;</Code>, highlighted code themed by{" "}
          <Code>src/styles/code.css</Code>, a table, and the table of contents built from its
          headings.
        </>
      }
    >
      <div className="grid gap-10 rounded-xl border border-subtle p-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="max-w-3xl min-w-0">{content}</div>
        <TableOfContents entries={toc} headingId="styleguide-toc-heading" />
      </div>
    </Section>
  );
}
