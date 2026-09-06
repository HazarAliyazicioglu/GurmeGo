# GurmeGo Admin Panel — Design (Plan 3/4)

**Tarih:** 2026-07-24 · **Durum:** Onaylı (kullanıcının açık otonomi talimatı gereği, mevcut onaylı
spec'lerden — prd.md, architecture.md, api-spec.md, Plan 1'in gerçek admin API kodu — sentezlendi;
soru sorulmadı, bkz. STATE.md "kullanıcı kararları")

## Amaç

Plan 1'de tamamlanan admin API'yi (`apps/api/src/admin/*`, `/v1/admin/*`, `curator`/`admin` rol
korumalı) tüketen, KASITLI OLARAK KÜÇÜK TUTULMUŞ bir kürasyon aracı. Kürasyon kuyruğu (REPORT
onay/red) kullanıcı bildirimlerinin işlenebilmesi için tek giriş noktası — bu olmadan
FR-AP-01 hiç karşılanmaz. CSV import, 30-45 mekanlık ilk veri yüklemesi için gerekli.

## Red-team sonrası kapsam daraltması (2026-07-25)

`idea-red-team` (Codex, yüksek güven) bu paneli **NO-GO** olarak işaretledi: 1-2 kişinin 6 haftada
yöneteceği 30-45 kayıt için 6 sayfalı ayrı bir uygulamanın, çözdüğü operasyon yükünden daha pahalı
bir yük yarattığı gerekçesiyle. Tam rapor: `docs/superpowers/plans/plan3-idea-red-team-prompt.md`
(prompt) + oturum kaydı. Kullanıcıya ham bulgular gösterildi, karar kullanıcıya bırakıldı — kullanıcı
kararı en uygun seçeneği seçmemi istedi.

**Karar: kapsamı ikiye indir — kürasyon kuyruğu + CSV import. Gerisini çıkar.**

### Kabul edilen bulgular (kapsamdan çıkarıldı)
- **Kullanıcı rol atama sayfası** (Kullanıcılar `/kullanicilar`): kabul. Gerekçe: 2-3 iç kullanıcı
  için ayrı bir yetkilendirme arayüzü orantısız — Supabase dashboard'dan elle rol ataması (tek
  seferlik, nadir bir işlem) yeterli.
- **Veri kalitesi raporu** (`/rapor`): kabul. Gerekçe: 30-45 satırlık veri setinde bir SQL sorgusu/
  script aynı bilgiyi verir; ayrı bir rapor sayfası bu ölçekte "raporlama tiyatrosu".
- **Versiyon geri alma UI'ı**: kabul. Gerekçe: pilotta gerçek kullanım kanıtı yok; ihtiyaç
  doğarsa `POST /admin/venues/:id/revert/:versionId`'e Postman'la erişilebilir (backend zaten var
  ve test edilmiş).
- **Manuel mekan CRUD'u ayrı bir sayfa/form olarak**: kabul (kısmi). Gerekçe: CSV import ana
  yükleme yolunu karşılıyor; tekil düzenlemeler için Postman/Prisma Studio pilot ölçeğinde yeterli.
  Backend endpoint'leri (`POST`/`PUT /admin/venues`) zaten var ve test edilmiş — istenirse Faz 2'de
  UI eklenebilir.
- **Export butonu ayrı bir UI elemanı olarak**: kabul. Gerekçe: `GET /admin/export?format=json|csv`
  zaten doğrudan tarayıcıdan/curl'den çağrılabilir bir GET endpoint'i, ayrı bir buton gerektirmiyor.

### Reddedilen bulgu
- **Kürasyon kuyruğunun kendisinin de gereksiz olduğu iddiası** ("REPORT hacmi düşük, WhatsApp
  yeter"): reddedildi. Gerekçe: prd.md FR-AP-01 "bekleyen mekan önerileri + güncelleme önerileri +
  moderasyon kuyruğu tek yerde" MVP kapsamında zaten onaylı bir gereksinim (round 1-3 red-team'den
  geçmiş) — WhatsApp'la koordinasyon "kimin hangi bildirimi ne zaman gördüğü/işlediği" konusunda
  denetlenebilir bir iz bırakmaz, `ContributionQueue`'nun onay-akışı-zorunlu mimarisiyle (CLAUDE.md
  "Asla yapma": ContributionQueue'yu atlama) doğrudan çelişir. **Bu yanlışsa ne olur:** pilot
  boyunca 5'ten az REPORT gelirse (Codex'in "erken sinyal" eşiği), bu sayfa da gereksiz yatırım
  olmuş olur — ama backend zaten var ve test edilmiş, UI maliyeti küçük (tek sayfa, ~1 task), riski
  düşük.

