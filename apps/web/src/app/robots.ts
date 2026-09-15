import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// §W2 audit finding: nothing told search engines this site could be crawled, or where to find
// its sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
