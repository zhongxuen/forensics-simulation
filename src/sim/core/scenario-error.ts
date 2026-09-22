/**
 * Thrown when a scenario definition is malformed: duplicate host ids, a public IP address, a file
 * owned by a user who doesn't exist, and so on. That's an authoring bug, not something a learner
 * can cause, so it throws instead of returning a typed error. It lists every problem at once.
 */
export class ScenarioError extends Error {
  readonly problems: readonly string[];

  constructor(context: string, problems: readonly string[]) {
    super(`${context}:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    this.name = "ScenarioError";
    this.problems = problems;
  }
}

/** Collects problems, then throws them all together. */
export class ProblemList {
  private readonly items: string[] = [];

  add(problem: string): void {
    this.items.push(problem);
  }

  get size(): number {
    return this.items.length;
  }

  throwIfAny(context: string): void {
    if (this.items.length > 0) throw new ScenarioError(context, this.items);
  }
}
