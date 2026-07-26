import { AdminQueueService } from "./admin-queue.service";

// Builds a prisma-like mock whose `$transaction` invokes the callback with a `tx` object that
// mirrors `prisma` itself — mirrors how real Prisma's interactive transactions work, so the
// service code (which uses `tx.*` instead of `this.prisma.*` inside `$transaction`) can be
// tested without a real database.
function makePrisma(overrides: { item: any; venue?: any }) {
  const item = { ...overrides.item };
  const prisma: any = {
    contributionQueue: {
      findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve(item)),
      update: jest.fn().mockResolvedValue({}),
    },
    venue: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(overrides.venue),
      update: jest.fn().mockResolvedValue({}),
    },
    venueVersion: { create: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction = jest.fn().mockImplementation((cb: any) => cb(prisma));
  return prisma;
}

describe("AdminQueueService.approve — REPORT vs EDIT branching", () => {
  it("REPORT: only flips ContributionQueue status, never touches Venue or VenueVersion", async () => {
    const item = { id: "c1", type: "REPORT", venueId: "v1", status: "PENDING" };
    const txClient = {
      contributionQueue: { findUniqueOrThrow: jest.fn().mockResolvedValue(item), update: jest.fn().mockResolvedValue({}) },
      venue: { update: jest.fn() }, venueVersion: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(txClient)) } as any;
    const venuesRepository = { findRawForSnapshot: jest.fn() } as any;
    const service = new AdminQueueService(prisma, venuesRepository);
    await service.approve("c1", "curator-1");
    expect(venuesRepository.findRawForSnapshot).not.toHaveBeenCalled();
    expect(txClient.venue.update).not.toHaveBeenCalled();
    expect(txClient.venueVersion.create).not.toHaveBeenCalled();
    expect(txClient.contributionQueue.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ status: "APPROVED" }) }));
  });

  it("EDIT: takes a location-inclusive snapshot via findRawForSnapshot, bumps verifiedAt", async () => {
    const item = { id: "c2", type: "EDIT", venueId: "v1", status: "PENDING" };
    const snapshot = { id: "v1", lat: 40.99, lng: 29.02 };
    const txMock = {
      contributionQueue: { findUniqueOrThrow: jest.fn().mockResolvedValue(item), update: jest.fn().mockResolvedValue({}) },
      venue: { update: jest.fn().mockResolvedValue({}) }, venueVersion: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(txMock)) } as any;
    const venuesRepository = { findRawForSnapshot: jest.fn().mockResolvedValue(snapshot) } as any;
    const service = new AdminQueueService(prisma, venuesRepository);
    await service.approve("c2", "curator-1");
    expect(venuesRepository.findRawForSnapshot).toHaveBeenCalledWith(txMock, "v1");
    expect(txMock.venueVersion.create).toHaveBeenCalledWith({ data: { venueId: "v1", snapshot, createdBy: "curator-1" } });
    expect(txMock.venue.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { verifiedAt: expect.any(Date) } });
  });

  it("throws a conflict error and makes no writes when the item is already APPROVED", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", status: "APPROVED", payload: { kind: "re_verify" } };
    const venue = { id: "v1", name: "A", editorialNote: "old" };
    const prisma = makePrisma({ item, venue });
    const venuesRepository = { findRawForSnapshot: jest.fn() } as any;
    const service = new AdminQueueService(prisma, venuesRepository);

    await expect(service.approve("c1", "curator-1")).rejects.toMatchObject({
      response: { error: { code: "CONTRIBUTION_ALREADY_PROCESSED" } },
    });

    expect(venuesRepository.findRawForSnapshot).not.toHaveBeenCalled();
    expect(prisma.venueVersion.create).not.toHaveBeenCalled();
    expect(prisma.venue.update).not.toHaveBeenCalled();
    expect(prisma.contributionQueue.update).not.toHaveBeenCalled();
  });
});

describe("AdminQueueService.reject", () => {
  it("updates status to REJECTED for a PENDING item", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", status: "PENDING" };
    const prisma = makePrisma({ item });
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any);

    await service.reject("c1", "curator-1");

    expect(prisma.contributionQueue.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "REJECTED", reviewedBy: "curator-1", reviewedAt: expect.any(Date) },
    });
  });

  it("throws a conflict error and makes no writes when the item is already REJECTED", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", status: "REJECTED" };
    const prisma = makePrisma({ item });
    const service = new AdminQueueService(prisma, { findRawForSnapshot: jest.fn() } as any);

    await expect(service.reject("c1", "curator-1")).rejects.toMatchObject({
      response: { error: { code: "CONTRIBUTION_ALREADY_PROCESSED" } },
    });

    expect(prisma.contributionQueue.update).not.toHaveBeenCalled();
  });
});
