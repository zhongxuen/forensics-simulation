import type { ActionOf } from "../types";
import { type ActionContext } from "../world";

/**
 * A request arrives at a web server and is written into its access log, one line per request in
 * the shape web servers have used for decades. The address it came from, the page asked for and
 * the answer given are all on that one line.
 */
export function applyWebRequest(ctx: ActionContext, action: ActionOf<"web-request">): void {
  ctx.log(
    "web-access",
    {
      clientIp: action.clientIp ?? "-",
      method: action.method ?? "GET",
      path: action.path,
      protocol: "HTTP/1.1",
      status: action.status ?? "200",
      bytes: action.bytes ?? "0",
      ...(action.user === undefined ? {} : { user: action.user }),
      ...(action.referer === undefined ? {} : { referer: action.referer }),
      ...(action.userAgent === undefined ? {} : { userAgent: action.userAgent }),
    },
    { what: `${action.method ?? "GET"} ${action.path}` },
  );
}
