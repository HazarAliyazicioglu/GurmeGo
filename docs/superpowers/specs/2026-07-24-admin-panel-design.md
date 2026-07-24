# GurmeGo Admin Panel — Design (Plan 3/4)

**Tarih:** 2026-07-24 · **Durum:** Onaylı (kullanıcının açık otonomi talimatı gereği, mevcut onaylı
spec'lerden — prd.md, architecture.md, api-spec.md, Plan 1'in gerçek admin API kodu — sentezlendi;
soru sorulmadı, bkz. STATE.md "kullanıcı kararları")

## Amaç

Plan 1'de tamamlanan admin API'yi (`apps/api/src/admin/*`, `/v1/admin/*`, `curator`/`admin` rol
korumalı) tüketen kürasyon paneli. Kürasyon kuyruğu tüm kullanıcı katkısının tek giriş noktası —
bu panel olmadan hiçbir mekan onaylanamaz, hiçbir CSV import edilemez, hiçbir veri kalitesi
görülemez. Pilot 30-45 mekanı bu panelden yönetecek.

## Kapsam (prd.md FR-AP-01/02/03/04 + Plan 1'in gerçek admin API'si — yeni karar değil, uygulama)

**Sayfalar:**
1. **Giriş** (`/giris`) — Supabase Auth, ardından rol kontrolü: `curator`/`admin` değilse erişim reddedilir
   (backend zaten `RolesGuard` ile 403 döner — bkz. Plan 1 Task 15's doğrulanmış davranışı; panel
   bunu ham hata yerine anlamlı bir "yetkin yok" ekranına çevirir).
2. **Kürasyon kuyruğu** (`/kuyruk`) — `GET /admin/queue?type=&status=` listesi, her satır için
   onayla/reddet aksiyonu (`POST /admin/queue/:id/approve` · `/reject`). MVP'de yalnızca REPORT
   tipi kuyrukta (FR-AP-01, öneri/düzeltme tipleri Faz 2).
3. **Mekanlar** (`/mekanlar`) — liste + manuel CRUD (`POST /admin/venues`, `PUT /admin/venues/:id`),
   versiyon geri alma (`POST /admin/venues/:id/revert/:versionId`), CSV toplu import
   (`POST /admin/import`, satır bazlı hata raporu — FR-AP-02).
4. **Veri kalitesi raporu** (`/rapor`) — `GET /admin/reports/data-quality`: ilçe başına mekan sayısı,
   N günden eski kayıtlar, kaynak dağılımı (FR-AP-03).
5. **Kullanıcılar** (`/kullanicilar`) — `PUT /admin/users/:id/roles`: MVP'de yalnızca `curator` rolü
   atanabilir (`approved_rater` Faz 2, FR-AP-04 — Gurme Puanı henüz yok).
6. **Export** (`/mekanlar` sayfasından bir buton, ayrı sayfa değil) — `GET /admin/export?format=json|csv`.

**Kapsam dışı (Faz 2):** öneri/düzeltme tipi kuyruk kalemleri (yalnızca REPORT var), rating-anomalies
raporu (`GET /admin/reports/rating-anomalies` zaten backend'de Faz 2 olarak işaretli, MVP'de yok),
`approved_rater` rol ataması.

## Mimari

- **Next.js 14, App Router, tamamen CSR** (architecture.md: "admin CSR (iç araç)" — SEO yok,
  kişiselleştirilmiş/yetkilendirilmiş iç araç). Plan 2'nin aksine sayfalar server component olarak
  veri çekmez; her sayfa `"use client"` + `useEffect`/client-side fetch. Bu basitleştirir: Plan 2'de
  bulunan "server component içinde window erişimi" hata sınıfı burada yapısal olarak oluşamaz.
