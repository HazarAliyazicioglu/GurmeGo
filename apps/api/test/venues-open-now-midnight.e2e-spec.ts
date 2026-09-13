import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";

// Proves the MAJOR-severity finding from the pre-merge review: a venue open across midnight
// (e.g. "22:00-02:00") was never matched by `openNow=true`, because the original SQL used a plain
// `now BETWEEN open AND close`, which is structurally incapable of expressing a wrap-around range
// (close < open). This test dynamically builds an opening-hours range that (a) always brackets
// the actual current Istanbul time and (b) wraps past midnight whenever "now" is within 2 hours of
// midnight -- so the test is deterministic on every run, not tied to the time-of-day it happens to
// execute at, while still genuinely exercising the wrap-around branch whenever it applies.
describe("VenuesRepository.searchPublished — openNow handles a venue open across midnight", () => {
  let prisma: PrismaClient;
  let repo: VenuesRepository;
  let seededVenueIds: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService();
    repo = new VenuesRepository(prisma as unknown as PrismaService);
  });

  afterEach(async () => {
    if (seededVenueIds.length > 0) {
      await prisma.venue.deleteMany({ where: { id: { in: seededVenueIds } } });
      seededVenueIds = [];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function pad(n: number) {
    return String(n).padStart(2, "0");
  }

  it("matches a venue whose today's-bucket hours wrap past midnight and currently bracket 'now'", async () => {
    const district = await prisma.district.findFirstOrThrow();
    // Must be derived from `istanbulNow`, not a fresh `new Date().getDay()` -- the latter reads the
    // test RUNNER's local timezone (UTC on GitHub Actions), which disagrees with Istanbul's calendar
    // day for the ~3 hours (21:00-23:59 UTC) where Istanbul (UTC+3) has already crossed into the
    // next day. Only two of those daily windows actually matter here, since `mon_fri`/`sat_sun` is a
    // 2-bucket split: Friday->Saturday and Sunday->Monday, when UTC and Istanbul briefly disagree on
    // which bucket applies. During those windows the old code picked the wrong opening-hours bucket
    // key while the SQL (correctly EXTRACT(ISODOW FROM now() AT TIME ZONE 'Europe/Istanbul')) checked
    // the other one -- the seeded venue's `openingHours` JSON only has the (wrong) bucket the test
    // wrote, so the query's fail-open-on-missing-bucket behavior included a venue this test expects
    // excluded. (A narrower, unfixed residual race remains: `istanbulNow` and the SQL's own `now()`
    // are still two different reads a few ms apart, so a test run landing on the exact instant of one
    // of those two transitions could still flake -- accepted, since pinning both to one instant would
    // require faking time in a real-Postgres e2e test, against this file's explicit real-time design.)
    const istanbulNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
    const isoDow = ((istanbulNow.getDay() + 6) % 7) + 1;
    const bucket: "mon_fri" | "sat_sun" = isoDow >= 1 && isoDow <= 5 ? "mon_fri" : "sat_sun";
    const nowMinutes = istanbulNow.getHours() * 60 + istanbulNow.getMinutes();
    // Open 2 hours before "now", close 1 hour after "now" (both mod 24h). "Now" is always inside
    // this window by construction. Whenever `now < 02:00`, `openMinutes` (now - 120, wrapped) ends
    // up LATER in the clock than `closeMinutes` (now + 60), i.e. close < open -- exactly the
    // wrap-around shape this fix must handle. At all other times of day the same range happens to
    // be a plain same-day range, which the old BETWEEN logic already handled -- the assertion holds
    // either way, and the wrap branch gets exercised whenever the test happens to run late at night.
    const openMinutes = (((nowMinutes - 120) % 1440) + 1440) % 1440;
    const closeMinutes = (nowMinutes + 60) % 1440;
    const openStr = `${pad(Math.floor(openMinutes / 60))}:${pad(openMinutes % 60)}`;
    const closeStr = `${pad(Math.floor(closeMinutes / 60))}:${pad(closeMinutes % 60)}`;

    const wrapping = await repo.createWithLocation(prisma, {
      name: "Midnight Wrap Open", slug: `midnight-wrap-open-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [],
      openingHours: { [bucket]: `${openStr}-${closeStr}` },
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    seededVenueIds.push(wrapping.id);

    const { items } = await repo.searchPublished({ sort: "newest", limit: 50, openNow: true, category: "cafe" } as any);
    expect(items.map((i) => i.id)).toContain(wrapping.id);
  });

  it("does NOT match a venue whose today's-bucket wrapping range currently excludes 'now'", async () => {
    const district = await prisma.district.findFirstOrThrow();
    // Must be derived from `istanbulNow`, not a fresh `new Date().getDay()` -- the latter reads the
    // test RUNNER's local timezone (UTC on GitHub Actions), which disagrees with Istanbul's calendar
    // day for the ~3 hours (21:00-23:59 UTC) where Istanbul (UTC+3) has already crossed into the
    // next day. Only two of those daily windows actually matter here, since `mon_fri`/`sat_sun` is a
    // 2-bucket split: Friday->Saturday and Sunday->Monday, when UTC and Istanbul briefly disagree on
    // which bucket applies. During those windows the old code picked the wrong opening-hours bucket
    // key while the SQL (correctly EXTRACT(ISODOW FROM now() AT TIME ZONE 'Europe/Istanbul')) checked
    // the other one -- the seeded venue's `openingHours` JSON only has the (wrong) bucket the test
    // wrote, so the query's fail-open-on-missing-bucket behavior included a venue this test expects
    // excluded. (A narrower, unfixed residual race remains: `istanbulNow` and the SQL's own `now()`
    // are still two different reads a few ms apart, so a test run landing on the exact instant of one
    // of those two transitions could still flake -- accepted, since pinning both to one instant would
    // require faking time in a real-Postgres e2e test, against this file's explicit real-time design.)
    const istanbulNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
    const isoDow = ((istanbulNow.getDay() + 6) % 7) + 1;
    const bucket: "mon_fri" | "sat_sun" = isoDow >= 1 && isoDow <= 5 ? "mon_fri" : "sat_sun";
    const nowMinutes = istanbulNow.getHours() * 60 + istanbulNow.getMinutes();
    // A wrap-shaped range (close < open as clock values) with "now" sitting in the small gap
    // between close and open: opens 1 hour from now, closed 1 hour ago -- e.g. "10:00-08:00" when
    // "now" is 09:00 means the venue opens at 10:00 tonight (running overnight to 08:00 the next
    // morning), but the PREVIOUS overnight session already closed at 08:00, so 09:00 falls in the
    // 2-hour daytime gap between sessions and must be excluded. (A range like "22:00-02:00" checked
    // at 09:00 would be the wrong shape for this assertion -- that's a genuinely-open-all-night
    // case tested by the positive test above; this needs "now" positioned strictly between two
    // wrap sessions, which requires open/close framed relative to "now" itself, not fixed clock
    // strings, to be deterministic on every test run.)
    const openMinutes = (nowMinutes + 60) % 1440;
    const closeMinutes = (((nowMinutes - 60) % 1440) + 1440) % 1440;
    const openStr = `${pad(Math.floor(openMinutes / 60))}:${pad(openMinutes % 60)}`;
    const closeStr = `${pad(Math.floor(closeMinutes / 60))}:${pad(closeMinutes % 60)}`;

    const notOpenYet = await repo.createWithLocation(prisma, {
      name: "Midnight Wrap Not Open", slug: `midnight-wrap-notopen-${Date.now()}`, districtId: district.id,
      category: "cafe", priceRange: "MODERATE", signatureItems: [],
      openingHours: { [bucket]: `${openStr}-${closeStr}` },
      isBoutique: false, branchCount: 1, franchiseFlag: false, source: "MANUAL",
      verifiedAt: new Date(), status: "PUBLISHED", lat: 40.99, lng: 29.02,
    });
    seededVenueIds.push(notOpenYet.id);

    // Skip the (rare) instant where open === close, which degenerates ambiguously.
    if (openMinutes === closeMinutes) return;

    const { items } = await repo.searchPublished({ sort: "newest", limit: 50, openNow: true, category: "cafe" } as any);
    expect(items.map((i) => i.id)).not.toContain(notOpenYet.id);
  });
});
