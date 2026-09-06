import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // tests/e2e holds Playwright specs (test:e2e script) — they use @playwright/test's
    // test(), not vitest's, and must not be collected here.
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
  },
});
