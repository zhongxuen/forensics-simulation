/**
 * The HTTP security headers for every response (md-files/11-testing-security-deployment.md,
 * "Security review of this app", Platform; prompt 11.2). next.config.ts sends them; the tests in
 * tests/unit/security-headers.test.ts and the end-to-end suite check what actually arrives.
 *
 * The Content Security Policy is as tight as a statically generated Next.js app allows:
 *
 * - No 'unsafe-eval' outside `next dev` (React needs eval only for its development error
 *   overlay). Nothing in the app evaluates text: terminal input is parsed into data, never run.
 * - Scripts, styles, fonts, images and requests come from this site only. Vercel Web Analytics and
 *   Speed Insights are served from this site too (/_vercel/...), so no third party is allowed.
 * - Scripts and styles keep 'unsafe-inline'. Next.js puts small inline scripts in every page to hand
 *   the pre-rendered page to React, and the settings boot script runs before first paint. The only
 *   way to drop 'unsafe-inline' is a per-request nonce, which would make every page render on the
 *   server for every visit instead of being served as a static file. That trade is written up in
 *   md-files/security-review.md. What keeps inline script safe here instead: no user text ever
 *   reaches dangerouslySetInnerHTML (a test enforces it), MDX is authored only, and React escapes
 *   everything else.
 * - Nothing may frame the app, <object> and <embed> are off, and forms and <base> stay on this site.
 *
 * Preview deployments also allow the Vercel Toolbar (vercel.live), which Vercel adds to previews
 * for comments. Production never does.
 */

export interface SecurityHeaderOptions {
  /** `next dev`: React's dev overlay needs eval, and the dev analytics script comes from Vercel. */
  readonly dev: boolean;
  /** A Vercel preview deployment: the Vercel Toolbar is allowed. */
  readonly preview: boolean;
  /** Served over HTTPS (any Vercel deployment): upgrade any stray http:// request. */
  readonly https: boolean;
}

export interface Header {
  readonly key: string;
  readonly value: string;
}

/** The directives, in order, as `name -> sources`. */
export function contentSecurityPolicy({ dev, preview, https }: SecurityHeaderOptions): string {
  const toolbar = preview ? ["https://vercel.live"] : [];
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    [
      "script-src",
      [
        "'self'",
        "'unsafe-inline'",
        ...(dev ? ["'unsafe-eval'", "https://va.vercel-scripts.com"] : []),
        ...toolbar,
      ],
    ],
    ["style-src", ["'self'", "'unsafe-inline'", ...toolbar]],
    [
      "img-src",
      [
        "'self'",
        "data:",
        "blob:",
        ...(preview ? ["https://vercel.live", "https://vercel.com"] : []),
      ],
    ],
    [
      "font-src",
      ["'self'", ...(preview ? ["https://vercel.live", "https://assets.vercel.com"] : [])],
    ],
    [
      "connect-src",
      [
        "'self'",
        ...(dev ? ["ws:"] : []),
        ...(preview ? ["https://vercel.live", "wss://ws-us3.pusher.com"] : []),
      ],
    ],
    ["frame-src", preview ? ["https://vercel.live"] : ["'none'"]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["media-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  const policy = directives.map(([name, sources]) => `${name} ${sources.join(" ")}`);
  if (https) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Every header, for next.config.ts `headers()`. */
export function securityHeaders(options: SecurityHeaderOptions): Header[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    // Two years, every subdomain, and eligible for the browsers' preload lists.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Other sites learn only that a visitor came from this site, never which page.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Nothing here needs a camera, a microphone, a location or payments, so nothing may ask.
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), midi=(), display-capture=(), browsing-topics=()",
    },
    // For browsers too old for frame-ancestors.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ];
}
