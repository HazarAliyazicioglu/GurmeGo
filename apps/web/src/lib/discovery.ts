// Was previously `districts[0]?.slug` from a live /districts call -- an undocumented assumption
// that the backend's return order wouldn't change, and (as a side effect) required a reachable
// backend just to statically prerender this redirect at build time. Kadıköy is the documented
// MVP default district (docs/product-overview.md).
const DEFAULT_DISTRICT_SLUG = "kadikoy";

export async function getDefaultDistrictSlug(): Promise<string> {
  return DEFAULT_DISTRICT_SLUG;
}
