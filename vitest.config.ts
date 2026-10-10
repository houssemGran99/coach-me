import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const p = (...s: string[]) => path.join(root, ...s);

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: p("test-support/server-only.ts") },
      { find: /^@mourabbi\/schemas$/, replacement: p("packages/schemas/src/index.ts") },
      { find: /^@mourabbi\/animation\/core$/, replacement: p("packages/animation/src/core.ts") },
      { find: /^@mourabbi\/animation\/validate$/, replacement: p("packages/animation/src/validate.ts") },
      { find: /^@mourabbi\/animation\/static$/, replacement: p("packages/animation/src/static.tsx") },
      { find: /^@mourabbi\/animation\/authoring$/, replacement: p("packages/animation/src/authoring.ts") },
      { find: /^@mourabbi\/animation$/, replacement: p("packages/animation/src/index.ts") },
      { find: /^@\/(.*)$/, replacement: p("apps/web") + "/$1" },
    ],
  },
  test: {
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/web/**/*.test.ts",
      "scripts/**/*.test.ts",
      "data/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
    environment: "node",
  },
});
