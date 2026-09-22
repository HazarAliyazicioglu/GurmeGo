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

  // Denetim raporu §4.2 "Paylaşım linki her zaman gerçek (canlı) siteyi gösteriyor" -- the share
  // message had `https://gurmego.com` hardcoded in VenueDetailScreen.tsx instead of reading it
  // from config like every other environment-dependent value in this file.
  it("reads SITE_URL from EXPO_PUBLIC_SITE_URL", () => {
    process.env.EXPO_PUBLIC_SITE_URL = "https://staging.gurmego.com";
    jest.resetModules();
    const { SITE_URL } = require("./env");
    expect(SITE_URL).toBe("https://staging.gurmego.com");
  });
});
