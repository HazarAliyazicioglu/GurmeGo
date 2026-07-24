import { getDistricts, getVenues } from "@/lib/api";
import { notFound } from "next/navigation";
import { DistrictPicker } from "@/components/district-picker";
import { DiscoveryClient } from "@/components/discovery-client";

export default async function DiscoveryPage({ params }: { params: { district: string } }) {
  const districts = await getDistricts();
  const current = districts.find((d) => d.slug === params.district);
  if (!current) notFound();

  const { data: venues } = await getVenues({ districtId: current.id, sort: "newest" });

  return (
    <main>
      <DistrictPicker districts={districts} current={params.district} />
      <h1>{current.name}</h1>
      <DiscoveryClient districtId={current.id} initialVenues={venues} />
    </main>
  );
}