- **Ayrı bir Next.js app**: `apps/admin` (Plan 2'nin `apps/web`'inden tamamen bağımsız, ayrı port —
  `apps/web` 3002, `apps/api` 3001 kullanıyor; `apps/admin` `3003`'te çalışacak, `apps/api`'nin CORS
  varsayılan listesine eklenmesi gerekecek — Plan 2'de aynı sınıf bir bulgu bulunup düzeltilmişti,
  bu sefer plan'a baştan yazılacak).
- **API tüketimi**: `packages/api-client`'ın aynı `createApiClient` (`.get`/`.post` — Plan 2'de
  `.post` eklendi, ayrıca `.put` gerekecek çünkü admin API `PUT /admin/venues/:id` ve
  `PUT /admin/users/:id/roles` kullanıyor — Plan 2'nin `api-client`'ında `.put` yok, bu plan ekleyecek).
  `packages/shared`'ın zod şemaları (`AdminVenueCreateSchema`, `AdminVenueUpdateSchema` zaten var,
  kuyruk/rapor/export response'ları için yeni şemalar gerekebilir — Plan 2'nin kalıbı: gerçek
  backend response şeklini doğrula, varsayma).
- **Auth**: Plan 2'nin `useAuth()`/`auth-context.tsx` deseni aynen kullanılacak (Supabase Auth JS,
  aynı `@supabase/supabase-js` client) — ama bu panelde ek bir rol kontrolü katmanı var: JWT'nin
  `user_role` claim'i `curator`/`admin` değilse, `/giris`'e değil bir "yetkin yok" sayfasına
  yönlendirilir (favorilerin aksine, bu bir "giriş yap" değil "bu hesabın yetkisi yok" durumu).
- **CSV import UI**: `POST /admin/import`, `@fastify/multipart` backend'de zaten kurulu (Plan 1
  Task 16) — panel bir dosya seçici + satır bazlı hata raporu tablosu gösterecek.
- **Stil**: Tailwind CSS, ama Plan 2'nin "rehber" tüketici kimliğinden FARKLI bir görsel dil —
  bu iç araç, editoryal/sıcak değil, işlevsel/yoğun-bilgi (tablo ağırlıklı, form ağırlıklı). Codex
  visual pass'lar burada da var ama brief'ler farklı bir estetik hedefleyecek (bkz. CLAUDE.md'nin
  "UI, tasarım yargısı" kuralı — tablo/form düzeni bazen mekanik, bazen tasarım kararı; task bazında
  ayrılacak).

## Veri akışı

Her sayfa: client component mount → `useAuth()` ile token al → `packages/api-client` üzerinden
ilgili admin endpoint'e istek → `packages/shared` zod şemasıyla doğrula → render. Mutasyonlar
(approve/reject/create/update/revert/roles) sonrası ilgili listeyi refetch et (optimistic update
yok — MVP ölçeğinde, kürasyon ekibi 1-2 kişi, gecikme sorun değil).

## Test stratejisi

Plan 2'nin deseniyle aynı: her sayfa/component için Vitest birim testi (veri çekme mantığı,
mutasyon çağrıları — safeParse dahil), UI'ın kendisi için ayrı Playwright smoke test yok (bu iç
araç, pilotun kullanıcı yüzü değil — development-guidelines.md §4'ün "Smoke E2E" stratejisi
tüketici yüzeyine odaklı, admin panel için ayrı bir E2E gereksinimi yok, birim testler yeterli).

## Self-review

- Placeholder/TBD yok.
- İç tutarlılık: tüm sayfalar Plan 1'in GERÇEK, halihazırda test edilmiş admin endpoint'lerine
  karşılık geliyor — yeni backend işi gerektirmiyor (yalnızca `packages/api-client`'a `.put` eklemek
  gibi küçük, additive işler, Plan 2'nin `.post` eklemesiyle aynı desende).
- Kapsam: tek bir alt-sistem (`apps/admin`), bağımsız bir plana uygun büyüklükte — Plan 2'yle
  kıyaslanabilir boyutta (6 sayfa vs. Plan 2'nin 4 sayfası, ama admin sayfaları CSR-only olduğu
  için SSR/ISR karmaşıklığı yok, dengelenmiş bir kapsam).
- Belirsizlik: yok — her karar mevcut onaylı dokümana veya Plan 1'in gerçek koduna referans veriyor.
