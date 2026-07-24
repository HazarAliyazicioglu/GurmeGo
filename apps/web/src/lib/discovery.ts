import { getDistricts } from "@/lib/api";

export async function getDefaultDistrictSlug(): Promise<string> {
  const districts = await getDistricts();
  return districts[0]?.slug ?? "kadikoy";
}
