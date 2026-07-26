import { setupSwagger } from "./main";

describe("setupSwagger — production guard", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it("does not call SwaggerModule.setup when NODE_ENV=production", () => {
    process.env.NODE_ENV = "production";
    const swagger = require("@nestjs/swagger");
    jest.spyOn(swagger.SwaggerModule, "createDocument").mockReturnValue({} as any);
    const setupSpy = jest.spyOn(swagger.SwaggerModule, "setup").mockImplementation(() => {});
    setupSwagger({} as any);
    expect(setupSpy).not.toHaveBeenCalled();
  });

  it("calls SwaggerModule.setup when NODE_ENV is not production", () => {
    process.env.NODE_ENV = "development";
    const swagger = require("@nestjs/swagger");
    jest.spyOn(swagger.SwaggerModule, "createDocument").mockReturnValue({} as any);
    const setupSpy = jest.spyOn(swagger.SwaggerModule, "setup").mockImplementation(() => {});
    setupSwagger({} as any);
    expect(setupSpy).toHaveBeenCalled();
  });
});
