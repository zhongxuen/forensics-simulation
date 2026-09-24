import {
  getAnthropicRunner,
  handleHintRequest,
  readMentorConfig,
  toMentorCase,
} from "@/features/mentor/server";
import { getCase } from "@/features/cases/server";

/**
 * POST /api/mentor/hint — Noor's hint proxy (docs/plan/14-mentor.md).
 *
 * Server-only and stateless: no module-level state remembers a request or a player. Each call is
 * validated fresh, **the authored hint tier is loaded from the case file, never from the request**,
 * and the response streams newline-delimited JSON (`text` / `done` / `fallback`). If anything goes
 * wrong — no API key, the kill switch, a bad or oversized body, an unknown target, a model failure,
 * or a rejected response — the client is told to fall back to the authored hint. Nothing surfaces
 * to the player as an error, and the game is complete without this route ever answering.
 *
 * `toMentorCase` runs before the handler is called, so the case's answer key — every report answer
 * and accepted ref, every objective's check and success line, the story's ground truth — is not on
 * the type anything below this line receives (docs/plan/14 §Spec; src/features/mentor/case-view.ts).
 *
 * Rate limiting is enforced at the edge by a Vercel Firewall rate-limit rule on /api/mentor/* (see
 * docs/runbook.md). A request over the limit is stopped there (429/403) and the client treats that
 * exactly like any other fallback, so an over-limit player still gets the authored hint.
 *
 * The case YAML is read at runtime by getCase, so next.config.ts traces the case files into this
 * function's bundle (outputFileTracingIncludes).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = readMentorConfig();
  const runner = config.apiKey && !config.disabled ? getAnthropicRunner(config.apiKey) : undefined;

  return handleHintRequest(request, {
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
