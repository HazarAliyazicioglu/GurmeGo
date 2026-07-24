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

describe("AdminQueueService.approve", () => {
  it("applies a re_verify approval by bumping verifiedAt and snapshotting the version", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", status: "PENDING", payload: { kind: "re_verify" } };
    const venue = { id: "v1", name: "A", editorialNote: "old" };
    const prisma = makePrisma({ item, venue });
    const service = new AdminQueueService(prisma);

    await service.approve("c1", "curator-1");

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.venueVersion.create).toHaveBeenCalledWith({
      data: { venueId: "v1", snapshot: venue, createdBy: "curator-1" },
    });
    expect(prisma.venue.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { verifiedAt: expect.any(Date) },
    });
    expect(prisma.contributionQueue.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "APPROVED", reviewedBy: "curator-1", reviewedAt: expect.any(Date) },
    });
  });

  it("throws a conflict error and makes no writes when the item is already APPROVED", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", status: "APPROVED", payload: { kind: "re_verify" } };
    const venue = { id: "v1", name: "A", editorialNote: "old" };
    const prisma = makePrisma({ item, venue });
    const service = new AdminQueueService(prisma);

    await expect(service.approve("c1", "curator-1")).rejects.toMatchObject({
      response: { error: { code: "CONTRIBUTION_ALREADY_PROCESSED" } },
    });

    expect(prisma.venueVersion.create).not.toHaveBeenCalled();
    expect(prisma.venue.update).not.toHaveBeenCalled();
    expect(prisma.contributionQueue.update).not.toHaveBeenCalled();
  });
});

describe("AdminQueueService.reject", () => {
  it("updates status to REJECTED for a PENDING item", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", status: "PENDING" };
    const prisma = makePrisma({ item });
    const service = new AdminQueueService(prisma);

    await service.reject("c1", "curator-1");

    expect(prisma.contributionQueue.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "REJECTED", reviewedBy: "curator-1", reviewedAt: expect.any(Date) },
    });
  });

  it("throws a conflict error and makes no writes when the item is already REJECTED", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", status: "REJECTED" };
    const prisma = makePrisma({ item });
    const service = new AdminQueueService(prisma);

    await expect(service.reject("c1", "curator-1")).rejects.toMatchObject({
      response: { error: { code: "CONTRIBUTION_ALREADY_PROCESSED" } },
    });

    expect(prisma.contributionQueue.update).not.toHaveBeenCalled();
  });
});
