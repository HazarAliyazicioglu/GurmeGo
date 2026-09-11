// Jest `globalSetup` -- runs once, in a separate process, before any test file. Every e2e-spec
// under `test/*.e2e-spec.ts` calls `prisma.district.findFirstOrThrow()` assuming a District (and
// its parent City) already exists, but nothing -- not CI's `prisma migrate deploy` step, not any
// individual test file -- ever creates one. Against a genuinely empty database (a fresh CI
// Postgres service container, or this repo's local test DB right after `migrate deploy`) every
// e2e-spec except the two that don't touch Venue data fails with "No District found".
//
// Plain CommonJS (not TypeScript): Jest does not run `globalSetup`/`globalTeardown` files through
// its normal ts-jest transform pipeline, so a `.ts` file here would fail to load. `@prisma/client`
// is already a compiled JS package, so no transpilation is needed to use it directly.
const { PrismaClient } = require("@prisma/client");

module.exports = async function globalSetup() {
  const prisma = new PrismaClient();
  try {
    // Idempotent: a developer's local test DB may already have seed data (from `pnpm run seed` or
    // a prior run of this same setup) -- only create the fixture if no District exists yet, so
    // reruns against a persistent local DB don't pile up duplicate cities/districts.
    const existing = await prisma.district.findFirst();
    if (existing) return;
    const suffix = Date.now();
    // Both rows in one transaction: without it, a District-creation failure after the City commits
    // would leave an orphan City behind (cross-model review finding).
    await prisma.$transaction(async (tx) => {
      const city = await tx.city.create({ data: { name: "İstanbul", slug: `istanbul-e2e-${suffix}` } });
      await tx.district.create({ data: { cityId: city.id, name: "Kadıköy", slug: `kadikoy-e2e-${suffix}` } });
    });
  } finally {
    await prisma.$disconnect();
  }
};