## Kapsam (daraltılmış — yalnızca 2 sayfa + giriş)

**Sayfalar:**
1. **Giriş** (`/giris`) — Supabase Auth, ardından rol kontrolü: `curator`/`admin` değilse erişim
   reddedilir (backend zaten `RolesGuard` ile 403 döner — bkz. Plan 1 Task 15's doğrulanmış
   davranışı; panel bunu ham hata yerine anlamlı bir "yetkin yok" ekranına çevirir).
2. **Kürasyon kuyruğu** (`/kuyruk`, ana sayfa) — `GET /admin/queue?type=&status=` listesi, her
   satır için onayla/reddet aksiyonu (`POST /admin/queue/:id/approve` · `/reject`). MVP'de yalnızca
   REPORT tipi kuyrukta (FR-AP-01, öneri/düzeltme tipleri Faz 2).
3. **CSV Import** (`/import`) — `POST /admin/import`, dosya seçici + satır bazlı hata raporu
   (FR-AP-02).

**Kapsam dışı (Faz 2 veya "ihtiyaç doğarsa Postman/Prisma Studio/Supabase dashboard ile"):**
kullanıcı rol atama UI'ı, veri kalitesi raporu UI'ı, versiyon geri alma UI'ı, manuel mekan CRUD
UI'ı, export butonu, öneri/düzeltme tipi kuyruk kalemleri (yalnızca REPORT var), rating-anomalies
raporu.

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
  `.post` eklendi). Daraltılmış kapsamda `.put` GEREKMİYOR (venue update/roles UI'ı kapsam dışı
  bırakıldı) — yalnızca `.get` (kuyruk listesi) ve `.post` (approve/reject/import) kullanılacak.
  `packages/shared`'a kuyruk listesi response'u için yeni bir şema gerekecek (gerçek backend
  response şeklini doğrula, varsayma — Plan 2'nin kalıbı).
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
- İç tutarlılık: her iki sayfa da Plan 1'in GERÇEK admin endpoint'lerine karşılık geliyor. **Düzeltme
  (plan-red-team sonrası):** bu satır ilk yazıldığında "yeni backend işi gerektirmiyor" diyordu —
  yanlıştı. `POST /admin/import` yalnızca CSV'yi valide ediyor, hiç kalıcı yazmıyordu (doğrudan kod
  okuyarak doğrulandı, bkz. implementasyon planının Task 2'si) — bu, CSV import sayfasının var olma
  sebebinin kendisini çürüten bir backend boşluğuydu, küçük bir detay değil. Plan artık bunu Task 2
  olarak (UI task'larından önce) kapsıyor.
- Kapsam: tek bir alt-sistem (`apps/admin`), red-team sonrası KASITLI OLARAK küçük — 2 sayfa +
  giriş, Plan 2'nin 1/3'ünden az. Bu, "az kod" değil "az risk, az bakım yükü" hedefliyor — Codex'in
  NO-GO gerekçesi (6 sayfalık ayrı uygulamanın operasyon yükü, çözdüğü yükten pahalı) bu haliyle
  geçerliliğini büyük ölçüde kaybediyor: 2 sayfa + giriş, gerçek bir MVP gereksinimini (FR-AP-01)
  ve somut bir yakın-vadeli ihtiyacı (30-45 mekan toplu yükleme) karşılıyor, gerisi Postman/Prisma
  Studio/Supabase dashboard'a bırakılıyor.
- Belirsizlik: yok — her karar mevcut onaylı dokümana, Plan 1'in gerçek koduna, veya bu red-team
  kararına referans veriyor.
