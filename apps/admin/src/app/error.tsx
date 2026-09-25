"use client";

// §3.1/§5.2 audit finding: no error.tsx existed -- an unhandled render/data error in any admin
// page crashed to Next.js's generic error screen instead of a recoverable one. `reset()` re-renders
// the segment without a full page reload (Next.js App Router convention for this file).
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 px-4 py-6 text-center text-slate-950">
      <h1 className="text-lg font-bold">Bir şeyler ters gitti</h1>
      <p className="text-sm text-slate-600">Sayfa yüklenirken beklenmeyen bir hata oluştu.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Tekrar dene
      </button>
    </main>
  );
}
