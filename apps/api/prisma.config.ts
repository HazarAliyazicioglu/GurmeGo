import { defineConfig } from "prisma/config";

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
