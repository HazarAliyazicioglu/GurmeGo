-- Composite index for the keyset-paginated district list query:
--   status = 'PUBLISHED' AND "districtId" = ? ORDER BY "createdAt" DESC, id DESC
-- Measured on a rolled-back benchmark (50k rows): 7.7 ms -> 0.07 ms (sort removed, LIMIT stops early).
--
-- NOTE: `prisma migrate dev` also proposed `DROP INDEX "Venue_location_idx"`. That is the PostGIS GiST
-- index on the `location` geography column (created by raw SQL in the init migration, ADR 002). Prisma cannot
-- model it (`Unsupported("geography")`), so it reports it as drift. It MUST NOT be dropped: every
-- distance/radius query relies on it. The DROP was removed from this migration deliberately.

-- CreateIndex
CREATE INDEX "Venue_status_districtId_createdAt_id_idx" ON "Venue"("status", "districtId", "createdAt" DESC, "id" DESC);
