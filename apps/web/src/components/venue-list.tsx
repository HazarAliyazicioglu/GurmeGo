import { VenueCard } from "./venue-card";
import type { VenueListItem } from "@/lib/api";

export function VenueList({ venues }: { venues: VenueListItem[] }) {
  if (venues.length === 0)
    return (
      <div data-testid="empty-state" className="mt-8 rounded-[1.5rem] border border-dashed border-ink/20 bg-white/25 px-6 py-14 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-sand text-terracottaDeep" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-5 fill-none">
            <path d="m16 16 4 4m-2-9a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <p className="mt-4 font-serif text-2xl font-semibold tracking-[-0.025em]">Bu filtrelerle mekan bulunamadı.</p>
        <p className="mx-auto mt-2 max-w-xs text-sm font-medium leading-relaxed text-ink/50">Seçeneklerden birini kaldırıp editör seçkisine yeniden göz atabilirsin.</p>
      </div>
    );

  return (
    <section className="mt-9" aria-labelledby="venue-list-title">
      <div className="mb-4 flex items-end justify-between gap-4 px-1">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-terracotta">Editör seçkisi</p>
          <h2 id="venue-list-title" className="mt-1 font-serif text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Gitmeye değer mekanlar
          </h2>
        </div>
        <span className="mb-1 shrink-0 text-xs font-bold tabular-nums text-ink/40">{venues.length.toString().padStart(2, "0")} mekan</span>
      </div>

      <div data-testid="venue-list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {venues.map((v) => (
          <VenueCard key={v.id} venue={v} />
        ))}
      </div>
    </section>
  );
}