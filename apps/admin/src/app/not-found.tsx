import Link from "next/link";

// §3.1/§5.2 audit finding: no not-found.tsx existed -- an unmatched admin route fell through to
// Next.js's generic default 404.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 px-4 py-6 text-center text-slate-950">
      <h1 className="text-lg font-bold">Bu sayfa bulunamadı</h1>
      <p className="text-sm text-slate-600">Aradığın panel sayfası taşınmış veya hiç var olmamış olabilir.</p>
      <Link href="/kuyruk" className="text-sm font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">
        Kuyruğa dön
      </Link>
    </main>
  );
}
