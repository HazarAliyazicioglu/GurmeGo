import { getVenueBySlug } from "@/lib/api";
import { ApiHttpError } from "@gurmego/api-client";
import { notFound } from "next/navigation";
import { VenueDetail } from "@/components/venue-detail";
import { SITE_URL } from "@/lib/site";
import { districtLocative } from "@/lib/district-locative";
import type { Metadata } from "next";

export const revalidate = 3600; // ISR — pilot scale (30-45 venues), hourly revalidation is plenty

export async function generateStaticParams() {
  return []; // populated on-demand via ISR fallback rather than pre-building all slugs at deploy time
}

// §W1 audit finding: without this, every venue page inherited the root layout's generic
// title/description -- Google and share previews couldn't tell one venue's page from another's.
// A lookup failure here (missing venue, or the API being briefly unreachable) falls back to the
// layout's own generic metadata rather than throwing -- generateMetadata running before the page
// component itself means a thrown error here would break the route entirely instead of letting
// the page component's own try/catch produce a proper not-found response.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  let venue: Awaited<ReturnType<typeof getVenueBySlug>> | null;
  try {
    venue = await getVenueBySlug(slug);
  } catch {
    venue = null;
  }
  if (!venue) return {};

  const title = `${venue.name} — ${venue.district.name} | GurmeGo`;
  const description =
    venue.editorialNote ?? `${districtLocative(venue.district.name)} GurmeGo tarafından kürasyonlu bir mekan: ${venue.name}.`;
  const url = `${SITE_URL}/mekan/${venue.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "GurmeGo",
      locale: "tr_TR",
      type: "website",
      ...(venue.photos[0] ? { images: [venue.photos[0]] } : {}),
    },
  };
}

export default async function VenueDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Only a genuine 404 from the API becomes Next's not-found page. Any other failure (5xx,
  // network error, malformed response) must propagate so it hits the route's error boundary
  // instead — conflating them here would silently turn a backend outage into a wrong
  // "mekan bulunamadı" page for the user AND mask a real incident from monitoring.
  let venue: Awaited<ReturnType<typeof getVenueBySlug>> | null;
  try {
    venue = await getVenueBySlug(slug);
  } catch (err) {
    if (err instanceof ApiHttpError && err.status === 404) {
      venue = null;
    } else {
      throw err;
    }
  }
  if (!venue) notFound();
  return <VenueDetail venue={venue} />;
}
