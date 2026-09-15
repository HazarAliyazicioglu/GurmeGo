// Single source of truth for the site's own public origin -- used for sitemap URLs, canonical
// links, and Open Graph image/URL fields. Falls back to the documented production domain,
// matching the `NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1"` pattern already used
// elsewhere in this file's siblings.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gurmego.com";
