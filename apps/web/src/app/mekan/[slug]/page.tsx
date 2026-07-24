import { getVenueBySlug } from "@/lib/api";
import { notFound } from "next/navigation";
import { VenueDetail } from "@/components/venue-detail";

export const revalidate = 3600; // ISR — pilot scale (30-45 venues), hourly revalidation is plenty

export async function generateStaticParams() {
  return []; // populated on-demand via ISR fallback rather than pre-building all slugs at deploy time
}

export default async function VenueDetailPage({ params }: { params: { slug: string } }) {
  const venue = await getVenueBySlug(params.slug).catch(() => null);
  if (!venue) notFound();
  return <VenueDetail venue={venue} />;
}
