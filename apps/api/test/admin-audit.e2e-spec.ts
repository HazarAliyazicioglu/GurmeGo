import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";
import { AdminVenuesService } from "../src/admin/venues/admin-venues.service";
import { AdminUsersService } from "../src/admin/users/admin-users.service";
import { AdminQueueService } from "../src/admin/queue/admin-queue.service";
import { BoutiqueService } from "../src/rule-engine/boutique.service";
import { AuditService } from "../src/audit/audit.service";

// ADR 006 v2 B2: every single-record admin action writes its audit row IN THE SAME TRANSACTION (real Postgres).
// Audit rows are append-only by design and are never cleaned up, so each test scopes to a unique targetId.
class FailingAudit extends AuditService {
  async record(): Promise<void> {
    throw new Error("audit store is down");
  }
}

describe("admin actions are audited atomically (real Postgres)", () => {
  let prisma: PrismaClient;
  let repo: VenuesRepository;
  let audit: AuditService;
  let venues: AdminVenuesService;
  let users: AdminUsersService;
  let queue: AdminQueueService;
  const venueIds: string[] = [];
  const userIds: string[] = [];
  const queueIds: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService();
    repo = new VenuesRepository(prisma as unknown as PrismaService);
    audit = new AuditService();
    const p = prisma as unknown as PrismaService;
    venues = new AdminVenuesService(p, new BoutiqueService(), repo, audit);
    users = new AdminUsersService(p, audit);
    queue = new AdminQueueService(p, repo, audit);
  });

  afterEach(async () => {
    await prisma.contributionQueue.deleteMany({ where: { id: { in: queueIds.splice(0) } } });
    const vids = venueIds.splice(0);
    await prisma.contributionQueue.deleteMany({ where: { venueId: { in: vids } } });
    await prisma.venueVersion.deleteMany({ where: { venueId: { in: vids } } });
    await prisma.venue.deleteMany({ where: { id: { in: vids } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const rowsFor = (targetId: string) => prisma.auditLog.findMany({ where: { targetId }, orderBy: { createdAt: "asc" } });

  async function newUser() {
    const id = randomUUID();
    userIds.push(id);
    await prisma.user.create({ data: { id, email: `${id}@audit-e2e.test` } });
    return id;
  }
  async function newVenue(actor = "seed-actor") {
    const district = await prisma.district.findFirstOrThrow();
    const v = await venues.create(
      { name: "Audit Cafe", slug: `audit-${randomUUID()}`, districtId: district.id, category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {}, branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02, status: "DRAFT" },
      actor,
    );
    venueIds.push(v.id);
    return v;
  }

  describe("role assignment", () => {
    it("records ROLE_ASSIGNED with actor and role before/after", async () => {
      const userId = await newUser();
      await users.assignRole(userId, "curator", "admin-1");
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).role).toBe("CURATOR");
      const rows = await rowsFor(userId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ action: "ROLE_ASSIGNED", actorId: "admin-1", targetType: "User", before: { role: "USER" }, after: { role: "CURATOR" } });
    });

    it("writes NO audit row when the user does not exist (404)", async () => {
      const missing = randomUUID();
      await expect(users.assignRole(missing, "curator", "admin-1")).rejects.toMatchObject({ status: 404 });
      expect(await rowsFor(missing)).toHaveLength(0);
    });

    // Codex review MAJOR: an unlocked read-then-write let two concurrent assignments both record `before=USER`,
    // although the second one actually changed CURATOR -> CURATOR. The recorded predecessor must be the truth.
    it("never records the same predecessor twice under concurrent assignments", async () => {
      const userId = await newUser();
      const results = await Promise.allSettled([
        users.assignRole(userId, "curator", "admin-a"),
        users.assignRole(userId, "curator", "admin-b"),
        users.assignRole(userId, "curator", "admin-c"),
      ]);
      expect(results.some((r) => r.status === "fulfilled")).toBe(true);
      for (const r of results) if (r.status === "rejected") expect((r.reason as { status?: number }).status).toBe(409);
      const rows = await rowsFor(userId);
      expect(rows.filter((r) => (r.before as { role: string }).role === "USER")).toHaveLength(1);
      expect(rows).toHaveLength(results.filter((r) => r.status === "fulfilled").length);
    });

    it("is FAIL-CLOSED: if the audit write fails the role change is rolled back", async () => {
      const userId = await newUser();
      const failing = new AdminUsersService(prisma as unknown as PrismaService, new FailingAudit());
      await expect(failing.assignRole(userId, "curator", "admin-1")).rejects.toThrow("audit store is down");
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).role).toBe("USER");
    });
  });

  describe("venue create / update / revert", () => {
    it("records VENUE_CREATED with the actor and only non-content metadata", async () => {
      const v = await newVenue("curator-9");
      const rows = await rowsFor(v.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ action: "VENUE_CREATED", actorId: "curator-9", targetType: "Venue", meta: { status: "DRAFT" } });
    });

    it("records VENUE_UPDATED with touched FIELD NAMES only (never venue free-text) and stamps VenueVersion.createdBy", async () => {
      const v = await newVenue();
      await venues.update(v.id, { name: "A Completely New Secret Name", editorialNote: "private editorial text" }, "curator-2");
      const [, updated] = await rowsFor(v.id);
      expect(updated).toMatchObject({ action: "VENUE_UPDATED", actorId: "curator-2", targetType: "Venue" });
      expect((updated.meta as { fields: string[] }).fields.sort()).toEqual(["editorialNote", "name"]);
      expect(updated.before).toBeNull();
      expect(updated.after).toBeNull();
      expect(JSON.stringify(updated)).not.toContain("Secret Name");
      expect(JSON.stringify(updated)).not.toContain("private editorial text");
      const versions = await prisma.venueVersion.findMany({ where: { venueId: v.id } });
      expect(versions.some((x) => x.createdBy === "curator-2")).toBe(true);
    });

    it("writes NO audit row and no version when the update fails mid-transaction (atomic)", async () => {
      const v = await newVenue();
      const before = await rowsFor(v.id);
      await expect(venues.update(v.id, { districtId: "00000000-0000-0000-0000-000000000000" }, "curator-2")).rejects.toBeDefined();
      expect(await rowsFor(v.id)).toHaveLength(before.length);
    });

    it("records VENUE_REVERTED with the version id", async () => {
      const v = await newVenue();
      await venues.update(v.id, { name: "Renamed" }, "curator-2");
      const version = await prisma.venueVersion.findFirstOrThrow({ where: { venueId: v.id }, orderBy: { createdAt: "asc" } });
      await venues.revert(v.id, version.id, "curator-3");
      const reverted = (await rowsFor(v.id)).find((r) => r.action === "VENUE_REVERTED");
      expect(reverted).toMatchObject({ actorId: "curator-3", targetType: "Venue", meta: { versionId: version.id } });
    });

    it("is FAIL-CLOSED on create: a failing audit leaves no venue behind", async () => {
      const district = await prisma.district.findFirstOrThrow();
      const slug = `audit-failclosed-${randomUUID()}`;
      const failing = new AdminVenuesService(prisma as unknown as PrismaService, new BoutiqueService(), repo, new FailingAudit());
      await expect(
        failing.create({ name: "X", slug, districtId: district.id, category: "cafe", priceRange: "MODERATE", signatureItems: [], openingHours: {}, branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02, status: "DRAFT" }, "curator-1"),
      ).rejects.toThrow("audit store is down");
      expect(await prisma.venue.count({ where: { slug } })).toBe(0);
    });
  });

  describe("CSV import — intent before effect (ADR 006 v2)", () => {
    const rowFor = (slug: string, districtSlug: string) => ({
      row: 2,
      data: { name: "Import Cafe", slug, districtSlug, category: "cafe", priceRange: "MODERATE" as const, branchCount: 1, franchiseFlag: false, lat: 40.99, lng: 29.02, openingHours: { mon_fri: "09:00-18:00" } },
    });
    const importAudit = (importId: string) =>
      prisma.auditLog.findMany({ where: { targetType: "VenueImport", meta: { path: ["importId"], equals: importId } }, orderBy: { createdAt: "asc" } });

    it("writes CSV_IMPORT_STARTED before the import and CSV_IMPORTED with counts + created ids after, sharing one importId", async () => {
      const district = await prisma.district.findFirstOrThrow();
      const slugs = [`csv-a-${randomUUID()}`, `csv-b-${randomUUID()}`];
      const result = await venues.importWithAudit([rowFor(slugs[0], district.slug), rowFor(slugs[1], district.slug)], 0, "curator-7");
      const created = await prisma.venue.findMany({ where: { slug: { in: slugs } } });
      venueIds.push(...created.map((v) => v.id));
      expect(result.created).toBe(2);

      const started = await prisma.auditLog.findFirstOrThrow({ where: { action: "CSV_IMPORT_STARTED", actorId: "curator-7", createdAt: { gte: new Date(Date.now() - 60_000) } }, orderBy: { createdAt: "desc" } });
      const importId = (started.meta as { importId: string }).importId;
      const rows = await importAudit(importId);
      expect(rows.map((r) => r.action)).toEqual(["CSV_IMPORT_STARTED", "CSV_IMPORTED"]);
      expect(rows[0].meta).toMatchObject({ importId, rowCount: 2 });
      expect(rows[1].meta).toMatchObject({ importId, created: 2, skipped: 0, errorCount: 0 });
      expect((rows[1].meta as { createdVenueIds: string[] }).createdVenueIds.sort()).toEqual(created.map((v) => v.id).sort());
      // PII boundary: no row content in the trail
      expect(JSON.stringify(rows)).not.toContain("Import Cafe");
      expect(JSON.stringify(rows)).not.toContain(slugs[0]);
    });

    it("is FAIL-CLOSED on intent: if STARTED cannot be written, NO venue is created", async () => {
      const district = await prisma.district.findFirstOrThrow();
      const slug = `csv-failclosed-${randomUUID()}`;
      const failing = new AdminVenuesService(prisma as unknown as PrismaService, new BoutiqueService(), repo, new FailingAudit());
      await expect(failing.importWithAudit([rowFor(slug, district.slug)], 0, "curator-7")).rejects.toThrow("audit store is down");
      expect(await prisma.venue.count({ where: { slug } })).toBe(0);
    });
  });

  describe("queue approve / reject", () => {
    async function pendingReport() {
      const v = await newVenue();
      const item = await prisma.contributionQueue.create({ data: { type: "REPORT", venueId: v.id, payload: { reason: "wrong" } } });
      queueIds.push(item.id);
      return item;
    }

    it("records QUEUE_APPROVED with reviewer and status transition", async () => {
      const item = await pendingReport();
      await queue.approve(item.id, "reviewer-1");
      const rows = await rowsFor(item.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ action: "QUEUE_APPROVED", actorId: "reviewer-1", targetType: "ContributionQueue", before: { status: "PENDING" }, after: { status: "APPROVED" } });
    });

    it("records QUEUE_REJECTED", async () => {
      const item = await pendingReport();
      await queue.reject(item.id, "reviewer-2");
      expect((await rowsFor(item.id))[0]).toMatchObject({ action: "QUEUE_REJECTED", actorId: "reviewer-2", after: { status: "REJECTED" } });
    });

    it("does not add a second audit row when an already-processed item is approved again (409)", async () => {
      const item = await pendingReport();
      await queue.approve(item.id, "reviewer-1");
      await expect(queue.approve(item.id, "reviewer-2")).rejects.toMatchObject({ status: 409 });
      expect(await rowsFor(item.id)).toHaveLength(1);
    });
  });
});
