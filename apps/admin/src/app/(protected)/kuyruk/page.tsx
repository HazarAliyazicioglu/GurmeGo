"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getQueue, approveQueueItem, rejectQueueItem } from "@/lib/api";
import { QueueItem } from "@/components/queue-item";
import type { AdminQueueItem } from "@gurmego/shared";

export default function KuyrukPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<AdminQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The set of row ids currently being approved/rejected — a row's buttons are disabled while its own
  // id is in this set, so a double-click (or clicking both approve and reject) can't fire two
  // concurrent mutations against the same queue item. This MUST be a set, not a single shared id:
  // with a single id, starting row B's mutation while row A's is still in flight overwrote the
  // shared value and re-enabled row A's buttons mid-flight, allowing a double-fire on row A.
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());

  const token = session?.access_token;

  const refetch = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getQueue(token, { status: "PENDING" });
      setItems(data);
      setError(null);
    } catch {
      // Same pattern as apps/admin/src/app/(protected)/import/page.tsx: without this, a rejected
      // getQueue() (network error, 401 on token expiry, malformed response) would leave `loading`
      // true forever — a permanently blank page with no feedback.
      setError("Kuyruk yüklenemedi. Sayfayı yenileyip tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function addMutatingId(id: string) {
    setMutatingIds((prev) => new Set(prev).add(id));
  }

  function removeMutatingId(id: string) {
    setMutatingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleApprove(id: string) {
    if (!token) return;
    addMutatingId(id);
    setError(null);
    try {
      await approveQueueItem(token, id);
      await refetch();
    } catch {
      setError("İşlem gerçekleştirilemedi. Tekrar deneyin.");
    } finally {
      removeMutatingId(id);
    }
  }

  async function handleReject(id: string) {
    if (!token) return;
    addMutatingId(id);
    setError(null);
    try {
      await rejectQueueItem(token, id);
      await refetch();
    } catch {
      setError("İşlem gerçekleştirilemedi. Tekrar deneyin.");
    } finally {
      removeMutatingId(id);
    }
  }

  if (loading) return null;

  return (
    <main
      data-testid="kuyruk-page"
      className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8 lg:py-8"
    >
      <div className="mx-auto w-full max-w-[90rem]">
        <header className="mb-5 border-b border-slate-300 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                <span className="h-2 w-2 rounded-sm bg-blue-700" aria-hidden="true" />
                GurmeGo / Operasyon
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Kürasyon Kuyruğu
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-600">
                Bekleyen mekan bildirimlerini inceleyin ve sonuçlandırın.
              </p>
            </div>
            <div className="flex w-fit items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm">
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                {items.length > 0 && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-30" />
                )}
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    items.length > 0 ? "bg-blue-600" : "bg-slate-400"
                  }`}
                />
              </span>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Bekleyen
                </p>
                <p className="text-sm font-bold tabular-nums text-slate-900">{items.length} bildirim</p>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 px-4 py-3.5 text-rose-900 shadow-sm"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.596c.75 1.334-.213 2.982-1.742 2.982H3.48c-1.53 0-2.493-1.648-1.743-2.982L8.257 3.1ZM11 7a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0V7Zm-1 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <p className="text-sm leading-5">{error}</p>
          </div>
        )}

        {/* Only show list/empty-state content when the load genuinely succeeded — rendering the
            "nothing pending, all caught up" empty state alongside the error banner above ("Kuyruk
            yüklenemedi") would be a contradictory message to a curator, and rendering the list
            section when the load failed has nothing to show anyway. */}
        {!error &&
          (items.length === 0 ? (
            <section className="border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.05l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.815a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
              </div>
              <p data-testid="empty-state" className="text-sm font-semibold text-slate-800">
                Bekleyen bildirim yok.
              </p>
              <p className="mt-1 text-xs text-slate-500">Kürasyon kuyruğu güncel.</p>
            </section>
          ) : (
            <section aria-label="Bekleyen bildirimler">
              <div className="mb-2 hidden grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.45fr)_minmax(24rem,1fr)] gap-6 px-5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500 lg:grid">
                <span>Mekan</span>
                <span className="pl-6">Bildirim</span>
                <span className="text-right">İşlem</span>
              </div>
              <ul className="space-y-2">
                {items.map((item) => (
                  <QueueItem
                    key={item.id}
                    item={item}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    pending={mutatingIds.has(item.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
      </div>
    </main>
  );
}
