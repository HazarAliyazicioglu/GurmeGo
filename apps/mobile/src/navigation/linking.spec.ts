import { getStateFromPath } from "@react-navigation/native";
import { linking } from "./linking";

// getStateFromPath resolves a bare path (no scheme/host) against linking.config, the same
// resolution React Navigation runs internally after stripping a matched prefix from an
// incoming URL -- so these assertions exercise the real routing table without needing a
// device or simulator to receive an actual deep link.
describe("linking config", () => {
  it("routes a venue path to VenueDetail with the slug param", () => {
    const state = getStateFromPath("mekan/moda-meyhanesi", linking.config);
    const route = state?.routes[0];
    expect(route?.name).toBe("VenueDetail");
    expect(route?.params).toEqual({ slug: "moda-meyhanesi" });
  });

  it("routes the discovery path to the Tabs/Discovery screen", () => {
    const state = getStateFromPath("kesfet", linking.config);
    const route = state?.routes[0];
    expect(route?.name).toBe("Tabs");
  });

  it("routes the auth path to Auth", () => {
    const state = getStateFromPath("giris", linking.config);
    const route = state?.routes[0];
    expect(route?.name).toBe("Auth");
  });

  it("declares the custom scheme and the production web origin as prefixes", () => {
    expect(linking.prefixes).toContain("gurmego://");
    expect(linking.prefixes).toContain("https://gurme-go-web.vercel.app");
  });
});
