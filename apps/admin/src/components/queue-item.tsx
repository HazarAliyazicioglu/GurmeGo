"use client";
import type { AdminQueueItem } from "@gurmego/shared";

export function QueueItem({
  item,
  onApprove,
  onReject,
}: {
  item: AdminQueueItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const reason = typeof item.payload.reason === "string" ? item.payload.reason : "(neden belirtilmemiş)";
  return (
    <li data-testid="queue-item" data-urgent={item.urgent}>
      <p>{item.venue?.name ?? "(mekan silinmiş)"}</p>
      <p>{reason}</p>
      {/* "Onayla" yalnızca bildirimi incelenmiş olarak işaretler ve mekanın verified_at'ini yeniler —
          mekan verisini OTOMATİK DÜZELTMEZ. Veriyi düzeltmek gerekiyorsa Postman/Prisma Studio ile
          PUT /admin/venues/:id kullan (bu panelde manuel mekan düzenleme UI'ı yok, bilinçli bir kapsam
          kararı — bkz. design doc). */}
      <button onClick={() => onApprove(item.id)}>Onayla (yalnızca incelendi olarak işaretler)</button>
      <button onClick={() => onReject(item.id)}>Reddet</button>
    </li>
  );
}
