import { MAX_REQUEST_BODY_BYTES, MODEL_TIMEOUT_MS, type MentorConfig } from "./config";
import type { MentorModelRunner } from "./model";
import type { HintPrompt } from "./prompt-builder";
import {
  MENTOR_MODE_HEADER,
  MENTOR_STREAM_CONTENT_TYPE,
  type ExplainSubject,
  type ExplainView,
  type MentorFallbackReason,
  type MentorKind,
  type MentorStreamEvent,
} from "./protocol";
import { validateMentorOutput } from "./validate";

/**
 * What every mentor route shares (docs/plan/14-mentor.md): reading
 * a capped body, the one metadata-only log line per request, the fallback responses, and streaming
 * validated model text. No state lives here between requests.
 *
 * STREAMING vs VALIDATE-BEFORE-SEND. These pull in opposite directions: streaming wants to release
 * text as it arrives, but nothing unvalidated may reach the client. The resolution: accumulate the
 * whole response, re-validate the entire buffer on every chunk, and release only *completed*
 * sentences (the in-progress tail is held back). A payload that only completes in the unreleased tail
 * still fails validation and forces a fallback before its sentence is released. A late rejection
 * (after some sentences were shown) sends a `fallback` event, and the client discards what it showed
 * and swaps to the authored text. The cost is that a reply may briefly show a sentence that a later
 * rejection retracts — acceptable, because the mentor is an enhancement and the authored text always
 * wins.
 *
 * LOGGING. Exactly one structured line per request, metadata only — never the transcript or any
 * player text. When validation rejects a response, the rejected model text is logged, truncated, so
 * it can be reviewed. It is the only record a mentor request leaves anywhere.
 */

export interface MentorLogEntry {
  readonly feature: "mentor";
  /** Which of the mentor's jobs: a hint, an explanation, or a post-case review. */
  readonly kind: MentorKind;
  readonly promptVersion: string;
  readonly caseId?: string;
  readonly objectiveId?: string;
  readonly tier?: number;
  /** For an explanation: which surface the player pointed at. */
  readonly view?: ExplainView;
  /** For an explanation: what kind of thing it was. */
  readonly subject?: ExplainSubject["kind"];
  readonly model?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly fallback: boolean;
  readonly fallbackReason?: MentorFallbackReason;
  readonly validationRejected: boolean;
  /** Only set when validation rejected the model text: the rejected text, truncated. Never player text. */
  readonly rejectedText?: string;
}

export type MentorLog = (entry: MentorLogEntry) => void;

/** The fields every log line for one request shares. */
export type LogBase = Pick<
  MentorLogEntry,
  "kind" | "promptVersion" | "caseId" | "objectiveId" | "tier" | "view" | "subject" | "model"
>;

/** One JSON line to the server console. Vercel's runtime logs collect it; we store nothing ourselves. */
export function defaultLog(entry: MentorLogEntry): void {
  console.log(JSON.stringify(entry));
}

/** How much of a rejected model response to log, in characters. */
const REJECTED_LOG_CHARS = 300;

const encoder = new TextEncoder();

export function truncateForLog(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= REJECTED_LOG_CHARS
    ? trimmed
    : `${trimmed.slice(0, REJECTED_LOG_CHARS)}…`;
}

function eventText(event: MentorStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

const RESPONSE_HEADERS = { "cache-control": "no-store" } as const;

export type BodyRead =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly reason: MentorFallbackReason; readonly status: number };

/**
 * Whether the request came from a page on another site (docs/plan/15-quality-and-launch.md,
 * prompt 11.2). The app's own pages are the only callers, so anything else is refused before a
 * model call: otherwise any website could make its visitors' browsers spend the mentor's budget.
 * Browsers say where a request came from in `Sec-Fetch-Site` (and `Origin`); tools that send
 * neither, like curl, are left to the rate limit.
 */
export function isCrossSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") return true;
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true;
  }
  const hosts = [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
    new URL(request.url).host,
  ];
  return !hosts.includes(originHost);
}

/**
 * Reads at most `limit` bytes of the body. Returns undefined as soon as it's over, without reading
 * the rest, so a huge body (or one sent in chunks with no Content-Length) is never held in memory.
 */
async function readCapped(request: Request, limit: number): Promise<string | undefined> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Reads the body as JSON, refusing before any parsing: a request from another site (403), one
 * that isn't JSON (415: a JSON content type also means a cross-origin browser has to ask first,
 * and this route never says yes), and one over the size cap (413), checked on the declared length
 * and again on the bytes as they arrive.
 */
export async function readJsonBody(request: Request): Promise<BodyRead> {
  if (isCrossSite(request)) return { ok: false, reason: "cross_site", status: 403 };
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(?:;|$)/i.test(type)) {
    return { ok: false, reason: "invalid_request", status: 415 };
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BODY_BYTES) {
    return { ok: false, reason: "request_too_large", status: 413 };
  }
  const body = await readCapped(request, MAX_REQUEST_BODY_BYTES);
  if (body === undefined) return { ok: false, reason: "request_too_large", status: 413 };
  try {
    return { ok: true, data: JSON.parse(body) };
  } catch {
    return { ok: false, reason: "invalid_request", status: 400 };
  }
}

