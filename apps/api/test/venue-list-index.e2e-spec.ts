import { PrismaClient } from "@prisma/client";

// DENETIM-RAPORU Orta: category/price/boutique list filters had no index support. Measured on a rolled-back
// 5k/50k-row benchmark (see docs/superpowers/plans/2026-09-21-api-hardening.md A7): the composite index below
// takes the district list query (`status='PUBLISHED' AND districtId=? ORDER BY createdAt DESC, id DESC`) from
// 7.7 ms to 0.07 ms at 50k rows by removing the sort and letting LIMIT stop early. A separate
// (status, category) index was measured and NOT added: it only helps the district-less category query the
// apps never issue.
describe("Venue list composite index", () => {
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = new PrismaClient();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("exists with the column order and sort direction the keyset list query needs", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'Venue' AND indexname = 'Venue_status_districtId_createdAt_id_idx'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain('("status", "districtId", "createdAt" DESC, id DESC)'.replace('"status"', "status"));
  });

  // `prisma migrate dev` cannot see this PostGIS GiST index (Unsupported("geography") column) and proposes
  // DROP INDEX for it every time it generates a migration. Losing it silently turns every radius/distance
  // query into a sequential scan.
  it("still has the PostGIS GiST index on location (Prisma wrongly proposes dropping it)", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'Venue' AND indexname = 'Venue_location_idx'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef.toLowerCase()).toContain("using gist");
  });
});
