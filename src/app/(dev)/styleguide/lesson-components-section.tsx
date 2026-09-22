import { renderLessonBody } from "@/features/learning/server";
import { Code, Section } from "./styleguide-ui";

/**
 * Every interactive lesson component (md-files/09-learning-center.md, prompt 09.2), written the
 * way a lesson writes it and run through the real MDX pipeline, so what shows here is what a
 * lesson gets.
 */
const SAMPLE = `
### Quiz

<Quiz
  question="Your team finds an open door into a computer that isn't on the scope letter. What do you do?"
  options={[
    { text: "Test it quickly, since it's already open", explanation: "Open or not, it isn't yours to test. Without the owner's written permission, testing it is a crime." },
    { text: "Stop, write it down, and ask the client", correct: true, explanation: "That's what professionals do: note it, don't touch it, and ask the owner whether they want it added to the scope." },
    { text: "Tell a friend so they can have a look", explanation: "That hands someone else a way in without permission. Anything you find stays between the team and the client." },
  ]}
/>

### MiniTerminal

<MiniTerminal
  scenario="range-home"
  commands={["whoami", "ls", "ls -a"]}
  task="Type \`whoami\` and press Enter."
  expect="whoami"
  success="That's you: \`recruit\`. Every account on a computer has a name."
/>

### PacketDiagram

<PacketDiagram
  title="A message on its way across a network"
  fields={[
    { label: "From", value: "192.168.60.10", size: 2, note: "The sender's address, so the answer can find its way back." },
    { label: "To", value: "192.168.60.20", size: 2, note: "The address of the computer the message is for." },
    { label: "Port", value: "80", note: "Which door on that computer: 80 is usually a website." },
    { label: "Data", value: "GET /", size: 3, note: "What the message actually says. Here, \\"send me your home page\\"." },
  ]}
  caption="Real messages carry more parts than this. These are the ones worth knowing first."
/>

### Annotated

<Annotated
  title="netscan output, line by line"
  code={\`netscan (simulated) · checking 18 common ports on range-web-01
192.168.60.20  range-web-01  up (replied in 0.8 ms)
  PORT    STATE  SERVICE
  22/tcp  open   ssh
  80/tcp  open   http\`}
  notes={[
    { line: 1, label: "What was checked", text: "The tool, the ports it knocked on, and the computer it asked." },
    { line: 2, label: "The computer answered", text: "Its address, its name, and how fast it replied." },
    { line: 4, label: "Port 22 is open", text: "A door for typing commands on the computer from far away." },
    { line: 5, label: "Port 80 is open", text: "A website lives here." },
  ]}
/>
`;

export async function LessonComponentsSection({ id }: { id: string }) {
  const { content } = await renderLessonBody(SAMPLE, "styleguide components");

  return (
    <Section
      id={id}
      title="Lesson components"
      intro={
        <>
          The interactive components a lesson can use, written in MDX and rendered through{" "}
          <Code>renderLessonBody</Code>. Each validates its props (
          <Code>src/content/schemas/lesson-components.ts</Code>), works with the keyboard alone, and
          follows the motion setting above. <Code>&lt;MiniTerminal&gt;</Code> runs the real engine.
        </>
      }
    >
      <div className="max-w-3xl rounded-xl border border-subtle p-6">{content}</div>
    </Section>
  );
}
