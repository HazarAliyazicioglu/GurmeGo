import { SwaggerModule } from "@nestjs/swagger";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { setupSwagger } from "./main";

describe("setupSwagger — production guard", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it("does not call SwaggerModule.setup when NODE_ENV=production", () => {
    process.env.NODE_ENV = "production";
    jest.spyOn(SwaggerModule, "createDocument").mockReturnValue({} as ReturnType<typeof SwaggerModule.createDocument>);
    const setupSpy = jest.spyOn(SwaggerModule, "setup").mockImplementation(() => undefined as unknown as NestFastifyApplication);
    setupSwagger({} as NestFastifyApplication);
    expect(setupSpy).not.toHaveBeenCalled();
  });

  it("calls SwaggerModule.setup when NODE_ENV is not production", () => {
    process.env.NODE_ENV = "development";
    jest.spyOn(SwaggerModule, "createDocument").mockReturnValue({} as ReturnType<typeof SwaggerModule.createDocument>);
    const setupSpy = jest.spyOn(SwaggerModule, "setup").mockImplementation(() => undefined as unknown as NestFastifyApplication);
    setupSwagger({} as NestFastifyApplication);
    expect(setupSpy).toHaveBeenCalled();
  });
});
