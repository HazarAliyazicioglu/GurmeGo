import { getDistricts, getVenues } from "@/lib/api";
import { notFound } from "next/navigation";
import { DistrictPicker } from "@/components/district-picker";
import { DiscoveryClient } from "@/components/discovery-client";
import { LocationProvider } from "@/lib/location-context";
import { DISTRICT_CENTERS, DEFAULT_CENTER } from "@/lib/district-centers";
import { SITE_URL } from "@/lib/site";
import { districtLocative } from "@/lib/district-locative";
import type { Metadata } from "next";

// §W1 audit finding: without this, every district page shared the root layout's generic title.
// An unknown district slug returns empty metadata (not an error) -- the page component's own
// notFound() call is what actually produces the 404, this only needs to not crash ahead of it.
export async function generateMetadata({ params }: { params: Promise<{ district: string }> }): Promise<Metadata> {
  const { district } = await params;
  const districts = await getDistricts();
  const current = districts.find((d) => d.slug === district);
  if (!current) return {};

  const locative = districtLocative(current.name);
  const title = `${locative} butik mekanlar | GurmeGo`;
  const description = `${locative} GurmeGo tarafından kürasyonlu butik mekanlar, kafeler ve restoranlar.`;
  const url = `${SITE_URL}/${current.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "GurmeGo", locale: "tr_TR", type: "website" },
  };
}

export default async function DiscoveryPage({ params }: { params: Promise<{ district: string }> }) {
  const { district } = await params;
  const districts = await getDistricts();
  const current = districts.find((d) => d.slug === district);
  if (!current) notFound();

  const { data: venues, meta } = await getVenues({ districtId: current.id, sort: "newest" });
  const center = DISTRICT_CENTERS[district] ?? DEFAULT_CENTER;

  return (
    <main>
      <LocationProvider>
        <DistrictPicker districts={districts} current={district} />
        <h1>{current.name}</h1>
        <DiscoveryClient
          key={current.id}
          districtId={current.id}
          initialVenues={venues}
          initialCursor={meta.next_cursor}
          initialHasMore={meta.has_more}
          center={center}
          districtName={current.name}
        />
      </LocationProvider>
    </main>
  );
}
