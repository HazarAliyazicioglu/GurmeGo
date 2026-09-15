import { getVenues } from "./api";

// The sitemap needs every published venue's slug, but `getVenues` is cursor-paginated (a single
// page tops out well below the pilot's ~30-45 venue catalog). This walks every page until
// `has_more` is false. Fine at pilot scale; would need a dedicated backend "all slugs" endpoint
// if the catalog grows into the thousands.
export async function getAllPublishedVenueSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let cursor: string | null = null;
  do {
    const query: Record<string, string> = { sort: "newest" };
    if (cursor) query.cursor = cursor;
    const { data, meta } = await getVenues(query);
    slugs.push(...data.map((v) => v.slug));
    cursor = meta.has_more ? meta.next_cursor : null;
  } while (cursor);
  return slugs;
}
