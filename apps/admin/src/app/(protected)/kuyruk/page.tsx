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

  const token = session?.access_token;

  const refetch = useCallback(async () => {
    if (!token) return;
    const data = await getQueue(token, { status: "PENDING" });
    setItems(data);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  async function handleApprove(id: string) {
    if (!token) return;
    await approveQueueItem(token, id);
    await refetch();
  }

  async function handleReject(id: string) {
    if (!token) return;
    await rejectQueueItem(token, id);
    await refetch();
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

        {items.length === 0 ? (
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
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
