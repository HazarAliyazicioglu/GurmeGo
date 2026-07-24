import { redirect } from "next/navigation";
import { getDistricts } from "@/lib/api";

export async function getDefaultDistrictSlug(): Promise<string> {
  const districts = await getDistricts();
  return districts[0]?.slug ?? "kadikoy";
}

export default async function RootPage() {
  const slug = await getDefaultDistrictSlug();
  redirect(`/${slug}`);
}