/** Logs a fallback that happened before any model call. */
function logFallback(log: MentorLog, base: LogBase, reason: MentorFallbackReason): void {
  log({
    feature: "mentor",
    ...base,
    fallback: true,
    fallbackReason: reason,
    validationRejected: false,
  });
}

/** A single-event NDJSON response for the text routes' paths that fall back before any model call. */
export function streamFallbackResponse(
  reason: MentorFallbackReason,
  status: number,
  log: MentorLog,
  base: LogBase,
): Response {
  logFallback(log, base, reason);
  return new Response(eventText({ type: "fallback", reason }), {
    status,
    headers: {
      "content-type": MENTOR_STREAM_CONTENT_TYPE,
      [MENTOR_MODE_HEADER]: "fallback",
      ...RESPONSE_HEADERS,
    },
  });
}

/** A JSON response, for the review route. */
export function jsonResponse(body: unknown, mode: "model" | "fallback", status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      [MENTOR_MODE_HEADER]: mode,
      ...RESPONSE_HEADERS,
    },
  });
}

/** The review route's fallback: `{ mode: "fallback", reason }`, and the client shows the template. */
export function jsonFallbackResponse(
  reason: MentorFallbackReason,
  status: number,
  log: MentorLog,
  base: LogBase,
): Response {
  logFallback(log, base, reason);
  return jsonResponse({ mode: "fallback", reason }, "fallback", status);
}

/** Whether the config allows a model call at all. Nothing reveals which of the two it was. */
export function modelAvailable(
  config: MentorConfig,
  runner: MentorModelRunner | undefined,
): runner is MentorModelRunner {
  return !config.disabled && Boolean(config.apiKey) && runner !== undefined;
}

/**
 * The greatest index in `text` (beyond `from`) that ends a completed sentence: a `.`/`!`/`?`
 * (with an optional closing quote or bracket) followed by whitespace, or a newline. The in-progress
 * final sentence, which has no trailing whitespace yet, is held back until the stream ends.
 */
function lastReleasableIndex(text: string, from: number): number {
  const re = /[.!?]["')\]]?(?=\s)|\n/g;
  let index = from;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const end = match.index + match[0].length;
    if (end > from) index = end;
  }
  return index;
}

export interface StreamModelTextOptions {
  readonly config: MentorConfig;
  readonly runner: MentorModelRunner;
  readonly prompt: HintPrompt;
  readonly maxTokens: number;
  readonly log: MentorLog;
  readonly base: LogBase;
}

/**
 * Calls the model and streams its text as NDJSON (`text` / `done` / `fallback`), validating before
 * releasing, and logs exactly once when it ends.
 */
export function streamModelText({
  config,
  runner,
  prompt,
  maxTokens,
  log,
  base,
}: StreamModelTextOptions): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: MentorStreamEvent) =>
        controller.enqueue(encoder.encode(eventText(event)));
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), MODEL_TIMEOUT_MS);

      let full = "";
      let released = 0;
      let fallbackReason: MentorFallbackReason | undefined;
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;

      try {
        const run = runner(
          {
            model: config.model,
            system: prompt.system,
            messages: prompt.messages,
            maxTokens,
          },
          abort.signal,
        );
        for await (const delta of run) {
          full += delta;
          if (!validateMentorOutput(full).ok) {
            fallbackReason = "validation_rejected";
            break;
          }
          const boundary = lastReleasableIndex(full, released);
          if (boundary > released) {
            send({ type: "text", text: full.slice(released, boundary) });
            released = boundary;
          }
        }

        if (fallbackReason === undefined) {
          if (!validateMentorOutput(full).ok) {
            fallbackReason = "validation_rejected";
          } else if (full.trim() === "") {
            fallbackReason = "empty_output";
          } else {
            if (released < full.length) send({ type: "text", text: full.slice(released) });
            send({ type: "done" });
          }
        }
        if (fallbackReason !== undefined) send({ type: "fallback", reason: fallbackReason });

        try {
          const usage = await run.usage();
          inputTokens = usage.inputTokens;
          outputTokens = usage.outputTokens;
        } catch {
          // Usage is best-effort; a broken/aborted run just logs without token counts.
        }
      } catch {
        fallbackReason = "model_error";
        send({ type: "fallback", reason: "model_error" });
      } finally {
        clearTimeout(timer);
        const rejected = fallbackReason === "validation_rejected";
        log({
          feature: "mentor",
          ...base,
          model: config.model,
          inputTokens,
          outputTokens,
          fallback: fallbackReason !== undefined,
          fallbackReason,
          validationRejected: rejected,
          ...(rejected ? { rejectedText: truncateForLog(full) } : {}),
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": MENTOR_STREAM_CONTENT_TYPE,
      [MENTOR_MODE_HEADER]: "model",
      ...RESPONSE_HEADERS,
    },
  });
}
