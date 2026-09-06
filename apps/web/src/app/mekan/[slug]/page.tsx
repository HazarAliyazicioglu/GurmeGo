import { getVenueBySlug } from "@/lib/api";
import { ApiHttpError } from "@gurmego/api-client";
import { notFound } from "next/navigation";
import { VenueDetail } from "@/components/venue-detail";

export const revalidate = 3600; // ISR — pilot scale (30-45 venues), hourly revalidation is plenty

export async function generateStaticParams() {
  return []; // populated on-demand via ISR fallback rather than pre-building all slugs at deploy time
}

export default async function VenueDetailPage({ params }: { params: { slug: string } }) {
  // Only a genuine 404 from the API becomes Next's not-found page. Any other failure (5xx,
  // network error, malformed response) must propagate so it hits the route's error boundary
  // instead — conflating them here would silently turn a backend outage into a wrong
  // "mekan bulunamadı" page for the user AND mask a real incident from monitoring.
  let venue: Awaited<ReturnType<typeof getVenueBySlug>> | null;
  try {
    venue = await getVenueBySlug(params.slug);
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
