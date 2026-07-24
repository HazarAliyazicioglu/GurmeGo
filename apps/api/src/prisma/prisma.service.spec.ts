import { Test } from "@nestjs/testing";
import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  it("connects on module init", async () => {
    const moduleRef = await Test.createTestingModule({ providers: [PrismaService] }).compile();
    const prisma = moduleRef.get(PrismaService);
    const connectSpy = jest.spyOn(prisma, "$connect").mockResolvedValue();
    await prisma.onModuleInit();
    expect(connectSpy).toHaveBeenCalled();
  });
});
