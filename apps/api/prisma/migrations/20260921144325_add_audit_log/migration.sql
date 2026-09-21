-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ROLE_ASSIGNED', 'VENUE_CREATED', 'VENUE_UPDATED', 'VENUE_REVERTED', 'QUEUE_APPROVED', 'QUEUE_REJECTED', 'CSV_IMPORT_STARTED', 'CSV_IMPORTED');

-- NOTE: `prisma migrate dev` also proposed `DROP INDEX "Venue_location_idx"` (the PostGIS GiST index Prisma
-- cannot model). It MUST NOT be dropped; removed here deliberately -- see the composite-index migration.

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_actorId_createdAt_idx" ON "audit_log"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- ADR 006 v2: append-only, enforced by the database for every role and code path.
CREATE FUNCTION audit_log_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (% is not allowed)', TG_OP USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_forbid_mutation();

CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_forbid_mutation();
