import { PostgresCacheStoreService } from "./postgres-cache-store.service";

describe("PostgresCacheStoreService.increment", () => {
  it("creates a new counter window and returns 1 on first call", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ count: 1 }]),
    } as any;
    const store = new PostgresCacheStoreService(prisma);

    const count = await store.increment("report:1.2.3.4", 86400);

    expect(count).toBe(1);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});
