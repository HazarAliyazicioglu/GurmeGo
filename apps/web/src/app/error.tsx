"use client";

// §2.6 audit finding: no error.tsx existed -- an unhandled render/data error in any page (or its
// server component) crashed to Next.js's generic unbranded error screen instead of a recoverable,
// on-brand one. `reset()` re-renders the segment without a full page reload (Next.js App Router
// convention for this file).
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <h1>Bir şeyler ters gitti</h1>
      <p>Sayfa yüklenirken beklenmeyen bir hata oluştu. Bağlantını kontrol edip tekrar dene.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-terracotta px-5 text-sm font-black text-white shadow-[0_8px_22px_rgba(158,66,43,0.28)] transition-all hover:-translate-y-0.5 hover:bg-terracottaDark focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      >
        Tekrar dene
      </button>
    </main>
  );
}
