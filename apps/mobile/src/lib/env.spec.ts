describe("env", () => {
  it("throws a clear error when EXPO_PUBLIC_API_BASE_URL is missing", () => {
    const original = process.env.EXPO_PUBLIC_API_BASE_URL;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    jest.resetModules();
    expect(() => require("./env")).toThrow(/EXPO_PUBLIC_API_BASE_URL is required/);
    process.env.EXPO_PUBLIC_API_BASE_URL = original;
  });

  it("reads the value when it is present", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:9999/v1";
    jest.resetModules();
    const { API_BASE_URL } = require("./env");
    expect(API_BASE_URL).toBe("http://localhost:9999/v1");
  });
});
