import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js": there's no reason to tell anyone what the server runs.
  poweredByHeader: false,
  // Vercel Web Analytics and Speed Insights only exist on a Vercel deployment (their scripts are
  // served from /_vercel/...). Anywhere else, like `pnpm start` on a laptop or in CI, the app
  // doesn't try to load them at all.
  env: { NEXT_PUBLIC_USAGE_COUNTS: process.env.VERCEL === "1" ? "on" : "off" },
  // Security headers and the Content Security Policy on every response (phase 11, prompt 11.2).
  // See src/lib/security-headers.ts for what each one does and why.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          dev: process.env.NODE_ENV === "development",
          preview: process.env.VERCEL_ENV === "preview",
          https: process.env.VERCEL === "1",
        }),
      },
    ];
  },
};

export default nextConfig;
