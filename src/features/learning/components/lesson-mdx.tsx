import {
  AnnotatedSchema,
  MiniTerminalSchema,
  PacketDiagramSchema,
  parseComponentProps,
  QuizSchema,
} from "@/content/schemas/lesson-components";
import { AnnotatedView } from "./annotated";
import { LazyMiniTerminal } from "./mini-terminal-lazy";
import { PacketDiagramView } from "./packet-diagram";
import { QuizView } from "./quiz";

/**
 * The interactive lesson components as MDX sees them (md-files/09-learning-center.md, prompt
 * 09.2). Each one is a server component that validates the props written in the lesson against
 * its schema (src/content/schemas/lesson-components.ts), then renders the interactive client
 * view. A mistake throws with a message naming every problem, and CI renders every lesson, so a
 * broken component never ships: a quiz option without an explanation, say, fails the build.
 */

export function Quiz(props: unknown) {
  return <QuizView quiz={parseComponentProps("Quiz", QuizSchema, props)} />;
}

export function MiniTerminal(props: unknown) {
  // Lazy: the terminal and the engine load as the page hydrates, not in its first download.
  return <LazyMiniTerminal {...parseComponentProps("MiniTerminal", MiniTerminalSchema, props)} />;
}

export function PacketDiagram(props: unknown) {
  return (
    <PacketDiagramView {...parseComponentProps("PacketDiagram", PacketDiagramSchema, props)} />
  );
}

export function Annotated(props: unknown) {
  return <AnnotatedView {...parseComponentProps("Annotated", AnnotatedSchema, props)} />;
}
