/**
 * The lesson prerequisite graph: which lessons are worth reading before which. Pure, over the
 * lessons' frontmatter, so the loader, the reading order and the tests all agree.
 *
 * Prerequisites are a recommendation, never a gate (nothing is saved, so nothing can be locked).
 * The graph still has to be acyclic, or "read this first" would send a reader round in circles.
 */

export interface LessonNode {
  readonly id: string;
  readonly prerequisites: readonly string[];
}

export interface PrerequisiteGraph {
  /** Every lesson id, in a reading order where each lesson comes after its prerequisites. */
  readonly order: readonly string[];
  /** Direct prerequisites of a lesson, as written. */
  prerequisitesOf(id: string): readonly string[];
  /** Every lesson worth reading before this one, nearest first, without repeats. */
  allPrerequisitesOf(id: string): readonly string[];
  /** Lessons that list this one as a direct prerequisite. */
  dependentsOf(id: string): readonly string[];
  /** Each loop of lessons that require each other, as the ids around the loop. Empty when sound. */
  readonly cycles: readonly (readonly string[])[];
}

/**
 * Builds the graph. Prerequisites that name a missing lesson are ignored here (the dead-reference
 * check reports them). `nodes` order breaks ties in the reading order, so pass lessons sorted the
 * way they should appear.
 */
export function buildPrerequisiteGraph(nodes: readonly LessonNode[]): PrerequisiteGraph {
  const ids = new Set(nodes.map((node) => node.id));
  const prerequisites = new Map<string, readonly string[]>(
    nodes.map((node) => [node.id, node.prerequisites.filter((id) => ids.has(id))]),
  );
  const dependents = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const node of nodes) {
    for (const prerequisite of prerequisites.get(node.id) ?? []) {
      dependents.get(prerequisite)?.push(node.id);
    }
  }

  // Depth-first: emit a lesson once all its prerequisites are out. A lesson met again while it's
  // still on the stack closes a loop.
  const order: string[] = [];
  const cycles: string[][] = [];
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const visit = (id: string) => {
    const seen = state.get(id);
    if (seen === "done") return;
    if (seen === "visiting") {
      cycles.push([...stack.slice(stack.indexOf(id)), id]);
      return;
    }
    state.set(id, "visiting");
    stack.push(id);
    for (const prerequisite of prerequisites.get(id) ?? []) visit(prerequisite);
    stack.pop();
    state.set(id, "done");
    order.push(id);
  };
  for (const node of nodes) visit(node.id);

  const allPrerequisitesOf = (id: string): readonly string[] => {
    const result: string[] = [];
    const seen = new Set<string>([id]);
    let frontier = [...(prerequisites.get(id) ?? [])];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const prerequisite of frontier) {
        if (seen.has(prerequisite)) continue;
        seen.add(prerequisite);
        result.push(prerequisite);
        next.push(...(prerequisites.get(prerequisite) ?? []));
      }
      frontier = next;
    }
    return result;
  };

  return {
    order,
    prerequisitesOf: (id) => prerequisites.get(id) ?? [],
    allPrerequisitesOf,
    dependentsOf: (id) => dependents.get(id) ?? [],
    cycles,
  };
}
