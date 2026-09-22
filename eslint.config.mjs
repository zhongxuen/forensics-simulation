import { readdirSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Top-level folder names inside `dir` (read at lint time, so new ones are covered automatically). */
const subdirs = (dir) =>
  readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const srcDirs = subdirs("./src");
const features = subdirs("./src/features");

// Module boundaries (md-files/01-project-foundation.md). Paths are relative to the repo root;
// `except` paths are relative to `from`.
const boundaryZones = [
  // 1. The simulation engine is pure and isolated: it may only import from itself.
  {
    target: "./src/sim",
    from: "./src",
    except: ["./sim"],
    message:
      "src/sim is the pure simulation engine and may only import from src/sim. Move shared code into src/sim, or invert the dependency.",
  },
  // 2. Content is declarative data: it may only import other content and the engine's types.
  {
    target: "./src/content",
    from: "./src",
    except: ["./content", "./sim/types.ts", "./sim/types"],
    message: "src/content may only import from @/content and @/sim/types.",
  },
  // 3. A feature's internals are private. Everything outside the feature goes through its index.ts,
  //    or its server.ts for server-only code (anything that reads files, say), which client code
  //    must never import.
  ...features.map((feature) => ({
    target: [
      ...srcDirs.filter((dir) => dir !== "features").map((dir) => `./src/${dir}`),
      ...features.filter((other) => other !== feature).map((other) => `./src/features/${other}`),
    ],
    from: `./src/features/${feature}`,
    except: ["./index.ts", "./index.tsx", "./server.ts"],
    message: `Import from "@/features/${feature}" (its index.ts) or "@/features/${feature}/server" (its server.ts), not from its internals.`,
  })),
];

const simPurityMessage =
  "src/sim must stay deterministic: inject time and randomness (seeded RNG + clock) instead.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx,js,jsx,mjs}"],
    rules: {
      "import/no-restricted-paths": ["error", { zones: boundaryZones }],
    },
  },
  {
    files: ["src/sim/**/*.{ts,tsx,js,jsx,mjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react/*", "react-dom", "react-dom/*", "next", "next/*"],
              message: "src/sim is headless: no React or Next.js imports.",
            },
            {
              // Forensics addition (docs/plan/01-foundation.md): hashing runs in the browser too, so
              // the engine uses its own pure hashes. The regex below also catches node:crypto; this
              // entry covers the bare name and says what to use instead.
              group: ["crypto", "node:crypto"],
              message:
                "src/sim can't use Node's crypto: it runs in the browser too. Use the pure-TypeScript hashes in src/sim/evidence/hash/.",
            },
            {
              // A regex on the whole specifier, so the engine's own src/sim/fs and src/sim/net
              // folders ("../fs/tree", "@/sim/net/graph") aren't mistaken for Node's modules.
              regex:
                "^(node:.*|(fs|net|http|https|http2|dgram|dns|tls|child_process|worker_threads)(/.*)?)$",
              message: "src/sim does no I/O: no filesystem, network, or process access.",
            },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: simPurityMessage },
        { object: "Date", property: "now", message: simPurityMessage },
        { object: "performance", property: "now", message: simPurityMessage },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: simPurityMessage,
        },
      ],
      "no-restricted-globals": [
        "error",
        ...[
          "fetch",
          "XMLHttpRequest",
          "WebSocket",
          "localStorage",
          "sessionStorage",
          "indexedDB",
          "window",
          "document",
          // Forensics addition: the Web Crypto global (crypto.subtle, crypto.randomUUID) is async
          // or random, so it's no more usable here than node:crypto.
          "crypto",
        ].map((name) => ({ name, message: "src/sim does no I/O and has no browser globals." })),
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test and report output:
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
