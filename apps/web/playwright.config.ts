import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Task 0's dev script runs on -p 3002 (apps/api occupies 3000/3001 locally) — must match, not Next's default.
  use: { baseURL: "http://localhost:3002" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3002",
    reuseExistingServer: true,
  },
});
