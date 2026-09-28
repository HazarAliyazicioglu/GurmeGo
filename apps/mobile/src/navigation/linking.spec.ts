import { getStateFromPath } from "@react-navigation/native";
import { linking } from "./linking";

// getStateFromPath resolves a bare path (no scheme/host) against linking.config, the same
// resolution React Navigation runs internally after stripping a matched prefix from an
// incoming URL -- so these assertions exercise the real routing table without needing a
// device or simulator to receive an actual deep link.
describe("linking config", () => {
  it("routes a venue path to VenueDetail with the slug param, keeping Tabs underneath so back navigation works", () => {
    const state = getStateFromPath("mekan/moda-meyhanesi", linking.config);
    expect(state?.routes.map((r) => r.name)).toEqual(["Tabs", "VenueDetail"]);
    const detailRoute = state?.routes[state.routes.length - 1];
    expect(detailRoute?.params).toEqual({ slug: "moda-meyhanesi" });
  });

  it("routes the discovery path to the Tabs navigator's Discovery screen specifically", () => {
    const state = getStateFromPath("kesfet", linking.config);
    const tabsRoute = state?.routes[0];
    expect(tabsRoute?.name).toBe("Tabs");
    const tabsState = tabsRoute && "state" in tabsRoute ? tabsRoute.state : undefined;
    expect(tabsState?.routes[tabsState.routes.length - 1].name).toBe("Discovery");
  });

  it("routes the auth path to Auth, also keeping Tabs underneath", () => {
    const state = getStateFromPath("giris", linking.config);
    expect(state?.routes.map((r) => r.name)).toEqual(["Tabs", "Auth"]);
  });

  it("routes the venue-suggestion path to SuggestVenue, matching web's /mekan-oner", () => {
    const state = getStateFromPath("mekan-oner", linking.config);
    expect(state?.routes.map((r) => r.name)).toEqual(["Tabs", "SuggestVenue"]);
  });

  it("declares the custom scheme and the production web origin as prefixes", () => {
    expect(linking.prefixes).toContain("gurmego://");
    expect(linking.prefixes).toContain("https://gurme-go-web.vercel.app");
  });
});
