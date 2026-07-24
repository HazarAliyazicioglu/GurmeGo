import { getDistricts, getVenues } from "@/lib/api";
import { notFound } from "next/navigation";
import { DistrictPicker } from "@/components/district-picker";

export default async function DiscoveryPage({ params }: { params: { district: string } }) {
  const districts = await getDistricts();
  const current = districts.find((d) => d.slug === params.district);
  if (!current) notFound();

  const { data: venues } = await getVenues({ districtId: current.id, sort: "newest" });

  // Rendering (venue list/map/filters) is composed here once Tasks 4-6
  // land their components — this task only proves the data contract works end-to-end.
  return (
    <main>
      <DistrictPicker districts={districts} current={params.district} />
      <h1>{current.name}</h1>
      <p>{venues.length} mekan bulundu</p>
    </main>
  );
}
