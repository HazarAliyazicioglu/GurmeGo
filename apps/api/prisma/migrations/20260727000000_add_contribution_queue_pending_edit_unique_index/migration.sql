-- Partial unique index: at most one PENDING "EDIT" contribution per venue.
--
-- Not representable as a plain `@@unique` in schema.prisma (Prisma has no filtered/partial unique
-- constraint syntax), which is why this exists as a hand-written migration instead of a schema.prisma
-- change. Deliberately scoped to (type = 'EDIT' AND status = 'PENDING') rather than an unfiltered
-- (venueId, type, status) unique: the latter would also cap REPORT contributions at one
-- PENDING-per-venue, breaking the "3 pending reports -> auto-hide + urgent" moderation rule
-- (docs/rule-engine.md), which depends on several REPORT rows being PENDING for the same venue at once.
--
-- This closes a real race in rule-engine/re-verify.service.ts's enqueueStale(): its
-- check-then-insert (findFirst for an existing PENDING re_verify row, then create()) is not atomic,
-- so if the daily cron ever runs concurrently across multiple API instances, both could pass the
-- check before either commits and both insert a duplicate PENDING EDIT row for the same venue. This
-- index makes the DB the actual source of truth; enqueueStale() now catches the resulting P2002
-- unique-violation and treats it as "already enqueued, skip" instead of erroring.
CREATE UNIQUE INDEX "contribution_queue_pending_edit_venue_key"
ON "ContributionQueue" ("venueId")
WHERE "type" = 'EDIT' AND "status" = 'PENDING';
