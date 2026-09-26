import { VenueSuggestionsService } from "./venue-suggestions.service";

describe("VenueSuggestionsService.submit", () => {
  it("writes a NEW_VENUE contribution row with venueId null and the submission in the payload", async () => {
    const prisma = {
      district: { findUnique: jest.fn().mockResolvedValue({ id: "d1", slug: "kadikoy", name: "Kadıköy" }) },
      contributionQueue: { create: jest.fn().mockResolvedValue({ id: "c1" }) },
    } as any;
    const service = new VenueSuggestionsService(prisma);

    const result = await service.submit({
      name: "Moda Kahvecisi",
      districtSlug: "kadikoy",
      category: "cafe",
      address: "Moda Cd. No:1",
      note: "iyi kahve",
    });

    expect(prisma.district.findUnique).toHaveBeenCalledWith({ where: { slug: "kadikoy" } });
    expect(prisma.contributionQueue.create).toHaveBeenCalledWith({
      data: {
        type: "NEW_VENUE",
        venueId: null,
        submittedBy: null,
        payload: {
          name: "Moda Kahvecisi",
          districtSlug: "kadikoy",
          districtName: "Kadıköy",
          category: "cafe",
          address: "Moda Cd. No:1",
          note: "iyi kahve",
        },
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("omits address/note from the payload when not provided, rather than storing them as undefined", async () => {
    const prisma = {
      district: { findUnique: jest.fn().mockResolvedValue({ id: "d1", slug: "kadikoy", name: "Kadıköy" }) },
      contributionQueue: { create: jest.fn().mockResolvedValue({ id: "c1" }) },
    } as any;
    const service = new VenueSuggestionsService(prisma);

    await service.submit({ name: "X", districtSlug: "kadikoy", category: "cafe" });

    const payload = prisma.contributionQueue.create.mock.calls[0][0].data.payload;
    expect(payload).not.toHaveProperty("address");
    expect(payload).not.toHaveProperty("note");
  });

  it("throws a clean 404 when districtSlug does not match any real district", async () => {
    const prisma = {
      district: { findUnique: jest.fn().mockResolvedValue(null) },
      contributionQueue: { create: jest.fn() },
    } as any;
    const service = new VenueSuggestionsService(prisma);

    try {
      await service.submit({ name: "X", districtSlug: "not-a-district", category: "cafe" });
      throw new Error("expected submit to throw");
    } catch (err: any) {
      expect(err.getResponse()).toEqual({ error: { code: "DISTRICT_NOT_FOUND", message: "İlçe bulunamadı" } });
      expect(err.getResponse().message).toBeUndefined();
    }
    expect(prisma.contributionQueue.create).not.toHaveBeenCalled();
  });
});
