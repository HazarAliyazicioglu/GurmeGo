import type { Metadata } from "next";
import { getDistricts } from "@/lib/api";
import { SuggestVenueForm } from "@/components/suggest-venue-form";

export const metadata: Metadata = {
  title: "Mekan öner — GurmeGo",
  description: "Bildiğin bir butik mekanı GurmeGo'ya öner, kürasyon ekibi incelesin.",
};

export default async function MekanOnerPage() {
  const districts = await getDistricts();
  return (
    <main className="mx-auto max-w-xl pt-10 sm:pt-14">
      <div className="mb-2 flex items-center gap-2 text-[0.64rem] font-black uppercase tracking-[0.2em] text-terracottaDeep">
        <span className="h-px w-6 bg-current" aria-hidden="true" />
        Katkın önemli
      </div>
      <h1 className="font-serif text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">Mekan öner</h1>
      <p className="mt-3 text-sm font-medium leading-relaxed text-ink/55">
        Gitmeni sevdiğin, listede olmayan bir butik mekan mı var? Aşağıdaki formla öner, kürasyon ekibi inceleyip
        uygunsa yayına alsın.
      </p>
      <section className="mt-8 rounded-[1.5rem] border border-ink/12 bg-creamLight p-5 sm:p-6">
        <SuggestVenueForm districts={districts} />
      </section>
    </main>
  );
}
