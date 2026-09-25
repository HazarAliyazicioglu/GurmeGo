import Link from "next/link";

// §2.6 audit finding: no not-found.tsx existed -- an unmatched route (or an explicit notFound()
// call, e.g. [district]/page.tsx for an unknown slug) fell through to Next.js's generic,
// unbranded default 404 instead of GurmeGo's own warm/editorial voice.
export default function NotFound() {
  return (
    <main>
      <h1>Bu sayfa bulunamadı</h1>
      <p>Aradığın mekan ya da sayfa taşınmış veya hiç var olmamış olabilir.</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-terracotta px-5 text-sm font-black text-white shadow-[0_8px_22px_rgba(158,66,43,0.28)] transition-all hover:-translate-y-0.5 hover:bg-terracottaDark focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      >
        Mekanları keşfet
      </Link>
    </main>
  );
}
