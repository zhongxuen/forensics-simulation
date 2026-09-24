import {
  getAnthropicRunner,
  handleReviewRequest,
  readMentorConfig,
  toMentorCase,
} from "@/features/mentor/server";
import { getCase } from "@/features/cases/server";

/**
 * POST /api/mentor/review — "Looking back with Noor" on the debrief (docs/plan/14-mentor.md §Spec).
 *
 * Stateless, with the same caps, delimiting, output checks and metadata-only log line as the other
 * mentor routes. It answers with JSON (`{ mode: "model", review }` or `{ mode: "fallback", reason }`)
 * rather than a stream, because every sentence is checked before any of it is shown; on a fallback
 * (or the Vercel Firewall rate limit on /api/mentor/*) the client shows the template review built
 * from the run's facts.
 *
 * The body is ids, counts and the **shape of the chain of custody** — each entry's kind, in order,
 * and whether a hash came before anything opened the evidence. No digest, path, record number, ref
 * or report answer travels in either direction: a player can go straight back and change their
 * report from the debrief, so an answer given here would still be an answer given.
 *
 * next.config.ts traces the case files into this function's bundle, as for the hint route.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = readMentorConfig();
  const runner = config.apiKey && !config.disabled ? getAnthropicRunner(config.apiKey) : undefined;

  return handleReviewRequest(request, {
    config,
    // The case is projected down to its objectives and hints before the handler ever sees it,
    // so the answer key is not in scope below this line (src/features/mentor/case-view.ts).
    getCase: (id) => {
      const entry = getCase(id);
      return entry ? toMentorCase(entry) : undefined;
    },
    ...(runner ? { runner } : {}),
  });
}
