import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7's CLI no longer auto-loads a `.env` file next to schema.prisma (Prisma 5 did, and
// apps/api/.env.example documents `cp .env.example .env` as the local-dev workflow -- verified
// empirically: without this, `prisma migrate status`/`migrate dev` fail with "datasource.url
// property is required" even with a real apps/api/.env present). `process.loadEnvFile()` (Node
// 22, pinned via .nvmrc) only sets variables that aren't already in the environment, so it can't
// override CI's/production's real DATABASE_URL -- silently skipped if no `.env` file exists
// (fresh install, CI, production), which is the common case this config also has to support.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // No .env file -- expected in CI/production, where the real env vars are already set.
}

// `datasource.url` is intentionally read from `process.env` directly (not the `env()` helper,
// which throws at config-load time if unset) -- `prisma generate` runs in `postinstall`, before
// DATABASE_URL is available (CI sets it only for the later `migrate deploy`/`test` steps; the
// helper's hard failure would break every fresh install). `migrate`/`introspect` still need the
// real value and get it from the environment those commands are actually invoked with.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL },
  migrations: { seed: "ts-node prisma/seed.ts" },
});
