import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

/**
 * The security headers and Content Security Policy (md-files/11-testing-security-deployment.md,
 * prompt 11.2). The end-to-end suite checks they arrive on real responses; this checks what each
 * environment gets, so a change that loosens production shows up as a failing line here.
 */

const PRODUCTION = { dev: false, preview: false, https: true };
const directives = (policy: string) =>
  new Map(
    policy.split(";").map((part) => {
      const [name = "", ...sources] = part.trim().split(/\s+/);
      return [name, sources] as const;
    }),
  );

describe("the Content Security Policy", () => {
  it("allows no eval in production, and nothing from another site", () => {
    const policy = contentSecurityPolicy(PRODUCTION);
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toMatch(/https?:\/\/|wss?:/);
    const csp = directives(policy);
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("frame-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.get("connect-src")).toEqual(["'self'"]);
    expect(csp.has("upgrade-insecure-requests")).toBe(true);
  });

  it("allows eval only under `next dev`, for React's error overlay", () => {
    expect(contentSecurityPolicy({ dev: true, preview: false, https: false })).toContain(
      "'unsafe-eval'",
    );
    expect(contentSecurityPolicy({ dev: false, preview: true, https: true })).not.toContain(
      "'unsafe-eval'",
    );
  });

  it("lets previews load the Vercel Toolbar, and nothing else from outside", () => {
    const hosts = contentSecurityPolicy({ dev: false, preview: true, https: true }).match(
      /(?:https|wss):\/\/[^\s;]+/g,
    );
    expect(new Set(hosts)).toEqual(
      new Set([
        "https://vercel.live",
        "https://vercel.com",
        "https://assets.vercel.com",
        "wss://ws-us3.pusher.com",
      ]),
    );
  });

  it("doesn't upgrade requests when served over plain http (a local production server)", () => {
    expect(contentSecurityPolicy({ ...PRODUCTION, https: false })).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});

describe("the security headers", () => {
  it("sends the full set", () => {
    const headers = new Map(securityHeaders(PRODUCTION).map(({ key, value }) => [key, value]));
    expect(headers.get("Strict-Transport-Security")).toMatch(/max-age=\d{8,}; includeSubDomains/);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    for (const feature of ["camera", "microphone", "geolocation", "payment", "browsing-topics"]) {
      expect(headers.get("Permissions-Policy")).toContain(`${feature}=()`);
    }
  });

  it("are what next.config.ts sends, on every path, with no X-Powered-By", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.source).toBe("/:path*");
    const keys = rules[0]!.headers.map((header) => header.key);
    expect(keys).toEqual(securityHeaders(PRODUCTION).map((header) => header.key));
    // Tests run with NODE_ENV=test: the production policy, with no eval.
    const csp = rules[0]!.headers.find((header) => header.key === "Content-Security-Policy");
    expect(csp?.value).not.toContain("unsafe-eval");
  });
});
