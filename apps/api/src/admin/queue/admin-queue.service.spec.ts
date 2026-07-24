import { AdminQueueService } from "./admin-queue.service";

describe("AdminQueueService.approve", () => {
  it("applies a re_verify approval by bumping verifiedAt and snapshotting the version", async () => {
    const item = { id: "c1", type: "EDIT", venueId: "v1", payload: { kind: "re_verify" } };
    const venue = { id: "v1", name: "A", editorialNote: "old" };
    const prisma = {
      contributionQueue: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(item),
        update: jest.fn().mockResolvedValue({}),
      },
      venue: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(venue),
        update: jest.fn().mockResolvedValue({}),
      },
      venueVersion: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const service = new AdminQueueService(prisma);

    await service.approve("c1", "curator-1");

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
});
