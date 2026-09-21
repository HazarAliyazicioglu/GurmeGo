import type { MetadataRoute } from "next";
import { getDistricts } from "@/lib/api";
import { getAllPublishedVenueSlugs } from "@/lib/all-published-venues";
import { SITE_URL } from "@/lib/site";

// §W2 audit finding: Google had no map of this site's pages -- it had to discover new venue
// pages by crawling links alone, which is slow and can miss pages entirely.
//
// cross-model-review flagged `force-dynamic` as hitting the backend on every single
// /sitemap.xml request with no caching -- tried `revalidate = 3600` (ISR, same as the venue
// detail page) instead, but unlike a page route, this metadata route has no
// `generateStaticParams` escape hatch: Next.js attempts to prerender it at BUILD time whenever
// `revalidate` is set, which fails without a live backend reachable during `next build` (this
// repo's CI has none, by design -- see the build-step widening this same finding batch shipped).
// `force-dynamic` is the option that defers the fetch to request time; the underlying API reads
// (`getDistricts`, `getVenues`) carry their own data-cache TTL since the Next 16 upgrade, so a
// crawler hitting this route repeatedly does not translate into repeated backend calls.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [districts, venueSlugs] = await Promise.all([getDistricts(), getAllPublishedVenueSlugs()]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
  ];
  const districtEntries: MetadataRoute.Sitemap = districts.map((d) => ({
    url: `${SITE_URL}/${d.slug}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));
  const venueEntries: MetadataRoute.Sitemap = venueSlugs.map((slug) => ({
    url: `${SITE_URL}/mekan/${slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...districtEntries, ...venueEntries];
}
