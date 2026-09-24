import {
  getAnthropicRunner,
  handleExplainRequest,
  readMentorConfig,
  toMentorCase,
} from "@/features/mentor/server";
import { getCase } from "@/features/cases/server";

/**
 * POST /api/mentor/explain — "Explain this" (docs/plan/14-mentor.md §Spec): Noor explains a
 * terminal line, an error, a command's whole result, a row in the Evidence Browser, an entry on the
 * timeline, a card on the case board, or a glossary word.
 *
 * What travels is the rendered line and, for terminal output, the tool's own man page — never the
 * evidence set, and never the case's answer key (the handler is given a projection that holds
 * neither). Stateless and streaming, exactly like /api/mentor/hint: validated fresh, capped,
 * delimited, output checked before release, one metadata-only log line, and every problem (no key,
 * the kill switch, a bad body, a model failure, a rejected answer, the Vercel Firewall rate limit
 * on /api/mentor/*) becomes a fallback, where the client shows the explanation written ahead of
 * time.
 *
 * next.config.ts traces the case files into this function's bundle, as for the hint route.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = readMentorConfig();
  const runner = config.apiKey && !config.disabled ? getAnthropicRunner(config.apiKey) : undefined;

  return handleExplainRequest(request, {
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
