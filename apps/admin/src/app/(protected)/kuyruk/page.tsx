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
    <main data-testid="kuyruk-page">
      <h1>Kürasyon Kuyruğu</h1>
      {items.length === 0 ? (
        <p data-testid="empty-state">Bekleyen bildirim yok.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <QueueItem key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
          ))}
        </ul>
      )}
    </main>
  );
}
