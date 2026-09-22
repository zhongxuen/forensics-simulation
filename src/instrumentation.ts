import type { Instrumentation } from "next";

/**
 * Server error tracking (md-files/11-testing-security-deployment.md, prompt 11.4). Next.js calls
 * this for every error it catches on the server; it writes one JSON line to the server log, which
 * Vercel keeps with the deployment's runtime logs (and Observability charts). There is no
 * third-party error service: nothing about a learner leaves Vercel.
 *
 * Metadata only, like the mentor's own log line: where it happened, the error's kind and digest
 * (which the error screen shows the learner, so a report can be matched to its line). A route
 * handler's error message is left out, because the mentor routes are the only place learner text
 * reaches the server, and it must never be logged. Paths are logged without their query string.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : undefined;
  const name = error instanceof Error ? error.name : typeof error;
  const message =
    context.routeType === "route" || !(error instanceof Error)
      ? undefined
      : error.message.slice(0, 200);
  console.error(
    JSON.stringify({
      feature: "server-error",
      method: request.method,
      path: request.path.split("?")[0],
      routePath: context.routePath,
      routeType: context.routeType,
      name,
      digest,
      ...(message !== undefined && { message }),
    }),
  );
};
