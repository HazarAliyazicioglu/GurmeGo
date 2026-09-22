"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiHttpError } from "@gurmego/api-client";
import { useAuth } from "@/lib/auth-context";
import { getDataQualityReport } from "@/lib/api";
import type { DataQualityReport } from "@gurmego/shared";

export default function VeriKalitesiPage() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = session?.access_token;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    getDataQualityReport(token)
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setError(null);
      })
      .catch(async (err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiHttpError && err.status === 401) {
          try {
            const result = await signOut();
            if (!cancelled) {
              if (result?.error) setError("Çıkış yapılamadı. Tekrar deneyin.");
              else router.push("/giris");
            }
          } catch {
            if (!cancelled) setError("Çıkış yapılamadı. Tekrar deneyin.");
          }
          return;
        }
        setError(
          err instanceof ApiHttpError && err.status === 403
            ? "Bu raporu görüntüleme yetkiniz yok."
            : "Rapor yüklenemedi. Sayfayı yenileyip tekrar deneyin.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, signOut, router]);

  if (loading) {
    return (
      <p role="status" aria-live="polite">
        Yükleniyor…
      </p>
    );
  }

  return (
    <main
      data-testid="veri-kalitesi-page"
      className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8 lg:py-8"
    >
      <div className="mx-auto w-full max-w-[70rem]">
        <header className="mb-5 border-b border-slate-300 pb-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            <span className="h-2 w-2 rounded-sm bg-blue-700" aria-hidden="true" />
            GurmeGo / Operasyon
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Veri Kalitesi</h1>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 px-4 py-3.5 text-rose-900 shadow-sm"
          >
            <p className="text-sm leading-5">{error}</p>
          </div>
        )}

        {report && (
          <div className="grid gap-6 sm:grid-cols-3">
            <section aria-label="İlçe başına mekan sayısı" className="border border-slate-300 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">İlçe başına mekan</h2>
              <ul className="space-y-1.5">
                {report.perDistrict.map((row) => (
                  <li key={row.name} className="flex items-center justify-between text-sm">
                    <span>{row.name}</span>
                    <span className="font-bold tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="Güncelliği geçmiş mekan sayısı" className="border border-slate-300 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Güncelliği geçmiş</h2>
              <p className="text-3xl font-bold tabular-nums">{report.staleCount}</p>
            </section>

            <section aria-label="Kaynağa göre mekan sayısı" className="border border-slate-300 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Kaynak dağılımı</h2>
              <ul className="space-y-1.5">
                {report.bySource.map((row) => (
                  <li key={row.source} className="flex items-center justify-between text-sm">
                    <span>{row.source}</span>
                    <span className="font-bold tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
