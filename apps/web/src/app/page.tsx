import { redirect } from "next/navigation";
import { getDefaultDistrictSlug } from "@/lib/discovery";

export default async function RootPage() {
  const slug = await getDefaultDistrictSlug();
  redirect(`/${slug}`);
}
