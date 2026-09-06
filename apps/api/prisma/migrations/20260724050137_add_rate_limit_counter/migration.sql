-- CreateTable (UNLOGGED: rate limit counters are ephemeral, no WAL/durability needed;
-- Prisma cannot express UNLOGGED, hand-edited from generated CREATE TABLE)
CREATE UNLOGGED TABLE "rate_limit_counters" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
);
