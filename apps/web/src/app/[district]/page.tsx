import { getDistricts, getVenues } from "@/lib/api";
import { notFound } from "next/navigation";
import { DistrictPicker } from "@/components/district-picker";
import { DiscoveryClient } from "@/components/discovery-client";
import { LocationProvider } from "@/lib/location-context";
import { DISTRICT_CENTERS, DEFAULT_CENTER } from "@/lib/district-centers";

export default async function DiscoveryPage({ params }: { params: { district: string } }) {
  const districts = await getDistricts();
  const current = districts.find((d) => d.slug === params.district);
  if (!current) notFound();

  const { data: venues } = await getVenues({ districtId: current.id, sort: "newest" });
  const center = DISTRICT_CENTERS[params.district] ?? DEFAULT_CENTER;

  return (
    <main>
      <LocationProvider>
        <DistrictPicker districts={districts} current={params.district} />
        <h1>{current.name}</h1>
        <DiscoveryClient key={current.id} districtId={current.id} initialVenues={venues} center={center} districtName={current.name} />
      </LocationProvider>
    </main>
  );
}
