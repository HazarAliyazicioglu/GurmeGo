import type { VenueDetail as VenueDetailType } from "@gurmego/shared";
import { PRICE_RANGE_LABELS } from "@gurmego/shared";
import { ReportForm } from "./report-form";
import { WhatsappShareButton } from "./whatsapp-share-button";

const CATEGORY_LABELS: Record<string, string> = {
  bakery: "Fırın",
  cafe: "Kahve",
  kahvalti: "Kahvaltı",
  kahve: "Kahve",
  restaurant: "Restoran",
  "street-food": "Sokak lezzeti",
  tatli: "Tatlı",
};

const DAY_LABELS: Record<string, string> = {
  friday: "Cum", fri: "Cum", monday: "Pzt", mon: "Pzt",
  saturday: "Cmt", sat: "Cmt", sunday: "Paz", sun: "Paz",
  thursday: "Per", thu: "Per", tuesday: "Sal", tue: "Sal",
  wednesday: "Çar", wed: "Çar",
};

// `findBySlug` (Plan 1) does not expose lat/lng — only `findInBbox`/the map endpoint does (ADR 002:
// raw SQL is the only way to read the `Unsupported("geography")` column, and the detail endpoint
// deliberately keeps to a standard Prisma `select` for the rest of its fields). Rather than adding a
// raw-SQL branch to the detail endpoint just for this, MVP uses a name+district text search — Google
// Maps resolves this to the correct place reliably at pilot scale (30-45 known venues). Documented
// here as a deliberate simplification, not an oversight; revisit if the pilot shows mis-resolves.
function directionsUrl(venue: VenueDetailType): string {
  const query = encodeURIComponent(`${venue.name} ${venue.district.name}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

export function VenueDetail({ venue }: { venue: VenueDetailType }) {
  return (
    <article data-testid="venue-detail" className="relative mx-auto overflow-hidden pb-10 pt-6 sm:pt-10 lg:pb-16">
      <div className="pointer-events-none absolute -right-28 top-6 -z-10 size-80 rounded-full bg-[#e77959]/10 blur-3xl" aria-hidden="true" />

      <header className="border-b border-[#201d18]/12 pb-6 sm:pb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[0.64rem] font-black uppercase tracking-[0.2em] text-[#9e422b]">
            {CATEGORY_LABELS[venue.category] ?? venue.category.replaceAll("-", " ")}
          </p>
          {venue.isBoutique && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eadfce] px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.14em] text-[#75402f]">
              <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true"><path d="M8 1.8 9.4 6l4.4 1.1-3.4 2.6.2 4.5L8 11.8l-2.6 2.4.2-4.5-3.4-2.6L6.6 6 8 1.8Z" fill="currentColor" /></svg>
              Editör seçkisi
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="max-w-[18ch] font-serif text-[2.65rem] font-semibold leading-[0.94] tracking-[-0.055em] text-[#201d18] sm:text-6xl lg:text-7xl">{venue.name}</h1>
            <p data-testid="district-name" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#201d18]/55">
              <svg viewBox="0 0 20 20" className="size-4 fill-none text-[#d75d3b]" aria-hidden="true"><path d="M10 17s5-4.8 5-9a5 5 0 1 0-10 0c0 4.2 5 9 5 9Z" stroke="currentColor" strokeWidth="1.7" /><circle cx="10" cy="8" r="1.6" fill="currentColor" /></svg>
              {venue.district.name}
            </p>
          </div>

        </div>
      </header>

      <div className="grid gap-5 pt-5 sm:gap-6 sm:pt-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="space-y-5 sm:space-y-6">
          <section className="relative overflow-hidden rounded-[1.5rem] bg-[#201d18] px-5 py-6 text-[#f4f0e7] shadow-[0_18px_45px_rgba(32,29,24,0.13)] sm:px-7 sm:py-7">
            <svg viewBox="0 0 120 120" className="absolute -right-5 -top-7 size-36 text-[#e77959]/15" aria-hidden="true"><circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="12" /><circle cx="60" cy="60" r="22" fill="currentColor" /></svg>
            <div className="relative">
              <p className="flex items-center gap-2 text-[0.63rem] font-black uppercase tracking-[0.2em] text-[#e77959]"><span className="h-px w-6 bg-current" aria-hidden="true" />Neden burada?</p>
              {venue.editorialNote ? (
                <p data-testid="editorial-note" className="mt-4 max-w-[48ch] font-serif text-[1.45rem] font-medium leading-[1.28] tracking-[-0.025em] sm:text-[1.75rem]">“{venue.editorialNote}”</p>
              ) : (
                <p className="mt-4 max-w-[42ch] font-serif text-xl leading-snug text-[#f4f0e7]/65">Kürasyon ekibinin mekan notu yakında burada.</p>
              )}
              <p className="mt-5 text-[0.62rem] font-black uppercase tracking-[0.17em] text-[#f4f0e7]/42">GurmeGo kürasyon ekibi</p>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-[#201d18]/12 bg-[#faf7f0] p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-[8rem_1fr] sm:gap-7">
              <div className="border-b border-[#201d18]/10 pb-5 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-7">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#201d18]/42">Fiyat aralığı</p>
                <p data-testid="price-range" className="mt-2 font-serif text-3xl font-semibold tracking-[0.08em] text-[#d75d3b]">{PRICE_RANGE_LABELS[venue.priceRange]}</p>
                <p className="mt-1 text-xs font-semibold text-[#201d18]/45">kişi başı tahmini</p>
              </div>
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#201d18]/42">İmza lezzetler</p>
                <ul data-testid="signature-items" className="mt-3 flex flex-wrap gap-2">
                  {venue.signatureItems.map((item) => <li key={item} className="rounded-full border border-[#d75d3b]/25 bg-[#d75d3b]/[0.08] px-3 py-2 text-sm font-bold text-[#75402f]">{item}</li>)}
                </ul>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.5rem] border border-[#201d18]/12 bg-[#e8e1d5]" aria-labelledby="directions-title">
            <div className="relative min-h-36 overflow-hidden p-5 sm:min-h-40 sm:p-6">
              <div className="absolute inset-0 opacity-35" aria-hidden="true" style={{ backgroundImage: "linear-gradient(30deg, transparent 44%, rgba(32,29,24,.16) 45%, rgba(32,29,24,.16) 47%, transparent 48%), linear-gradient(120deg, transparent 46%, rgba(32,29,24,.12) 47%, rgba(32,29,24,.12) 49%, transparent 50%)", backgroundSize: "64px 64px" }} />
              <div className="absolute -bottom-12 -right-8 size-44 rounded-full border-[24px] border-[#d75d3b]/20" aria-hidden="true" />
              <div className="relative flex min-h-24 flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#9e422b]">Sıradaki durak</p>
                  <h2 id="directions-title" className="mt-1 font-serif text-2xl font-semibold tracking-[-0.03em]">{venue.district.name}&apos;e doğru yola çık</h2>
                  {venue.transportNote && (
                    <p data-testid="transport-note" className="mt-2 flex max-w-[48ch] items-start gap-2 text-sm font-semibold leading-relaxed text-[#201d18]/60"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#d75d3b]" aria-hidden="true" />{venue.transportNote}</p>
                  )}
                </div>
                <a data-testid="directions-link" href={directionsUrl(venue)} target="_blank" rel="noreferrer" className="group inline-flex min-h-12 w-full shrink-0 items-center justify-between gap-4 rounded-full bg-[#d75d3b] px-5 text-sm font-black text-white shadow-[0_8px_22px_rgba(158,66,43,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[#bd4c30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201d18] focus-visible:ring-offset-2 focus-visible:ring-offset-[#e8e1d5] sm:w-auto">
                  Yol tarifi al
                  <svg viewBox="0 0 20 20" className="size-4 fill-none" aria-hidden="true"><path d="M4 15 15 4m-7 0h7v7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              </div>
            </div>
          </section>

          {venue.googleRating && (
            <a data-testid="google-rating" href={`https://maps.google.com/?q=${encodeURIComponent(venue.name)}`} target="_blank" rel="noreferrer" className="group flex min-h-12 items-center justify-between gap-3 rounded-full border border-[#201d18]/12 bg-[#faf7f0] px-4 text-sm font-black text-[#201d18] transition-colors hover:border-[#d75d3b]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f0e7]" aria-label={`${venue.googleRating} yıldız, ${venue.googleRatingCount} Google yorumu`}>
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 18 18" className="size-4 text-[#d75d3b]" aria-hidden="true"><path d="m9 1.4 1.9 4.7 5 .4-3.8 3.2 1.2 4.9L9 12l-4.3 2.6 1.2-4.9-3.8-3.2 5-.4L9 1.4Z" fill="currentColor" /></svg>
                <span>{venue.googleRating.toFixed(1)}</span>
                <span className="font-medium text-[#201d18]/40">{venue.googleRatingCount} Google yorumu</span>
              </span>
              <span className="text-[#201d18]/35 transition-transform group-hover:translate-x-0.5" aria-hidden="true">Google'da gör ↗</span>
            </a>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-[1.5rem] border border-[#201d18]/12 bg-[#faf7f0] p-5 sm:p-6">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#201d18]/42">Birlikte karar ver</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-[#201d18]/55">Bu mekanı plan yaptığın kişiye gönder.</p>
            <div className="mt-4"><WhatsappShareButton venue={venue} /></div>
          </section>

          <ReportForm venueId={venue.id} />

          <section className="rounded-[1.5rem] border border-[#201d18]/12 bg-[#faf7f0] p-5 sm:p-6">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#201d18]/42">Ziyaret bilgisi</p>
            <p data-testid="opening-hours" className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2.5 text-xs">
              {Object.entries(venue.openingHours).map(([day, hours]) => (
                <span key={day} className="flex items-baseline justify-between gap-2 border-b border-[#201d18]/[0.08] pb-2"><span className="font-black text-[#201d18]/45">{DAY_LABELS[day.toLowerCase()] ?? day}</span><span className="font-bold tabular-nums text-[#201d18]/75">{hours}</span></span>
              ))}
            </p>
            <p data-testid="verified-at" className="mt-4 flex items-center gap-2 text-[0.68rem] font-bold text-[#201d18]/42"><span className="grid size-5 place-items-center rounded-full bg-[#d75d3b]/12 text-[#9e422b]" aria-hidden="true">✓</span>Son doğrulama: {new Date(venue.verifiedAt).toLocaleDateString("tr-TR")}</p>
          </section>
        </aside>
      </div>
    </article>
  );
}
