"use client";
import type { AdminQueueItem } from "@gurmego/shared";

export function QueueItem({
  item,
  onApprove,
  onReject,
  pending = false,
}: {
  item: AdminQueueItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  // True while this item's own approve/reject mutation is in flight. Both buttons are disabled in
  // that window so a double-click (or clicking both approve and reject) can't fire two concurrent
  // mutations against the same queue item.
  pending?: boolean;
}) {
  const reason = typeof item.payload.reason === "string" ? item.payload.reason : "(neden belirtilmemiş)";
  const isNewVenue = item.type === "NEW_VENUE";
  const suggestion = isNewVenue
    ? {
        name: typeof item.payload.name === "string" ? item.payload.name : "(isim belirtilmemiş)",
        districtName: typeof item.payload.districtName === "string" ? item.payload.districtName : null,
        category: typeof item.payload.category === "string" ? item.payload.category : null,
        address: typeof item.payload.address === "string" ? item.payload.address : null,
        note: typeof item.payload.note === "string" ? item.payload.note : null,
      }
    : null;
  return (
    <li
      data-testid="queue-item"
      data-urgent={item.urgent}
      className={`group relative grid gap-4 border border-slate-200 bg-white px-4 py-4 transition-colors hover:border-slate-300 hover:bg-slate-50/70 sm:px-5 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.45fr)_minmax(24rem,1fr)] lg:items-center lg:gap-6 ${
        item.urgent
          ? "border-l-4 border-l-rose-600 bg-rose-50/40 hover:border-l-rose-600 hover:bg-rose-50/70"
          : "border-l-4 border-l-transparent"
      }`}
    >
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">
            {isNewVenue ? "Yeni mekan önerisi" : "Mekan"}
          </span>
          {item.urgent && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-rose-100 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-rose-800">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M8.485 2.495c.674-1.167 2.358-1.167 3.032 0l6.557 11.354c.673 1.166-.169 2.624-1.516 2.624H3.444c-1.347 0-2.189-1.458-1.516-2.624L8.485 2.495ZM10 6.25a.75.75 0 0 1 .75.75v3.25a.75.75 0 0 1-1.5 0V7a.75.75 0 0 1 .75-.75Zm0 7.5a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z" clipRule="evenodd" />
              </svg>
              Acil
            </span>
          )}
        </div>
        {isNewVenue ? (
          <p className="truncate text-sm font-semibold text-slate-950 sm:text-[0.95rem]">{suggestion!.name}</p>
        ) : item.venue ? (
          <p className="truncate text-sm font-semibold text-slate-950 sm:text-[0.95rem]">
            {item.venue.name}
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.596c.75 1.334-.213 2.982-1.742 2.982H3.48c-1.53 0-2.493-1.648-1.743-2.982L8.257 3.1ZM11 7a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0V7Zm-1 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            (mekan silinmiş)
          </p>
        )}
      </div>

      <div className="min-w-0 border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:py-1 lg:pl-6">
        {isNewVenue ? (
          <>
            <p className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">Öneri detayı</p>
            <p className="text-sm leading-5 text-slate-700">
              {suggestion!.districtName ?? "(ilçe belirtilmemiş)"} · {suggestion!.category ?? "(kategori belirtilmemiş)"}
            </p>
            {suggestion!.address && <p className="mt-1 text-sm leading-5 text-slate-700">{suggestion!.address}</p>}
            {suggestion!.note && <p className="mt-1 text-sm leading-5 text-slate-500 italic">{suggestion!.note}</p>}
          </>
        ) : (
          <>
            <p className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">
              Bildirim nedeni
            </p>
            <p className="text-sm leading-5 text-slate-700">{reason}</p>
          </>
        )}
      </div>

      {/* "Onayla" yalnızca bu kuyruk öğesinin kendi durumunu değiştirir (incelendi olarak işaretler) —
          `Venue`'ye YAZMAZ ve `verifiedAt`'e DOKUNMAZ (Plan 4b'nin A3 kararı). Mekan verisini
          düzeltmek veya verified_at'i tazelemek gerekiyorsa ayrı bir admin-venues API çağrısı
          (PUT /admin/venues/:id) veya Prisma Studio ile elle yapılmalı (bu panelde manuel mekan
          düzenleme UI'ı yok, bilinçli bir kapsam kararı — bkz. design doc). */}
      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row lg:justify-end lg:border-t-0 lg:pt-0">
        <button
          type="button"
          onClick={() => onApprove(item.id)}
          disabled={pending}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-center text-xs font-semibold leading-4 text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 lg:max-w-64"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.05l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.815a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
          </svg>
          Onayla (yalnızca incelendi olarak işaretler)
        </button>
        {isNewVenue && (
          <p className="text-[0.68rem] leading-snug text-slate-500 lg:max-w-64">
            Onaylamak bu öneriyi incelendi olarak işaretler, Venue kaydını otomatik oluşturmaz — mekanı CSV
            import veya Prisma Studio ile eklemen gerekir.
          </p>
        )}
        <button
          type="button"
          onClick={() => onReject(item.id)}
          disabled={pending}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-800 shadow-sm transition-colors hover:border-rose-400 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z" />
          </svg>
          Reddet
        </button>
      </div>
    </li>
  );
}
