# GurmeGo — Mevcut Ürün Review & İyileştirme Kararları

**Amaç:** Yeni özellik eklemek değil, mevcut backend/web/admin/mobile'ı sırayla gözden geçirip
her başlıkta "burada değişiklik gerekiyor mu, neden, ne zaman" kararını kaydetmek — hem
unutmamak hem de sonra hızlıca aksiyona geçebilmek için.

**Sıra kuralı:** 1 → 1.1 → 1.2 → ... → 1.6 → 2 → 2.1 → ... → 5. Bir alt başlık yoksa bir üst
seviyeye atlanır (örn. 1.6'dan sonra 2'ye). Kaynak envanter: bu konuşmada 2026-09-09'da 4 paralel
fork ile çıkarılan A-Z döküm (backend/web/admin/mobile).

**Standart pratik (2026-09-09'dan itibaren):** her başlıkta içerik sunulduktan sonra otomatik
olarak optimizasyon + güvenlik açığı taraması yapılır (kod okunarak, varsayımla değil) — kullanıcı
ayrıca istemese de. Bulgu varsa buraya kaydedilir, yoksa "doğrulandı, sorun yok" notu düşülür.

**Kapsam politikası:** Plana hem **şu an çözülmesi gereken** sorunlar hem de **ileride sorun
çıkarma ihtimali olan** (henüz aktif olmayan ama riskli) bulgular yazılır — küçük/büyük fark
etmez. Bilinçli kabul edilmiş trade-off'lar (kod içinde zaten "bilinçli karar" diye belgelenmiş
olanlar) "sorun" olarak değil, "ertelendi/kabul edildi — hangi koşulda yeniden bakılır" etiketiyle
kaydedilir; onlar da unutulmasın diye buradadır.

**Ürün vizyonu (2026-09-09'dan itibaren, tüm bölümlere uygulanır):** Bu proje büyük ölçekli bir
şirket ürünü olma hedefiyle geliştiriliyor/iyileştiriliyor. Bu yüzden özellikle **2 (Web), 3
(Admin), 4 (Mobile)** bölümlerinde salt bug/optimizasyon taraması yetmez — her başlıkta ayrıca
"bu, kullanıcı için en kullanışlı/akılda kalıcı hali mi" sorusu da soruluyor ve gerekirse öneri
eklenir. Bu öneriler "sorun" değil, "büyüme/marka hedefine göre iyileştirme fırsatı" olarak ayrı
etiketlenir — karıştırılmasın diye teknik bulgulardan ayrı bir alt başlıkta tutulur.

### Ürün vizyonu — netleştirilen kararlar (2026-09-09)

- **Hedef kitle:** Yerli gurme/foodie kullanıcılar + turistler + genç/sosyal medya kitlesi + **"bir
  semte gittiğinde istediği tarzda mekan arayan herkes"** (bu sonuncusu en geniş ve en sık kullanım
  senaryosu olabilir — konum+mod bazlı keşif niyeti, sadece "butik mekan kürasyonu" değil).
- **Marka kimliği:** Mevcut web'in sıcak/editöryel-dergi kimliği (kiremit aksan, serif başlık, krem
  zemin) **korunacak ve güçlendirilecek** — zincirlerden ayrışmanın kaynağı bu, büyük ölçekte de
  değerli. Tasarım tokenı/tema sistemi eksikliği (2.3'te not edilecek) bu güçlendirmenin önündeki
  teknik engel.
- **Referans ürünler:** Tek bir modele kopyalanmıyor — Michelin/The Infatuation'ın editöryel
  kürasyon tonu + Yelp/TripAdvisor'ın geniş kullanıcı katkısı hacmi + Resy/Beli'nin butik/seçkin
  his'i harmanlanıyor, ama **kendi kimliği** öncelikli. Pratik sonuç: bugünkü MVP'nin editöryel not
  ağırlıklı yaklaşımı doğru yönde, ama "geniş kullanıcı katkısı" (Faz 2'de zaten planlı — Gurme
  Puanı, daha fazla kullanıcı review'u) markanın uzun vadeli kimliğinin bir parçası, sadece
  "sonra eklenecek özellik" değil.
- **Ölçek ufku: sadece İstanbul, derinlik odaklı.** Türkiye geneli/uluslararası genişleme
  planlanmıyor. **Mimari sonucu:** çok dilli/çoklu para birimi/bölgesel veri modeli gibi
  soyutlamalara YATIRIM YAPILMAYACAK — mevcut tek-şehir, tek-dil, TL-sabit tasarım doğru karar,
  değiştirilmeyecek. Bu conservatif kalmalı: "belki büyürüz" diye erken genişletme yapılmayacak.

## İlerleme çizelgesi

- [x] **1** — Backend (`apps/api`) genel bakış + optimizasyon analizi
- [x] 1.1 — Modül haritası
- [x] 1.2 — Uçlar (API endpoint envanteri)
- [x] 1.3 — Veri modeli (Prisma schema)
- [x] 1.4 — Rule engine (butik/re-verify/moderasyon)
- [x] 1.5 — Auth/yetki, cache/rate-limit, kürasyon akışı
- [x] 1.6 — Backend eksik/zayıf yönler
- [x] 2 — Web/PWA (`apps/web`) genel bakış
- [x] 2.1 — Route haritası
- [x] 2.2 — Özellikler
- [x] 2.3 — Görünüş/tasarım dili
- [x] 2.4 — State ve race-guard'lar
- [x] 2.5 — PWA/SEO
- [x] 2.6 — Web eksik/zayıf yönler
- [x] 3 — Admin panel (`apps/admin`) genel bakış
- [x] 3.1 — Route ve özellikler
- [x] 3.2 — Görünüş
- [x] 3.3 — Admin eksik/zayıf yönler
- [x] 4 — Mobile app (`apps/mobile`) genel bakış
- [x] 4.1 — Navigasyon ve ekranlar
- [x] 4.2 — Görünüş/UI
- [x] 4.3 — Native özellikler ve config
- [x] 4.4 — Build/dağıtım durumu
- [x] 4.5 — Mobile eksik/zayıf yönler
- [x] 5 — Ortak gözlemler (tüm katmanlar)

---

## Kararlar (kronolojik, başlık başlık)

### 1 — Backend genel bakış + optimizasyon analizi
**Genel değerlendirme:** Kod kalitesi beklenenin üzerinde — GiST spatial index zaten kurulu,
keyset pagination'daki float-jitter sorunu bilinçli çözülmüş, `FOR UPDATE` ile race condition'lar
kilitlenmiş, `TRUST_PROXY_HOPS` ile rate-limit IP sahteciliği önlenmiş, CORS credentialed doğru,
Swagger prod'da kapalı. **Acil performans sorunu yok.**

**Belirlenen 6 ihtiyaç — henüz UYGULANMADI:**
1. Observability/logging yok (pino/winston, sadece console). Prod'a çıkmadan önce şart. *(orta öncelik)*
2. `@fastify/compress` kayıtlı değil — JSON yanıtları sıkıştırılmıyor. Ucuz, hızlı eklenir. *(orta öncelik)*
3. `@fastify/helmet` kayıtlı değil — güvenlik header'ları (CSP, X-Content-Type-Options vs.) yok. Ucuz, hızlı eklenir. *(orta öncelik)*
4. DB connection pooling kararı yok (Supabase pgbouncer/transaction pooler mı, direct connection
   mı) — Plan 4e/infra ile birlikte netleşecek, kod değişikliği değil config kararı. *(orta öncelik)*
5. Hot-path cache yok — mevcut `CacheStore` soyutlaması şu an sadece rate-limit sayaçlarında
   kullanılıyor, `GET /venues` gibi sık okunan uçlarda cache yok. *(ertelendi — trafik büyümeden erken optimizasyon olur)*
6. `openNow` filtresi her satırda regex/`split_part` ile parse yapıyor (`venues.repository.ts:217-241`) —
   yazma-zamanında normalize sütunlara taşınabilir. *(ertelendi — MVP ölçeğinde önemsiz)*

**Bilinen ama bu bölümün kapsamı dışı (envanterden geldi, ilerleyen bölümlerde — muhtemelen 1.6'da —
tekrar ele alınacak, burada tekrar üretilmedi):** Gurme Puanı hesaplaması hiç yok, pgvector/semantic
search hiç kurulmamış, backend e2e testleri bu makinede DB olmadığı için hiç doğrulanamadı.

### 1.1 — Modül haritası
**9 modül** (`auth`, `venues`, `districts`, `favorites`, `reports`, `admin/{queue,reports,users,venues}`,
`rule-engine`, `common`, `prisma`) — bağımlılık yönü net, `rule-engine`'in hiç controller'ı yok
(sadece servis olarak inject ediliyor).

**Güvenlik bulgusu — UYGULANMADI:**
- `favorites/favorites.controller.ts`: sadece `GET /me/lists` `RateLimitGuard` ile korunuyor.
  `POST /me/lists` (yeni liste), `POST /me/lists/:id/venues` (favori ekle), `DELETE
  /me/lists/:id/venues/:venueId` (favori sil) — üç yazma ucu da rate-limitsiz. Auth zorunlu olduğu
  için anonim değil ama kayıtlı/ele geçirilmiş bir hesap sınırsız liste/favori yazabilir. Diğer tüm
  yazma uçları (`reports`, `admin/*`) bu konuda tutarlı — sadece burada eksik.

**Go-live checklist'e not (kod değil, config/süreç):**
- `SUPABASE_JWT_ISSUER`/`SUPABASE_JWT_AUDIENCE` şu an bilinçli atlanıyor (gerçek Supabase projesi
  yok, Plan 4e'yi bekliyor). Şu an risk değil ama prod'a çıkmadan önce ikisi de set edilmeli.

**Doğrulanan, sorun yok:** tüm `admin/*` controller'ları tutarlı `RolesGuard`+`@Roles`; `JwtAuthGuard`
tasarımı sağlam (header yoksa anonim geçiş, geçersiz token'da 401 — bypass edilemiyor); `RolesGuard`
user yoksa 401/rol uyuşmazsa 403 doğru ayrılmış.

### 1.2 — Uçlar (endpoint envanteri)
Tam liste sohbet geçmişinde. Genel input validasyonu sıkı: `reason` max 500, mekan alanları
sınırlı (`name` max 200, `editorialNote` max 1000, `signatureItems` max 10), `limit` max 50,
`radiusM` max 20000, `X-User-Location` header zod ile fail-open doğrulanıyor. CSV import bilinçli
olarak stream tabanlı parse ediyor (event loop'u kilitlememek için).

**Bulgu — düşük öncelik, UYGULANMADI:**
- Admin yazma uçlarında (`admin/queue/approve|reject`, `admin/venues` CRUD, **özellikle
  `admin/import`**) rate-limit yok. Curator/admin-only olduğu için genel risk düşük, ama
  `admin/import` en ağır uç (dosya parse + N satır insert) — ele geçirilmiş bir curator hesabı
  veya scriptli tekrar yükleme DB'yi zorlayabilir.

**Küçük tutarlılık notu, gerçek açık değil:** `admin/users/:id/roles`'ta `@Body("role")` zod
pipe'ından geçmiyor ama `MVP_ASSIGNABLE_ROLES = ["curator"]` inline allowlist'i güvenli kılıyor
(admin rolü bu uçtan atanamıyor).

**Doğrulanan, sorun yok:** IDOR kontrolü (favorites'te liste sahipliği her yazmadan önce
kontrol ediliyor), admin uçları rol bazlı kapalı.

### 1.3 — Veri modeli (Prisma schema)
Modeller: `City`, `District`, `Venue` (PostGIS `geography`, GiST index), `VenueVersion`,
`ContributionQueue`, `User`, `FavoriteList`, `Favorite`, `RateLimitCounter`. pgvector extension'ı
ve `gourmet_score` alanı şemada yok (bilinen, Faz 2 / Gurme Puanı kapsamı).

**🔴 KRİTİK bulgu — UYGULANMADI:**
`FavoriteList.userId` → `User.id` zorunlu FK (`ON DELETE RESTRICT`) var, ama `apps/api/src`
içinde **hiçbir yerde** `prisma.user.create`/`upsert` çağrısı yok — Supabase Auth ile uygulamanın
kendi `User` tablosu arasında senkronizasyon mekanizması (trigger/webhook/lazy-upsert) eksik.
`prisma/seed.ts` da `User` seed'lemiyor. Sonuç: gerçek bir kullanıcı favori listesi oluşturmaya
çalıştığında Postgres FK ihlali → temiz hata değil, 500. **Favoriler özelliği prod'da şu haliyle
gerçek kullanıcılar için çalışmaz.** Testlerde yakalanmamış çünkü `favorites.service.spec.ts`
tamamen mock'lu Prisma kullanıyor, gerçek FK hiç egzersiz edilmiyor.
→ **Aksiyon gerekiyor:** JWT doğrulandığında (JwtAuthGuard içinde ya da ayrı bir interceptor'da)
`User` satırını lazy-upsert eden bir mekanizma eklenmeli, ya da Supabase tarafında bir
auth-hook/trigger ile senkron tutulmalı.

**Daha küçük bulgular:**
- Tüm FK'ler `ON DELETE RESTRICT` (ContributionQueue.venueId hariç, o `SET NULL`) — hesap silme
  (KVKK, Plan 4d) önce `FavoriteList`/`Favorite` satırlarının elle temizlenmesini gerektirecek,
  şu an böyle bir kod yok (zaten Plan 4d'nin kapsamında bekleniyordu, burada teyit edildi).
- `User.email` normalizasyonu (lowercase zorlanıyor mu) User provisioning eklenmeden test edilemez,
  o işle birlikte ele alınmalı.

### 1.4 — Rule engine (butik / re-verify / moderasyon)
İki servis: `boutique.service.ts` (saf fonksiyon, DB'siz), `re-verify.service.ts` (cron, her gece
03:00). Moderasyon eşiği (`RULES_MOD_AUTO_HIDE_REPORTS`) aslında `reports`/`admin-queue`
servislerinde uygulanıyor, bu modülde değil.

**Optimizasyon/güvenlik taraması — sorun bulunmadı, doğrulandı:**
- `re-verify.service.ts`'in idempotency'si sağlam: `findFirst` fast-path (dokümante edilmiş şekilde
  atomic değil, sadece optimizasyon) + partial unique index + P2002 yakalama = çoklu API instance'ı
  aynı cron'u aynı anda çalıştırsa bile duplicate kayıt oluşmuyor.
- `rule-engine`'in hiçbir route'u yok, dışarıdan tetiklenemiyor — saldırı yüzeyi sıfır.
- Eşikler (`RULES_*`) boot-time'da zorunlu, hardcode yok, `rule-config.ts` tek kaynak.

**Küçük ölçek notu, düşük öncelik:** `enqueueStale()` stale mekanları tek tek sırayla işliyor
(`findFirst` + `create`, batch değil). MVP ölçeğinde (birkaç yüz mekan) sorun değil; katalog
büyürse (binlerce mekan aynı anda stale olursa) cron'un çalışma süresi uzayabilir — batch/bulk
insert'e geçmek trafik büyümeden erken optimizasyon olur, şimdi yapılmayacak.

### 1.5 — Auth/yetki, cache/rate-limit, kürasyon akışı
Supabase JWKS ile RS256/ES256 doğrulama, `RolesGuard` route bazlı. Redis yok: Postgres tabanlı
`CacheStore`/`RateLimitCountersRepository`, saatlik cleanup cron'u. Kürasyon: rapor/CSV/manuel →
`ContributionQueue` → öncelik sıralı liste → approve/reject.

**Bulgu — düşük öncelik, ileride sorun çıkarma ihtimali (aktif değil, kod kokusu):**
`rate-limit.guard.ts`: `req.ip ?? req.headers["x-forwarded-for"] ?? "unknown"` — Fastify'de
`req.ip` pratikte hiç boş dönmez, yani XFF fallback'i şu an ölü kod. Ama tetiklenirse
`main.ts`'in `TRUST_PROXY_HOPS` sanitizasyonunu atlayıp istemci tarafından tamamen sahtelenebilir
bir header'ı doğrudan rate-limit anahtarı yapar — saldırgan kendi bucket'ını seçebilir hale gelir.
→ **Aksiyon:** fallback kaldırılmalı, sadece `req.ip` kullanılmalı.

**Doğrulanan, sorun yok:** `increment()` atomik tek-statement pencere yönetimi; cleanup cron zaten
önceki bir "unbounded table growth" bulgusunun düzeltmesi; `AdminQueueService.approve/reject`
`updateMany({status:"PENDING"})` ile gerçek DB-seviyeli race guard; `list()`'teki sınırsız sorgu
görünümü bilinçli kabul edilmiş trade-off (pilot ölçeği 30-45 mekan, dokümante edilmiş).

### 1.6 — Backend eksik/zayıf yönler (Bölüm 1 özeti/sentez)

**Kritik:**
- `User` tablosu hiç doldurulmuyor (§1.3) — favoriler prod'da gerçek kullanıcılar için 500 verir.

**Orta öncelik — 6 ihtiyaç (§1):**
- Observability/logging yok, `@fastify/compress` yok, `@fastify/helmet` yok, DB connection
  pooling kararı yok (Plan 4e/infra ile birlikte).

**Düşük öncelik:**
- Favorites yazma uçlarında rate-limit yok (§1.1), admin yazma uçlarında rate-limit yok (§1.2),
  `rate-limit.guard.ts`'de ölü ama riskli XFF fallback'i (§1.5).

**Ertelenmiş/kabul edilmiş trade-off'lar (sorun değil, ama izlenmeli):**
- Hot-path cache yok (§1), `openNow` regex parsing (§1), re-verify cron batch değil (§1.4),
  kürasyon `list()` sınırsız sorgu (§1.5, dokümante edilmiş bilinçli karar).

**Bilinen özellik eksikleri (kod değil, kapsam):**
- Gurme Puanı hesaplaması hiç yok, pgvector/semantic search hiç kurulmamış, backend e2e testleri
  bu ortamda hiç doğrulanamadı (DB yok).

**Go-live checklist notu:** `SUPABASE_JWT_ISSUER`/`AUDIENCE` set edilmeli (Plan 4e).

**Vizyon ışığında geri dönüş notu (2026-09-09, vizyon netleştikten sonra eklendi):**
- Gurme Puanı eksikliği artık sadece "Faz 2 kapsam dışı" değil — vizyon kararı "geniş kullanıcı
  katkısı"nı markanın uzun vadeli kimliğinin parçası ilan etti. Önceliği yeniden değerlendirilmeli.
- `User` tablosu boşluğu (KRİTİK, §1.3) daha da acil: favoriler VE gelecekteki her türlü kullanıcı
  katkısı (review, oy, rozet) bu temel altyapıya bağımlı. Review'ın geri kalanını beklemeden ele
  alınıp alınmayacağı kullanıcının önceliklendirme kararına bağlı.
- "Sadece İstanbul, derinlik odaklı" kararı, Bölüm 1'deki tüm ertelenmiş optimizasyon kararlarını
  (hot-path cache, batch cron, vs.) geriye dönük doğruluyor — değişiklik gerekmiyor.
- Yeni büyüme fırsatı (teknik bulgu değil, işaretlendi, 2/4'te tekrar gündeme gelecek): mevcut
  filtreler (kategori/fiyat/butik/şimdi açık/mesafe) "mod/durum" bazlı bir boyuttan yoksun (örn.
  "hızlı atıştırmalık", "romantik akşam yemeği") — "bir semte gidince ne yesem" personasına hizmet
  edecek bir potansiyel geliştirme.

**BÖLÜM 1 (Backend) KAPANDI.**

---

## Bölüm 2 — Web/PWA (`apps/web`)

### 2.1 — Route haritası
5 route: `/` (redirect-only), `/[district]` (SSR keşif), `/mekan/[slug]` (ISR, saatlik),
`/favoriler` (auth), `/giris`.

**🔴 KRİTİK bulgu — UYGULANMADI:** `/[district]` (ana keşif sayfası) ve `getDefaultDistrictSlug()`
(`/`), `packages/api-client/src/index.ts`'in çıplak `fetch()` çağrısını kullanıyor (`cache`/
`next.revalidate` seçeneği YOK). Route'ta da `export const dynamic`/`revalidate` yok. Next.js
14 App Router'da bu, `fetch()` sonucunun **varsayılan olarak `force-cache` (süresiz)** cache'lenmesi
demek — `getDistricts()`/`getVenues()` ilk istekte cache'lenir ve **hiçbir zaman kendiliğinden
yenilenmez** (manuel `revalidatePath`/`revalidateTag` çağrısı da kod tabanının hiçbir yerinde yok,
doğrulandı). Sonuç: bir curator yeni mekan onaylasa/mevcut birini arşivlese bile **anasayfa/keşif
listesi bunu göstermez** — tek çözüm yolu redeploy. `/mekan/[slug]` bunun aksine bilinçli
`revalidate=3600` ile ISR yapıyor; `/[district]` için hiç böyle bir mekanizma yok.
→ **Aksiyon gerekiyor:** ya `/[district]`'e de kısa bir `revalidate` (örn. 60-300sn) eklenmeli,
ya da admin onay/red akışına `revalidatePath`/`revalidateTag` çağrısı eklenmeli (ikincisi daha
doğru — "hemen görünsün" beklentisine uyar, kürasyon onaylandığı anda sitede görünmesi ürün
beklentisiyle örtüşür).

**Vizyon notu (büyüme/marka fırsatı, sorun değil):** "Bir semte gidince ne yesem" personası için
`/[district]` doğru giriş noktası ama URL yapısı sadece ilçe bazlı — "yakınımdaki" kavramı ayrı bir
route değil, sadece otomatik en-yakın-ilçeye-yönlendirme. MVP'de (3 ilçe) örtüşüyor, İstanbul
geneline büyürken tekrar gündeme gelebilir.

### 2.2 — Özellikler
Filtreler (kategori/fiyat/butik/şimdi açık/mesafe), konum-öncelikli otomatik sıralama, liste↔harita
toggle, keyset pagination, çoklu favori listesi, "bilgi yanlış mı" formu, WhatsApp/native paylaşım,
giriş/kayıt.

**🟠 Önemli eksik özellik — UYGULANMADI:** Kod tabanının hiçbir yerinde (backend
`VenueListQuerySchema` dahil, frontend `venue-filters`/`district-picker`/`category-quick-route`/
`discovery-client` dahil) **serbest metin arama (isim/anahtar kelimeyle arama) yok** — sadece
yapısal filtreler var. Kullanıcı mekan adını veya "künefe" gibi bir anahtar kelimeyi arayamıyor.
Yelp/TripAdvisor/Google Maps gibi tüm referans ürünlerde standart olan bu özellik tamamen eksik.
2.1'deki "mod bazlı arama" büyüme fırsatıyla birleşince: **arama/keşif deneyimi yapısal filtrelerin
ötesine hiç geçmemiş.**

**Güvenlik/optimizasyon taraması — sorun bulunmadı, doğrulandı:**
- `dangerouslySetInnerHTML` kod tabanının hiçbir yerinde yok — XSS riski yok (React auto-escape).
- `WhatsappShareButton`/`NativeShareButton`: `encodeURIComponent` doğru kullanılmış.
- `discovery-client.tsx` tam okundu: race-guard'lar (`latestRequest`, `lastFetchCoordsRef`,
  `autoSortedRef`/`userInteractedRef`) titizlikle senkronize, yeni bir sorun yok.

**Küçük UX notu, güvenlik değil:** `ReportForm`'da client-side sadece `minLength={5}` var,
`maxLength` yok (server 500 karakterde kesiyor) — uzun metin gönderilirse jenerik hata gösteriliyor,
neden söylenmiyor.

**Ertelenen (kullanıcı isteğiyle):** TR/EN dil desteği — vizyonun hedef kitlesi turistleri de
kapsıyor ama UI %100 Türkçe; ileride ayrıca konuşulacak, şimdilik aksiyon yok.

### 2.3 — Görünüş/tasarım dili

**Sayısal doğrulama:** `tailwind.config.ts`'te `theme: { extend: {} }` — hiçbir özelleştirme yok,
`globals.css` sadece 3 satır Tailwind direktifi. Marka renkleri (`#d75d3b`, `#201d18`, `#f4f0e7`,
`#faf7f0`, `#9e422b`) grep'lendi: **17 dosyada, 180 ayrı yerde** hardcode hex değer olarak
tekrarlanıyor — tasarım tokenı yok iddiası artık sayısal olarak doğrulanmış durumda.

**🟠 Bulgu — vizyonla doğrudan çelişiyor:** `layout.tsx`'in `metadata` objesinde `openGraph`/
`twitter` alanları yok, hiçbir sayfada `og:image` yok, per-page `generateMetadata` de yok (2.5'te
tekrar gelecek). Sonuç: kullanıcı kendi `WhatsappShareButton`/`NativeShareButton`'ıyla bir mekan
linkini paylaştığında, önizleme mekanın fotoğrafını/adını değil **jenerik, resimsiz site
başlığını** gösteriyor — ürünün kendi paylaşım özelliğiyle çelişen bir boşluk, "akılda kalıcılık"
hedefine doğrudan zarar veriyor.

**🟠 Bulgu — serif başlıklar özel font yüklemiyor:** `font-serif` hiçbir `next/font`/`@font-face`
ile desteklenmiyor, Tailwind'in sistem varsayılan serif stack'i (Georgia/Times/ui-serif)
kullanılıyor — cihaza göre görünüm değişir, gerçekten özgün/akılda kalıcı bir tipografi değil.
Vizyonun "marka kimliği güçlendirilsin" kararının önündeki en somut teknik engel.

**🟡 Açık soru, kullanıcı kararı bekliyor:** `venue-card.tsx` (liste kartı) **hiç fotoğraf
göstermiyor** — tamamen tipografik (kategori/isim/not/puan). "Editöryel dergi" kimliğiyle tutarlı
bir zarafet tercihi olabilir, ama vizyonun "genç/sosyal medya kitlesi" hedef kitlesi görsel-öncelikli
keşfe alışkın. Bilinçli bir farklılaşma mı, yoksa gözden kaçmış bir eksik mi — netleştirilmeli.

**Kod kalitesi notu:** `app/layout.tsx:63`'te `h1`/`p` stilleri sayfaların kendi JSX'inde değil,
layout'taki bir div'den arbitrary CSS selector'ı (`[&>main>h1]:font-serif...`) ile global enjekte
ediliyor — kırılgan, keşfi zor bir desen.

**Küçük optimizasyon notu:** `venue-detail.tsx`'teki `<img>` etiketlerinde `loading="lazy"` yok —
zaten bilinen "next/image kullanılmıyor" bulgusunun bir parçası, ayrı aksiyon gerektirmiyor.

**Doğrulanan, sorun yok:** `VenueList`'in boş-durum ekranı (`data-testid="empty-state"`) özenle
tasarlanmış, editöryel ton hata durumunda da korunuyor. Kontrast/erişilebilirlik yeterli. Dark mode
yokluğu bilinçli kapsam kararı, vizyonla çelişmiyor.

### 2.4 — State ve race-guard'lar
`favoriler/page.tsx` (279 satır) baştan sona okundu — kod tabanının en karmaşık state yönetimi.

**Doğrulanan, sorun yok — çok titiz:** Identity değişimi render sırasında (useEffect değil)
yakalanıp tüm session-scoped state temizleniyor; `latestListsRequest`/`latestCreateRequest` bilinçli
olarak ayrı sayaçlar (3 Codex review turunun bulgusu, kod içinde belgeli); `venue-map-leaflet.tsx`'in
`BoundsVenueLoader`'ı da aynı desenle tutarlı.

**Bilinen, kabul edilmiş küçük UX tuhaflığı (sorun değil, kod içinde zaten dokümante):** Çok nadir
bir senaryoda (create-list tam token-refresh anında biterse) yeni liste ekranda hemen görünmeyebilir,
sayfadan çıkıp geri dönünce görünür — veri kaybı yok, sadece görüntüleme gecikmesi.

**Yeni bulgu yok.**

### 2.5 — PWA/SEO

**🟠 Bulgu — PWA kurulum deneyiminde tutarsızlık:** `public/manifest.json`'da `theme_color`/
`background_color` = `#1a1611` (koyu kahve), ama `app/layout.tsx`'teki `viewport.themeColor` =
`#f4f0e7` (krem) — farklı. Ana ekrana eklendiğinde açılış (splash) ekranı koyu kahve görünür ama
uygulamanın gerçek arayüzü krem/açık — ilk izlenimde tutarsızlık, "akılda kalıcı marka" hedefine ters.
→ **Aksiyon:** ikisi aynı değere çekilmeli (muhtemelen `#f4f0e7`, uygulamanın gerçek zeminine uysun).

**🔴 SEO altyapısı tamamen sıfır (doğrulandı — "zayıf" değil, hiç yok):**
- `robots.txt` yok, `sitemap.xml` yok.
- `generateMetadata` hiçbir sayfada yok — her mekan detay sayfası aynı jenerik title/description'ı
  taşıyor, arama sonucunda birbirinden ayrışmıyor.
- JSON-LD structured data (`application/ld+json`, örn. schema.org `Restaurant`/`LocalBusiness`)
  hiç yok — Google'a fiyat aralığı/puan gibi bilgi veren hiçbir mekanizma yok, rich snippet imkanı sıfır.
→ Vizyon notu: referans alınan ürünlerin (Michelin, TripAdvisor, Yelp) organik trafiğinin büyük
kısmı bu tür rich snippet'lerden geliyor — GurmeGo şu an bu kanala tamamen kapalı, büyük ölçekli
bir ürün için kullanıcı edinim maliyetini doğrudan etkiler.

**Doğrulanan, sorun yok:** `sw.js` tasarımı bilinçli ve doğru — offline-first değil, sadece
app-shell (statik varlıklar) cache-first, dinamik veri hiç cache'lenmiyor (2.1'deki Next.js
data-cache sorunuyla karıştırılmasın, bu ayrı ve doğru çalışan bir katman).

**Küçük not, düşük öncelik:** `manifest.json`'daki ikonlarda `"purpose":"maskable"` varyantı yok —
Android'de adaptive icon maskesi ikonu awkward kırpabilir.

### 2.6 — Web eksik/zayıf yönler (Bölüm 2 özeti/sentez)

**Kritik:**
- `/[district]` ana keşif sayfası fetch'leri süresiz cache'leniyor, manuel revalidate yok (§2.1).

**Önemli/orta öncelik:**
- Serbest metin arama hiç yok (§2.2).
- Open Graph/Twitter meta hiç yok — paylaşım özelliğiyle çelişiyor (§2.3).
- SEO altyapısı tamamen sıfır: robots.txt, sitemap.xml, JSON-LD, generateMetadata (§2.5).
- Tasarım tokenı yok — 180 yerde hardcode hex renk (§2.3).
- Serif başlıklar özel font yüklemiyor (§2.3).
- Manifest/viewport `theme_color` tutarsızlığı (§2.5).
- **Cross-cutting (yeni): hiçbir yerde özel `error.tsx`/`not-found.tsx`/`global-error.tsx` yok** —
  bir hata/404 anında kullanıcı Next.js'in jenerik, unbranded ekranını görür; tam da en kritik anda
  editöryel kimlik tamamen kayboluyor.
- **Cross-cutting (yeni): `next.config.js`'de hiç güvenlik header'ı (CSP, X-Frame-Options vs.) yok**
  — backend'deki `@fastify/helmet` eksikliğiyle aynı sınıftan, web tarafının karşılığı, birlikte
  düşünülmeli.

**Açık soru (kullanıcı kararı bekliyor):**
- `venue-card` hiç fotoğraf göstermiyor — bilinçli mi, gözden kaçmış mı? (§2.3)

**Düşük öncelik:** ReportForm'da client-side maxLength yok (§2.2), layout.tsx'te kırılgan
arbitrary-selector stil deseni (§2.3), img'lerde lazy loading yok (§2.3), maskable icon yok (§2.5).

**Ertelenen (kullanıcı isteğiyle):** TR/EN dil desteği (§2.2).

**Doğrulanan, sağlam:** race-guard mimarisi (§2.4), service worker tasarımı (§2.5), empty-state
tasarımı (§2.3), XSS/injection riski yok (§2.2), `.env.local` doğru gitignore'lu, secret sızıntısı yok.

**BÖLÜM 2 (Web/PWA) KAPANDI.**

---

## Bölüm 3 — Admin Panel (`apps/admin`)

### 3.1 — Route ve özellikler
5 route: `/giris`, `/erisim-yok`, `(protected)` layout guard, `(protected)/kuyruk` (sadece REPORT
tipi, PENDING, öncelik/acil rozetli onay-red), `(protected)/import` (CSV toplu yükleme). Sadece 2
fonksiyonel sayfa.

**Doğrulanan, çok sağlam:** `auth-context.tsx`'teki rol decode'u JWT imzasını doğrulamıyor ama kod
içi yorum bunun bilinçli olduğunu belirtiyor (display-only gating, backend `RolesGuard` gerçek
sınır). `import/page.tsx` (316 satır) ve `kuyruk/page.tsx`'in mutation akışı tam okundu — race-guard
mimarisi web'in `favoriler/page.tsx`'iyle birebir aynı kalitede, 10 ayrı Codex review turu
belgelenmiş (identity-gated reset, dedicated request counter, `key={identity}` ile native file
input'u zorla remount etme dahil).

**Cross-cutting bulgular (Web §2.6 ile aynı sınıftan, admin'de de var):**
- `error.tsx`/`not-found.tsx` admin'de de yok — internal araç olduğu için düşük risk, ama
  tutarlılık için not edildi.
- `next.config.js`'de admin'de de hiç güvenlik header'ı yok — backend/web'deki aynı eksikliğin
  üçüncü tekrarı (üçü birlikte tek bir "helmet-eşdeğeri ekle" aksiyonu olarak düşünülebilir).

**Küçük UX notları, güvenlik değil:**
- CSV yüklemeden önce client-side dosya boyutu kontrolü yok — backend'in 10MB limitine takılana
  kadar kullanıcı bekler, sonra jenerik "yükleme başarısız" mesajı alır.
- Yükleme sırasında gerçek ilerleme yüzdesi yok, sadece spinner.
- Kuyruk listesinde sayfalama yok — backend §1.5'teki bilinçli kararla tutarlı, pilot ölçeğinde
  sorun değil.

**Beklenen, sorun değil:** Admin'de PWA/manifest yok — internal araç için gerekmiyor.

### 3.2 — Görünüş
Tailwind, component library yok. `slate`/`blue-700`/`rose`/`emerald` — 89 yerde tekrarlanan ama
Tailwind'in isimlendirilmiş palet renkleri (web'in 180 rastgele hex'inden daha az ciddi, iç araç
için tasarım tokenı eksikliği daha düşük öncelik). Responsive breakpoint kullanımı tutarlı.

**🟡 Bulgu — düzeltilerek kaydedildi:** İlk taramada `queue-item.tsx`'teki approve/reject
butonlarında `focus-visible` olmadığı iddia edildi — **bu YANLIŞTI, düzeltildi:** her iki buton da
`focus-visible:outline` içeriyor, en kritik aksiyon butonları güvenli.

**Gerçek bulgular (doğrulanmış):**
- `(protected)/layout.tsx`'teki "Çıkış yap" butonu (her korumalı sayfada görünen paylaşılan
  header) stilli ama `focus-visible` yok — küçük ama her sayfada tekrarlanan eksik.
- **`erisim-yok/page.tsx` tamamen stilsiz** — hiç Tailwind class'ı yok, düz tarayıcı varsayılan
  görünümü. Uygulamanın geri kalanı özenle tasarlanmışken, yetkisiz bir kullanıcının düştüğü bu
  sayfa "unutulmuş/bitmemiş" görünüyor.

**Bağlantılı örüntü (üç bölümde de tekrarlandı — önemli genel gözlem):** Web §2.6'da
`error.tsx`/`not-found.tsx` yoktu, admin §3.1'de de yoktu, şimdi admin'in `erisim-yok` sayfası da
unutulmuş. Yani üç kez karşımıza çıkan bir tema: **"mutlu yol" özenle tasarlanıyor, hata/kenar
durumu ekranları sistematik olarak atlanıyor.** Mobile'da bu ayrım geçerli değil — mobile zaten
her yerde tutarlı şekilde stilsiz.

### 3.3 — Admin eksik/zayıf yönler (Bölüm 3 özeti/sentez)

**🔴 Güvenlik açığı — UYGULANMADI, backend+admin bağlantılı:** `apps/api/src/admin/reports/
admin-reports.service.ts:40-44`'teki `exportVenues()`, `Venue` alanlarını (`name`, `editorialNote`,
`transportNote`, `address`) hiçbir sanitizasyon yapmadan `csv-stringify` ile CSV'ye yazıyor —
**CSV/Formula Injection** (OWASP tanımlı sınıf). Bir katkıcı mekan adına `=HYPERLINK(...)` veya
`=cmd|...` gibi bir "formül" girip curator gözden kaçırıp onaylarsa, admin/curator export edilen
CSV'yi Excel/Sheets'te açtığında bu formül **otomatik çalışır**. → **Aksiyon:** export sırasında
`=`/`+`/`-`/`@` ile başlayan hücrelerin önüne tek tırnak (`'`) eklenmeli (standart mitigasyon,
`csv-stringify` bunu otomatik yapmıyor).

**🟠 Bulgu — vizyonla ilgili, UYGULANMADI:** Hiçbir yerde audit/activity log yok. Rol atama
(`admin/users/:id/roles`) kimin ne zaman hangi eski rolden yaptığını kaydetmiyor; CSV import'un
kalıcı bir kaydı yok (sadece UI'da geçici sonuç). (`VenueVersion` mekan düzenlemeleri için zaten
denetim izi sağlıyor — sorun sadece rol/import gibi diğer hassas işlemlerde.) §1'deki "observability
logging yok" bulgusundan farklı: bu operasyonel debug logu değil, kalıcı/sorgulanabilir hesap
verebilirlik kaydı. Büyük ölçekli bir şirket ürünü için özellikle rol/yetki değişikliklerinde
standart bir beklenti.

**Orta öncelik:**
- `erisim-yok/page.tsx` tamamen stilsiz (§3.2).
- `error.tsx`/`not-found.tsx` yok — cross-cutting, 3. tekrar (§3.1).
- `next.config.js`'de güvenlik header'ı yok — 3. tekrar (§3.1).

**Düşük öncelik:**
- "Çıkış yap" butonunda focus-visible yok, her sayfada (§3.2).
- CSV yüklemede client-side boyut kontrolü/ilerleme yüzdesi yok (§3.1).
- Kuyruk listesinde sayfalama yok (bilinçli, backend §1.5 kararıyla tutarlı) (§3.1).
- Manuel mekan düzenleme UI'ı yok — curator Prisma Studio'ya muhtaç (ilk envanterden).

**Doğrulanan, sağlam:** race-guard mimarisi web kadar titiz (§3.1), auth decode tasarımı doğru
(§3.1), responsive tasarım tutarlı (§3.2).

**Vizyon notu:** Admin, kapsamı dar (2 sayfa) ve iç araç olduğu için marka/görsel kimlik yükü
taşımıyor — doğru bir kapsam kararı, değişmesi gerekmiyor. Ölçek büyürse ilk ihtiyaç muhtemelen
sayfalama + manuel mekan düzenleme UI'ı + audit log olur.

**BÖLÜM 3 (Admin Panel) KAPANDI.**

---

## Bölüm 4 — Mobile App (`apps/mobile`)

### 4.1 — Navigasyon ve ekranlar
Stack: `Tabs` (Discovery+Favoriler) + `VenueDetail` + `Auth`. 4 ekran toplam.

**🔴 Kritik bulgu — UYGULANMADI:** `auth-context.tsx`'te `signOut` tanımlı ve test edilmiş, ama
**hiçbir ekran onu çağırmıyor**. Profil/Hesap/Ayarlar ekranı hiç yok — giriş yapmış bir kullanıcının
mobile'da çıkış yapmasının **hiçbir yolu yok**. Web'de (header linki) ve admin'de ("Çıkış yap"
butonu) bu var, mobile'da tamamen eksik. Kozmetik değil, temel hesap yönetimi özelliği eksik.

**🟠 Bulgu — AuthScreen'de double-submit guard yok:** `handleSubmit`'te hiçbir in-flight
kontrolü/loading state yok — hızlı çift dokunuş iki eşzamanlı `signIn`/`signUp` isteği tetikler.
Kod tabanının geri kalanındaki (web/admin) titiz race-guard disiplini burada hiç yok.

**🟡 Bulgu — başarılı girişten sonra otomatik geri dönüş yok:** `handleSubmit` başarılı olunca
`navigation.goBack()` çağrılmıyor. Senaryo: kullanıcı favorilemek isterken Auth'a yönlendirilir,
giriş yapar, ekranda kalır — favorileme niyeti kesintiye uğrar, manuel geri gitmesi gerekir.

**Ek bulgu:** `TabNavigator.tsx`'te `tabBarIcon` tanımlı değil — tab bar sadece metin gösteriyor,
ikon yok (bilinen "mobile'da tasarım sistemi yok" bulgusunun somut bir örneği).

**Genel gözlem:** Yukarıdaki 3 bulgu (sign-out yok, double-submit guard yok, auto-navigate yok)
birlikte gösteriyor ki **auth, mobile'ın en az cilalanmış/test edilmiş akışı** — backend/web/
admin'deki aynı titizlik burada yok.

### 4.2 — Görünüş/UI

**Doğrulandı, kod seviyesinde:** `DiscoveryScreen.tsx`'te `<View>`/`<Text>`/`<Pressable>` hiçbir
style prop'u olmadan kullanılıyor. Tüm `screens/`+`components/` genelinde grep'lendi: `StyleSheet`
kullanımı **sıfır**, `ActivityIndicator` kullanımı **sıfır**, `style=` prop'u toplam sadece **3
yerde** (hepsi `VenueDetailScreen.tsx`, muhtemelen harita/görsel boyutlandırma). "Sıfır tasarım
sistemi" ve "loading göstergesi yok" bulguları artık tek ekrana özgü değil, **tüm uygulama
genelinde doğrulanmış** durumda.

**🟠 Yeni, önemli bulgu — mobile'da pagination hiç yok:** `apps/mobile/src/lib/api.ts`'teki
`getVenues()` ne `cursor` gönderiyor ne `has_more`/`next_cursor` işliyor. Backend varsayılan sayfa
boyutu 20 mekan — mobile kullanıcısı ilk 20 mekandan fazlasını hiçbir şekilde göremiyor, "daha
fazla göster" mekanizması yok. Web'de keyset pagination özenle uygulanmışken (§2.2), mobile'da hiç
yapılmamış. CLAUDE.md'nin kendi tanımına göre mobile "ana deneyim" — ana deneyimde kullanıcının
katalogdaki mekanların çoğunu hiç görememesi ciddi bir işlevsel eksiklik.

**Ek bulgu:** Hata durumunda (`catch`) sessizce boş liste gösteriliyor — "filtrelerine uyan mekan
yok" ile "ağ hatası oldu" ayrımı kullanıcıya hiç yansımıyor.

### 4.3 — Native özellikler ve config

**Doğrulanan, sağlam:** `use-location.ts` web'in `useGeolocation`'ıyla aynı sözleşme; `supabase.ts`
`expo-secure-store`'u (OS keychain/keystore) doğru kullanıyor; `env.ts`'teki literal
`process.env.EXPO_PUBLIC_X` erişimi doğru (önceki dinamik-erişim bug'ının düzeltilmiş hali,
teyit edildi); `directions.ts` web'le birebir aynı ve bilinçli bir tasarım (kod yorumunda
"deliberate choice" diye belirtilmiş); `Share.share`/`Linking.openURL`'de `encodeURIComponent`
doğru; `app.json`'daki izinler (`ACCESS_COARSE/FINE_LOCATION`, `NSLocationWhenInUseUsageDescription`)
gerçek kod kullanımıyla birebir eşleşiyor — fazla/eksik izin yok.

**Küçük dikkat notu (doğrulanmış bug değil, izlenmesi gereken risk):** `expo-secure-store`, bazı
Android sürümlerinde Keystore-backed depolamada ~2048 byte boyut sınırı taşıyabiliyor (bilinen bir
Expo/Supabase tuzağı). Supabase session objesi normalde altında kalır ama JWT büyürse (ileride
custom claim eklenirse) sessiz yazma hatası riski var — şu an aktif değil, izlenmeli.

**🟡 Küçük bulgu:** `ReportForm.tsx`'te (mobile) web'in aksine hiç client-side validasyon yok —
`reason` alanında `minLength` kontrolü yok, sadece `submitting` durumunda disabled. Kullanıcı boş
metinle gönderip backend'in `min(5)` kuralına takılabilir, jenerik hata alır — neden söylenmiyor.

### 4.4 — Build/dağıtım durumu

**Doğrulandı, kod/config seviyesinde — bilinenle birebir örtüşüyor:** `eas.json` yok,
`app.json`'da `ios.bundleIdentifier`/`android.package` tanımlı değil, gerçek `.env.local` yok
(sadece `.example`), `slug`/`name` hâlâ jenerik `"mobile"`, versiyon sabit `1.0.0` — build/version
artırma stratejisi yok. Bunların hepsi **Plan 4e**'nin kapsamı, henüz başlanmamış (kullanıcı
kararıyla ertelenmiş durumda).

**Ek doğrulama:** `.env.local` git'e commit edilmemiş, `.gitignore`'da kapsanıyor; `env.ts`'te
fallback/varsayılan secret yok; gerekli tüm ikon asset'leri (Android adaptive icon 3 varyant, iOS
icon/splash) mevcut — secret sızıntısı veya eksik asset yok.

**İleriye dönük not (Plan 4e'ye not düşülecek, şimdi aksiyon gerektirmiyor):** `.gitignore`'da
henüz `.expo/`, keystore (`.jks`/`.p12`), `.mobileprovision` gibi imzalama dosyaları için özel
kural yok — bu dosyalar Plan 4e'de üretilmeye başlayınca **asla commit edilmemeleri için**
`.gitignore`'a eklenmesi gerekecek.

### 4.5 — Mobile eksik/zayıf yönler (Bölüm 4 özeti/sentez)

**🔴🔴 EN YÜKSEK RİSKLİ BULGU (dört bölümde de tekrar eden "kenar durumu ihmali" temasının en
ağır sonuçlusu) — UYGULANMADI:** `App.tsx`'te hiçbir React Error Boundary yok
(`ErrorBoundary`/`componentDidCatch`/`getDerivedStateFromError` — tüm kod tabanında sıfır sonuç),
crash reporting (Sentry/Bugsnag) da hiç kurulu değil. Sonuç: bir bileşen render sırasında
beklenmedik bir hata fırlatırsa (bug, null referans, API'nin beklenmedik şekil döndürmesi), **error
boundary olmadığı için TÜM UYGULAMA ÇÖKER** — kullanıcı kırmızı hata ekranı (dev) veya uygulamanın
kapanmasıyla (prod) karşılaşır, geri dönecek yol yok. Ayrıca prod'da bir çökme olsa **kimse
haberdar olmaz** (crash reporting yok). Bu, Web §2.6 (`error.tsx` yok) ve Admin §3.2
(`erisim-yok` stilsiz) ile aynı kök temanın (mutlu yol tasarlanıyor, hata yolu ihmal ediliyor)
mobile'daki en yüksek sonuçlu versiyonu — web/admin'de kötü bir sayfa görünür, mobile'da uygulama
tamamen kapanır. → **Aksiyon:** en azından root'ta bir Error Boundary + bir crash reporting SDK'sı
(store'a çıkmadan önce, Plan 4e ile birlikte) şart.

**Kritik:**
- Hiçbir yerde sign-out yolu yok (§4.1).

**Önemli/orta öncelik:**
- Pagination hiç yok — ilk 20 mekandan fazlası görünmüyor, "ana deneyim" için ciddi eksiklik (§4.2).
- AuthScreen'de double-submit guard ve auto-navigate-back yok (§4.1).
- Sıfır tasarım sistemi, app-genelinde doğrulandı (§4.2).
- DiscoveryScreen'de harita yok (ilk envanterden, bilinçli kapsam kararı).

**Düşük öncelik:**
- `tabBarIcon` yok (§4.1), hata/boş-sonuç ayrımı yok (§4.2), `ReportForm`'da client validasyon yok
  (§4.3), `expo-secure-store` Android boyut sınırı riski — izlenmeli, aktif değil (§4.3).

**Build/dağıtım:** Tamamen Plan 4e'yi bekliyor (§4.4).

**Doğrulanan, sağlam:** native config/izinler doğru, env/secret yönetimi güvenli, FavoriteButton/
FavoritesScreen race-guard mimarisi web kadar titiz (ilk envanterden).

**Genel gözlem:** Mobile, backend/web/admin'e kıyasla belirgin şekilde daha az olgun — hem görsel
tasarım hem temel akışlar (auth, pagination, crash koruması) açısından. CLAUDE.md'nin "ana deneyim"
tanımıyla şu anki olgunluk seviyesi arasında belirgin bir fark var.

**BÖLÜM 4 (Mobile App) KAPANDI.**

---

## Bölüm 5 — Ortak Gözlemler (tüm katmanlar)

Review'ın son bölümü — 1-4 arası tüm bulgular sentezlendi. Buradan sonra "mevcut haliyle
geliştirme" aşamasına (kod yazma) geçilebilir.

### 5.1 — Tüm projedeki KRİTİK bulgular (öncelik sırasıyla değil, tespit sırasıyla)

1. **✅ ÇÖZÜLDÜ (Adım 2, 2026-09-14, `fd4a44c`) — §1.3 — `User` tablosu hiç doldurulmuyor.**
   Supabase Auth ile senkron yok. Favoriler VE gelecekteki her türlü kullanıcı katkısı bu temel
   altyapıya bağımlı. Prod'da favoriler 500 verir. Fix: "Aksiyon Günlüğü — Adım 2" bölümü.
2. **✅ ÇÖZÜLDÜ (tarih/commit teyit edilemedi, 2026-09-25'te fark edilmeden çözülmüş bulundu) —
   §2.1 — Web ana sayfası (`/[district]`) fetch'leri süresiz cache'leniyordu.** `apps/web/src/lib/api.ts`
   içinde `DISTRICTS_REVALIDATE_S=300` / `VENUE_LIST_REVALIDATE_S=60` sabitleri eklenmiş,
   `getDistricts()`/`getVenues()` artık `next.revalidate` ile TTL'li cache kullanıyor (doğrulandı,
   kod okunarak).
3. **✅ ÇÖZÜLDÜ (Adım 3, 2026-09-14, `f1ac2fc`) — §3.3 — CSV export'ta Formula/CSV Injection
   açığı.** `admin-reports.service.ts`'in `exportVenues()`'ı sanitizasyonsuzdu — kötü niyetli bir
   mekan adı Excel'de formül olarak çalışabilirdi. Fix: "Aksiyon Günlüğü — Adım 3" bölümü.
4. **✅ ÇÖZÜLDÜ (`ccca17f`, 2026-09-24) — §4.1 — Mobile'da hiç sign-out yolu yoktu.** Fonksiyon
   vardı, hiçbir ekran çağırmıyordu — reachable sign-out UI eklendi, cross-model-review'dan geçti.
5. **✅ ÇÖZÜLDÜ (`b85220b`, PR #32, 2026-09-23) — §4.5 — Mobile'da Error Boundary yoktu.**
   `apps/mobile/src/components/ErrorBoundary.tsx` root-level olarak `App.tsx`'e eklendi, testli.
   Crash reporting SDK'sı (Sentry) bilinçli olarak Faz 2'ye ertelendi (kod içi yorumla belgelendi) —
   şu an console.error'a düşüyor, sessizce yutulmuyor. Bu erteleme "sorun" değil, kayıtlı bir karar.
6. **✅ ÇÖZÜLDÜ (Adım 1, 2026-09-14) — §5.5 — CI hiç çalışmamıştı + tetiklense bile kırmızı
   çıkardı.** Branch uyuşmazlığı + seed fixture eksikleri "Aksiyon Günlüğü — Adım 1" bölümünde
   düzeltildi, CI o tarihten beri gerçek koşumlardan geçiyor.

**Sonuç: 6/6 KRİTİK bulgu çözüldü.** Kalan iş "Önemli/orta öncelik" ve "Düşük öncelik" seviyesinde
(bkz. §3.2 admin erişim-yok stilsizliği, CSP eksikliği, mobile pagination, tasarım tokenı sistemi
yokluğu — §5.2/§5.4).

### 5.2 — Tekrar eden temalar (tek seferlik değil, sistemik)

- **"Mutlu yol tasarlanıyor, kenar durumu ihmal ediliyor"** — 4 kez bağımsız olarak tespit edildi:
  Web'de `error.tsx`/`not-found.tsx` yok (§2.6), Admin'de `erisim-yok` tamamen stilsiz (§3.2),
  Admin'de de `error.tsx` yok (§3.1), Mobile'da Error Boundary yok (§4.5, en ağır sonuçlu versiyon).
  Bu, tek bir sayfanın eksikliği değil — **kod yazma disiplininin sistematik bir kör noktası.**
  Öneri: bundan sonraki her yeni sayfa/ekran için "happy path + en az bir hata durumu" birlikte
  tasarlanmalı, ayrı bir adım olarak değil.
- **Güvenlik header'ı (helmet-eşdeğeri) 3 kez eksik** — Backend (`@fastify/helmet`, §1),
  Web (`next.config.js` headers, §2.6), Admin (`next.config.js` headers, §3.1). Üçü birlikte tek
  bir aksiyon olarak ele alınabilir.
- **Kalıcı kayıt/hesap verebilirlik eksikliği 2 kez** — Backend'de observability logging yok (§1,
  operasyonel/debug amaçlı), Admin'de audit log yok (§3.3, kalıcı/sorgulanabilir hesap
  verebilirlik amaçlı) — farklı amaçlar ama aynı kök sorun: hiçbir katmanda "ne olduğunu sonradan
  öğrenebilme" mekanizması yok.
- **Race-guard mimarisi — bu bir SORUN DEĞİL, gerçek bir GÜÇLÜ YÖN:** Web (`favoriler`,
  `discovery-client`, `venue-map-leaflet`), Admin (`kuyruk`, `import`) ve Mobile'ın favori
  bileşenlerinde aynı titiz "monotonic request counter + identity-gated reset" deseni tutarlı
  uygulanmış, çoğu Codex cross-model review turlarından geçmiş. Mobile'ın auth akışı (§4.1) bu
  disipline uymuyor — istisna, kural değil.
- **Tasarım tokenı/tema sistemi hiçbir yerde yok** ama şiddeti katmana göre değişiyor: Web en ciddi
  (180 rastgele hex, marka kimliği için kritik, §2.3), Admin daha az ciddi (89 ama Tailwind'in
  isimlendirilmiş paleti, iç araç için düşük öncelik, §3.2), Mobile en radikal (StyleSheet
  kullanımı sıfır, hiç tasarım yok, §4.2).
- **Rate-limit tutarsızlığı** — Backend'de favorites yazma uçları (§1.1) ve admin yazma uçları
  (§1.2) korumasız, düşük öncelik ama aynı sınıftan iki ayrı bulgu.

### 5.3 — Vizyon uyumu (2026-09-09'da netleşen karara göre)

- **Gurme Puanı** — vizyon bunu markanın uzun vadeli kimliği ilan etti, ama kod tabanında hiç yok
  (§1.4, §1.6). En büyük vizyon-gerçeklik makası burada.
- **SEO + Open Graph** — büyük ölçekli ürün hedefiyle doğrudan çelişiyor: robots/sitemap/JSON-LD
  hiç yok (§2.5), paylaşım özelliğinin kendisi OG meta'sı olmadığı için görsel karşılığı üretmiyor
  (§2.3). Organik kullanıcı edinimi kanalı şu an kapalı.
- **Serbest metin arama yok** (§2.2) — "semte gidince ne yesem" personasının doğal beklentisi bu,
  şu an sadece yapısal filtrelerle karşılanıyor.
- **Marka kimliği** (sıcak/editöryel) web'de güçlü ama serif font özel yüklenmiyor (§2.3), mobile'a
  hiç taşınmamış (§4.2) — üç istemci arasında tutarlı bir marka deneyimi yok.
- **Açık kalan sorular:** `venue-card`'da fotoğraf yokluğu (§2.3) — genç/sosyal medya kitlesi için
  görsel-öncelik beklentisiyle gerilimde; TR/EN dil desteği (§2.2) — turist hedef kitlesiyle
  gerilimde. İkisi de kullanıcı kararını bekliyor.

### 5.4 — Genel değerlendirme

Kod kalitesi katman katman **çok değişken**: backend ve web'in çekirdek mantığı (race-guard'lar,
rule engine, keyset pagination, cross-model review disiplini) profesyonel/kurumsal seviyede sağlam
— ama her katmanda "kenar durumu" ve "kalıcı kayıt" gibi üretim-olgunluğu gerektiren alanlarda
tutarlı boşluklar var. Mobile, olgunluk açısından belirgin şekilde geride — hem görsel hem
işlevsel. Genel olarak: **"MVP olarak doğru inşa edilmiş, üretim/ölçek olgunluğu için ek bir tur
gerekiyor"** özeti doğru bir çerçeveleme.

### 5.5 — Proje-geneli tooling taraması (ek)

**~~✅ Önceki not (YANLIŞ, geri çekildi):~~** "CI sağlam çalışıyor" denmişti — bu sadece
`ci.yml` dosyası **okunarak** varılan, doğrulanmamış bir sonuçtu. Gerçek bir Postgres+PostGIS
container kurup (`docker run postgis/postgis:15-3.4`, port 5434) migration'ları uygulayıp asıl
test suite'i çalıştırınca çok daha ciddi bir tablo çıktı:

**🔴 KRİTİK bulgu — düzeltilmiş/güçlenmiş hâliyle:**
1. **CI hiç çalışmamış.** `gh run list` → sıfır sonuç. Sebep: `ci.yml` `push: branches: [main]`
   üzerinde tetikleniyor ama repoda **`main` branch'i hiç yok** (sadece `master`). Ayrıca GitHub'daki
   **default branch bile `master` değil** — `worktree-mvp-backend-foundation` adında, temizlenmesi
   gereken bir worktree branch'i olarak kalmış. `pull_request` tetikleyicisi de hiç ateşlenmemiş
   çünkü tüm işler PR'sız, doğrudan `master`'a lokal merge edilmiş (STATE.md'nin kendi geçmişi).
   Sonuç: yazılan hiçbir kod, şu ana kadar **hiçbir otomatik CI koşumundan geçmemiş.**
2. **Tetiklense bile şu an kırmızı çıkardı.** Gerçek DB'ye karşı çalıştırınca: `admin-queue-race`,
   `admin-venues-update-race`, `re-verify-race` e2e testlerinin **hiçbiri** kendi District/City
   fixture'ını oluşturmuyor — `prisma.district.findFirstOrThrow()` ile var olan veriye güveniyorlar,
   ama ne CI'da ne hiçbir test dosyasında bir seed adımı yok. Veritabanı boşken bu üç dosya kesin
   başarısız olur.
3. **Repo hijyeni:** İki worktree hâlâ diskte duruyor (`.claude/worktrees/mobile-theme`,
   `.claude/worktrees/mvp-backend-foundation`) — ilgili işler `master`'a merge edildiği STATE.md'de
   yazılı olmasına rağmen `finishing-a-development-branch` akışının worktree/branch temizleme adımı
   tamamlanmamış. `worktree-mvp-backend-foundation` remote'ta da var ve GitHub'ın default branch'i.

Yani §1'deki "backend e2e testlerini bu makinede doğrulayamadım, CI'da geçtiği varsayılıyor"
notu de **yanlış bir varsayıma dayanıyormuş** — CI hiç çalışmadığı için "geçtiği" hiç doğrulanmamış.
→ **Aksiyon gerekiyor (üçü birlikte):** (a) `ci.yml`'i `master`'ı da tetikleyecek şekilde düzelt
(veya GitHub'da `main`'i gerçek ana branch yap), (b) GitHub default branch'i `master`'a çevir, (c)
üç e2e dosyasına kendi District/City fixture'ını oluşturan bir `beforeAll` ekle (ya da CI'a bir
seed adımı ekle), (d) stray worktree'leri temizle.

**🟡 Bulgu — dokümantasyon/gerçeklik uyuşmazlığı:** `CLAUDE.md`'nin "Beklenen komutlar" bölümü
"pre-commit hook (husky + lint-staged)" vaat ediyor ama kod tabanında ne `.husky` dizini ne
`husky`/`lint-staged` bağımlılığı var (`package.json`'da doğrulandı). Geliştiriciler commit
atarken lokal lint/format kontrolünden geçmiyor — tek güvenlik ağı CI, hatayı PR açıldıktan sonra
(daha geç, daha maliyetli) yakalıyor. CLAUDE.md'nin vaat ettiği ama kurulmamış bir parça.

**REVIEW TAMAMLANDI — 1'den 5'e kadar tüm bölümler bitti.**

---

## Aksiyon Günlüğü (review sonrası, kritik bulguları düzeltme aşaması)

Kullanıcı sırayı onayladı: 1) CI/branch, 2) User tablosu, 3) CSV Injection, 4) Web cache,
5) Mobile sign-out, 6) Mobile Error Boundary. Her biri TDD + `cross-model-review` ile.

### Adım 1 — CI/branch düzeltmesi: TAMAMLANDI (kod kısmı)

- ✅ `apps/api/test/global-setup.js` eklendi — Jest `globalSetup`, tüm e2e testlerinin ihtiyaç
  duyduğu District/City fixture'ını bir kere oluşturuyor (idempotent, mevcut veri varsa atlıyor).
- ✅ `apps/api/jest.config.js`'e `globalSetup` eklendi.
- ✅ Gerçek doğrulama: docker'da `gurmego-test-db` (postgis/postgis:15-3.4, port 5434) kuruldu,
  DB sıfırdan migrate edildi, **43/43 suite, 232/232 test geçti** (önceden 8 e2e dosyası
  "No District found" ile başarısız oluyordu).
- ✅ `.github/workflows/ci.yml`: `push.branches` `[main]` → `[master]`.
- ✅ GitHub default branch `worktree-mvp-backend-foundation` → `master` (`gh repo edit`).
- ✅ `worktree-mvp-backend-foundation`: worktree kaldırıldı, lokal+remote branch silindi (zaten
  merge edilmişti, güvenle silindi).
- **⏸️ `worktree-mobile-theme`: SİLİNMEDİ, dokunulmadı.** Silmeye çalışırken git "not fully
  merged" uyarısı verdi — kontrol edilince gerçekten **9 commit, 1331 satır, unutulmuş ama gerçek
  bir mobile geliştirme dalı** olduğu ortaya çıktı: `theme.ts` (tasarım sistemi), `MapScreen.tsx`
  (mobile harita), `FilterSheet.tsx`, ve **Favoriler'de profil kartı + "Çıkış yap"** (§4.1'deki
  "mobile'da sign-out yok" bulgusunu muhtemelen zaten çözüyor). Cross-model-review'dan geçmiş
  (3 MAJOR+1 MINOR düzeltilmiş) ama cihazda hiç test edilmeden oturum kapanmış, yarım kalmış.
  **Kullanıcı kararı: şimdilik dokunma, 6 bulgu bitince bu branch'e dönülecek.** Bu, Adım 5
  (mobile sign-out) ve mobile'ın tasarım sistemi eksikliğiyle ilgili aksiyon planını etkileyebilir
  — o adıma gelince bu branch tekrar gündeme getirilecek.
- **Kalan:** henüz commit edilmedi (jest.config.js, global-setup.js, ci.yml, docs değişiklikleri
  staged değil). Commit + `cross-model-review` bu adımı kapatacak.

### Adım 1 — devamı: CI'yı ilk kez gerçekten tetikleyince çıkan zincirleme bulgular

CI push edildikten sonra **5 ayrı CI koşumu** gerekti, her biri farklı, gerçek, önceden hiç
bilinmeyen bir sorun ortaya çıkardı (hepsi TDD+cross-model-review ile düzeltildi, commit'lendi):

1. **`apps/api` postinstall eksik** — `prisma generate` hiç tetiklenmiyordu, CI'ın kendi
  `prisma migrate deploy` adımı generate yapmıyor. `postinstall: "prisma generate"` eklendi
  (`d87c6d7` sonrası, `6a8e7d8`).
2. **Turbo env-passthrough** — `turbo run test`, Turborepo 2.x'in strict env modu yüzünden
  `DATABASE_URL`/`SUPABASE_JWKS_URL`'i alt task'lara geçirmiyordu. `turbo.json`'da `test` task'ına
  `env` array'i eklendi (`ac9be9a`).
3. **Mobile VirtualizedList timing flake** — CI'nın paylaşımlı runner'ında `waitFor`/Jest
  timeout'ları gerçek FlatList render gecikmesine (~1240ms) yetmiyordu. 6 review turu sonunda
  paket-geneli `testTimeout: 15000` + ilgili `waitFor`'larda `{timeout:5000}` ile düzeltildi
  (`152adc8`).
4. **🟡 AÇIK — çözülemedi, geri alındı:** 4. CI koşumunda mobile'da FARKLI bir hata çıktı:
  `` `render` function has not been called `` (timeout değil). Turbo'nun paralellik seviyesini
  CI'da `--concurrency=2`'ye düşürerek CPU çekişmesini azaltmayı denedim — ama bu, **lokalde
  apps/api'nin e2e testlerinde 5 yeni, önceden hiç görülmemiş başarısızlık** açtı
  (`venues-cursor-pagination.e2e-spec.ts` dahil). Bu, **e2e testlerin paralel/farklı sıralı
  çalışmaya karşı güvenli olmadığını** gösteriyor — testler aynı paylaşılan gerçek DB'yi
  kullanıyor, aralarında transaction-rollback/izolasyon yok. Bu, "CI'yı tetikle" hedefinin çok
  ötesinde, **ayrı ve büyük bir bulgu**: e2e test mimarisinin kendisi concurrency-safe değil.
  `--concurrency=2` değişikliği geri alındı (yeni sorun açtığı için), CI'daki asıl mobile
  flake'i (render-not-called) henüz çözülmedi.

**Karar:** Kullanıcı "devam edelim" dedi — açık noktalar systematic-debugging ile kök nedenine
kadar izlendi.

### Adım 1 — kapanış: mobile flake'in gerçek kök nedeni ve fix'i

5. **Kök neden #1 — `render()`/`rerender()` await edilmiyordu (RACE):**
   `@testing-library/react-native` v14.0.1'de `render`/`rerender` artık `async` fonksiyonlar
   (`dist/render.js`): dahili `act()` çağrısı `await` edilip sonuç `screen`'e kaydedildikten
   (`setRenderResult`) SONRA dönüyorlar. Kod tabanında 16 çağrı yerinde (`ReportForm.spec.tsx`,
   `use-location.spec.tsx`, `auth-context.spec.tsx`, `DiscoveryScreen.spec.tsx` ×5,
   `VenueDetailScreen.spec.tsx` ×7) `render(...)` `await` edilmeden çağrılıyordu. Await
   edilmezse bir sonraki satır (`waitFor`/`screen.getByText`) `setRenderResult` çalışmadan önce
   tetiklenebiliyor — tam da gözlenen `` `render` function has not been called `` hatası. Kanıt:
   dosyadaki TEK `await render(...)` kullanan test (satır 124, "does not let a slower... request")
   CI'da hep geçti; await etmeyenlerden biri (ilk test) başarısız oldu. Bu bir timing/race
   olduğu için `152adc8`'deki timeout artırma hiç işe yaramamıştı. Fix: 16 çağrıya `await`
   eklendi (`f625cba`), `cross-model-review` TEMİZ verdi.
6. **Kök neden #2 — gerçek `VirtualizedList`'in setTimeout gecikmesi (AYRI sorun):**
   #5 fix'inden sonra AYNI test bu kez `Exceeded timeout of 15000 ms` ile patladı — CI'da
   `DiscoveryScreen.spec.tsx` dosyasının TAMAMI 34.5 saniye sürdü (lokalde tüm 13 suite 11-12
   saniyede bitiyor). Bu, `152adc8`'in orijinal teorisini (CI'nın paylaşımlı runner'ında gerçek
   kaynak çekişmesi) doğruladı ama sorun timeout değil, **testlerin gerçek, ağır
   `VirtualizedList` bileşenini mock'lamadan render etmesiydi**. systematic-debugging kuralı
   gereği (aynı semptomda 3. gerçek düzeltme girişimi: timeout artırma → concurrency düşürme →
   bu) kullanıcıya soruldu, "FlatList'i mock'la" seçildi. `apps/mobile/test-utils/mock-flat-list.tsx`
   eklendi (senkron render eden basit bir FlatList yerine geçen mock), `DiscoveryScreen.spec.tsx`
   ve `FavoritesScreen.spec.tsx`'e uygulandı (`b7b22d4`). İlk deneme (`{ ...actual, FlatList }`
   ile module spread) react-native'in lazy-getter export'larını eager tetikleyip invariant
   hatası verdi — `Object.defineProperty` ile sadece `FlatList` export'u değiştirilerek düzeltildi.
   `cross-model-review` bir MINOR bulgu dışında TEMİZ verdi (renderItem eksikse mock çöker,
   mevcut kullanımı etkilemiyor, yine de düzeltildi).
7. **Sonuç:** CI koşumu `b7b22d4` tüm adımlarda yeşil (lint, typecheck, test, build,
   smoke-api). Adım 1 kapandı.

**Kalıcı, ayrı bulgu (Adım 1 kapsamı dışında, backlog'a):** #4'te turbo `--concurrency=2`
denemesi sırasında ortaya çıkan "`apps/api`'nin e2e testleri paralel/sıra-bağımlı çalışmaya
karşı güvenli değil" bulgusu geçerliliğini koruyor — mevcut CI seri çalıştığı için buna maruz
kalmıyor, ama testler aynı gerçek DB'yi transaction-izolasyonu olmadan paylaşıyor. Gelecekte
CI paralelleştirilirse veya test suite büyürse yeniden gündeme gelecek.

**Güncelleme (2026-09-24, proje-geneli smoke test denetimi):** #3'teki mitigasyon (tek testin
timeout'unu artırmak) kalıcı çözüm değilmiş — aynı flake 3. kez tekrarladı, bu kez web ve
admin'de de aynı semptom (CPU çekişmesi altında rastgele timeout) çıktı. Kök neden `apps/api`
değil, turbo'nun 4 paketin Jest/Vitest suite'lerini tamamen paralel çalıştırması. Çözüm:
root `pnpm test` script'i artık `turbo run test --filter=...` çağrılarını ardışık zincirliyor
(`api → web → admin → mobile`), `turbo.json`'ın task graph'ına DOKUNMADAN — böylece
`turbo run test --filter=@gurmego/web` gibi izole geliştirici çağrıları hâlâ bağımsız çalışıyor
(ilk denemede `dependsOn` ile task graph'a bağlanmıştı, `cross-model-review` bunun izole
filtreli çalıştırmaları kırdığını buldu — MAJOR, düzeltildi). 3 ayrı `--force` (cache-bypass)
koşumda gerçek Postgres+PostGIS'e karşı sıfır flake: api 366/366, web 27/27, admin 10/10,
mobile 60/60. `apps/api`'nin e2e paralellik-güvenliği sorunu YUKARIDAKİ paragrafta hâlâ açık —
bu değişiklik onu ele almıyor, sadece CI/lokal test flake'ini kapatıyor. Commit: `024896e`.

**Kök neden araştırması (2026-09-24, systematic-debugging):** Yukarıdaki "e2e testler
paralel/sıra-bağımlı çalışmaya güvenli değil" iddiasını doğrulamaya çalıştım. Kod incelemesi:
e2e-spec dosyaları aslında dikkatli izole edilmiş — her biri `Date.now()`/`Math.random()` ile
üretilmiş benzersiz `targetId`/`category`/`slug` kullanıyor ve sorgularını buna filtreliyor
(`audit-log.e2e-spec.ts`: "every test scopes its assertions to a unique targetId"; hiçbir
`.count()`/`.findMany()` çağrısı `where` filtresiz değil). En olası alternatif hipotez:
bu makine 20 çekirdekli, Jest varsayılan `maxWorkers` ~19 işlem açıyor, her biri kendi
`pg.Pool`'unu (node-postgres varsayılanı: max 10 bağlantı) açıyor → teorik olarak Postgres'in
`max_connections=100`'ünü aşabilir. Bunu ampirik olarak test ettim: Postgres'i kasıtlı olarak
`max_connections=30` (16 worker) ve `max_connections=15` (20 worker, makinenin tam çekirdek
sayısı) ile sınırlayıp tüm `apps/api` suite'ini (54 dosya, 366 test) çalıştırdım — **iki
denemede de 366/366 yeşil, hiç bağlantı hatası yok.** Hipotez DOĞRULANMADI. Sonuç: mevcut
kod tabanında bugün ampirik olarak yeniden üretilebilen bir e2e paralellik-güvensizliği yok;
CI'da 2026 başında görülen o 5 başarısızlık muhtemelen ya GitHub Actions runner'ının farklı
kaynak profiline (daha az çekirdek → daha az worker, farklı bir mekanizma) ya da o zamandan
beri yapılan sertleştirme çalışmasına (benzersiz-anahtar scoping, audit trigger) bağlı, ve
bugün reprodüksiyon yok. "NO FIXES WITHOUT ROOT CAUSE" kuralı gereği spekülatif bir düzeltme
YAPILMADI. Madde açık bırakıldı (zarasız, CI zaten seri) — yeniden CI'da gerçek bir
başarısızlık görülürse GitHub Actions'ın kendi ortamında (yerel Docker'da değil) tekrar
araştırılmalı.

### Adım 2 — §1.3 KRİTİK bulgu: User tablosu hiç doldurulmuyordu

Kullanıcı "user tablosuna geçelim" dedi (2026-09-14). Bounded brainstorming + TDD +
cross-model-review akışı izlendi.

**Kök sorun:** `FavoriteList.userId -> User.id` zorunlu FK, ama `apps/api/src`'de hiçbir yerde
Supabase Auth ile kendi `User` tablosu arasında senkron yoktu — gerçek bir kullanıcı ilk favori
listesini oluşturmaya çalıştığında FK ihlali (500) alıyordu (`favorites.service.spec.ts`
tamamen mock'lu Prisma kullandığı için hiç yakalanmamıştı).

**Karar (kullanıcı onayı ile):** Lazy-upsert'i tek bir merkezi noktada, `JwtAuthGuard`'da yap —
her geçerli JWT doğrulamasında (`FavoritesService.createList()`'te değil, tek bir call site'ta
değil) — böylece gelecekteki her yeni User-bağımlı yazma noktası (katkı kuyruğu, Gurme Puanı
oyu) bu sınıf hatayı bir daha hiç yaşamaz. JWT payload şeması artık `email` claim'ini de zorunlu
kılıyor (`User.email` DB'de required+unique); eksikse 401 INVALID_TOKEN. Email her istekte
güncelleniyor (`update: { email }`) — Supabase kaynak-doğru kabul ediliyor.

**Uygulama:** Upsert, token-doğrulama try/catch'inin **dışında** — bir DB hatası yanlışlıkla
401'e maskelenmeyip gerçek 500 olarak yükseliyor. TDD ile yazıldı: `jwt-auth.guard.spec.ts`'e
16 test (email eksik/geçersiz, upsert create/update argümanları, DB hatası propagasyonu, vb.)
eklendi. `admin-queue-jwt-guard.e2e-spec.ts` (gerçek `AuthModule` + gerçek Postgres'e karşı)
`PrismaModule` import etmiyordu ve mock JWT payload'larında `email` yoktu — ikisi de düzeltildi,
artık gerçek DB'ye User row yazıp temizliyor.

**cross-model-review (Codex) bulgusu (MINOR, düzeltildi):** e2e testler yalnızca upsert'in
`create` yolunu gerçek DB'ye karşı çalıştırıyordu, `update` (email değişikliği) yolu sadece
mock'ta test edilmişti — yeni bir e2e test eklendi (aynı `sub` ile farklı email, gerçek DB'de
email'in güncellendiğini doğruluyor).

**Sonuç:** `7482448` — 43/43 suite, 237/237 test lokalde yeşil, ama CI ilk pushta **ilgisiz bir
sebeple** kırmızı çıktı (aşağıya bkz). `fd4a44c`'te düzeltilip CI yeşile döndü.

### Adım 2 — yan bulgu: CI'da tarih/saat dilimine bağlı bir flake (bizim değişikliğimizle ilgisiz)

`7482448` push'unun CI koşumu `venues-open-now-midnight.e2e-spec.ts`'te patladı — User tablosu
değişikliğiyle hiç ilgisi yoktu. Kök neden systematic-debugging ile izlendi: CI koşumu tam
UTC 21:02'de çalıştı, bu saatte İstanbul (UTC+3) zaten bir sonraki takvim gününe geçmişti
(Pazar → Pazartesi). Test dosyası `isoDow`'u `new Date().getDay()` ile (test runner'ın YEREL
saatiyle, GitHub Actions'ta UTC) hesaplıyordu, ama gerçek SQL sorgusu
`EXTRACT(ISODOW FROM now() AT TIME ZONE 'Europe/Istanbul')` kullanıyordu — Cuma→Cumartesi ve
Pazar→Pazartesi geçişlerinde (21:00-23:59 UTC penceresi) ikisi farklı gün verebiliyordu. Test bu
yüzden yanlış opening-hours bucket'ına ("sat_sun") yazdı, SQL doğru olana ("mon_fri") baktı, o
key yoktu, sorgunun bilinçli "eksik/bozuk saat → dahil et" (fail-open) davranışı devreye girip
testin hariç tutulmasını beklediği bir mekanı dahil etti.

**Fix (`fd4a44c`):** `isoDow` artık zaten hesaplanan İstanbul-dönüştürülmüş `Date`'ten türetiliyor,
fresh `new Date().getDay()` kullanımı kaldırıldı — `venues-open-now-midnight.e2e-spec.ts` VE
`venues-open-now.e2e-spec.ts`'te (cross-model-review aynı anti-pattern'i orada da buldu).
`TZ=UTC` ile lokalde CI'nın saat dilimini simüle ederek doğrulandı. Codex çok daha dar bir
kalıntı riski işaretledi (İstanbul-dönüştürülmüş `now` ile SQL'in kendi `now()`'ı birkaç ms
farklı anlarda okunuyor) — kabul edildi, çünkü gerçek-Postgres bir e2e testte zamanı
sabitlemek bu dosyanın kasıtlı "gerçek zaman" tasarımıyla çelişir.

**Ders:** Test'te tarih/gün hesaplarken asla runner'ın yerel saatiyle (`new Date().getDay()`)
başlama — SQL/prod kod hangi saat dilimini kullanıyorsa test de aynısını kullanmalı.

### Adım 3 — §3.3 KRİTİK bulgu: CSV export'ta Formula/CSV Injection

Kullanıcı "4 kritik bulgudan sıradakine geçelim" dedi (2026-09-14) — onaylanan sıraya göre bu
CSV Injection'dı. Bounded brainstorming + TDD + cross-model-review akışı izlendi.

**Kök sorun:** `admin-reports.service.ts`'in `exportVenues('csv')`'ı `Venue`'nün serbest metin
alanlarını (`name`, `editorialNote`, `transportNote`, `address`, `cuisineType`) sanitizasyonsuz
`csv-stringify`'a veriyordu. Bir katkıcı mekan adına `=HYPERLINK(...)` gibi bir "formül" girip
curator gözden kaçırıp onaylarsa, admin CSV'yi Excel/Sheets'te açtığında bu formül otomatik
çalışırdı (OWASP CSV/Formula Injection).

**İnceleme:** Array/JSON alanların (`signatureItems`, `photos`, `openingHours`) zaten güvenli
olduğu doğrulandı — `csv-stringify` bunları `[...]`/`{...}` şeklinde JSON'a çevirip hücreye
yazıyor, `[`/`{` formül tetiklemiyor (node ile ampirik olarak test edildi). Risk yalnızca düz
string alanlarda.

**Uygulama:** `escapeCsvFormulaInjection()` — `=`/`+`/`-`/`@` (OWASP'ın 4 kanonik karakteri) ile
başlayan string değerlerin önüne tek tırnak ekliyor, sadece `format === "csv"` yolunda. JSON
export'a dokunulmadı (spreadsheet'te açılmıyor, risk yok). TDD ile yazıldı.

**cross-model-review (Codex) bulguları (2 tur, hepsi düzeltildi):**
- Tur 1: regex `\t`/`\r`/`\n` ile başlayan hücreleri kapsamıyordu (bazı spreadsheet import
  yolları formül-öneki tespitinden önce baştaki boşluk/kontrol karakterlerini atlıyor) — regex'e
  eklendi, TDD ile (önce eski regex'le kırmızıya düşürülüp doğrulandı). Array/JSON alanların
  güvenli olduğu iddiası sadece yorumda belgelenmişti, testle doğrulanmamıştı — test eklendi.
- Tur 2 (son diff): `openingHours` (JSON obje) için ayrı test yoktu (sadece array test edilmişti)
  — eklendi. Bir yorum bloğu yanlışlıkla iki kez tekrarlanmıştı — düzeltildi.

**Sonuç:** `f1ac2fc` — 43/43 suite, 248/248 test lokalde ve CI'da yeşil.

### Adım 4 — Geniş denetim: hangi bulgular fark edilmeden zaten çözülmüş, hangileri gerçekten açık

2026-09-25: `docs/REVIEW-PLAN.md`'nin birçok bulgusunun (§2.1 web cache revalidate, §4.1 mobile
sign-out, §4.5 mobile Error Boundary, §4.2 mobile pagination) aralarda yapılan işle zaten
düzeltilmiş olduğu ama dokümanın güncellenmediği fark edildi. Bir fork ile tüm §1-§5.5 arası açık
işaretli bulgular kod tabanıyla tek tek karşılaştırıldı.

**Fark edilmeden zaten çözülmüş (bu adımda doğrulandı, ek iş gerekmedi):**
- §1.6 backend güvenlik header/compress/logging — `@fastify/helmet`, `@fastify/compress`, pino
  (`apps/api/src/main.ts`)
- §1.1/§1.2 favorites + admin yazma uçlarında rate-limit — `@UseGuards(RateLimitGuard)`
- §1.5 XFF header sahteciliği — `rate-limit.guard.ts` artık sadece `req.ip` kullanıyor, regresyon
  testi var
- §3.3 admin audit log — `apps/api/src/audit/audit.service.ts` + migration
- §2.2 web serif font, §2.3 tasarım tokenı (180 hardcode hex → 2), §2.3/§2.5 OG/Twitter meta,
  §2.5 SEO (`robots.ts`/`sitemap.ts`)
- §4.1 mobile auto-navigate-back (`AuthScreen.tsx`)

**Gerçekten açık bulunan ve bu adımda kapatılan (TDD + cross-model-review, Codex: 0 BLOCKER/
0 MAJOR/2 MINOR, ikisi de düzeltildi — bkz. commit mesajı):**
- Mobile `AuthScreen` double-submit guard yoktu → `useRef` tabanlı senkron kilit eklendi
- Mobile `TabNavigator`'da `tabBarIcon` yoktu → geçici text-glyph icon eklendi (gerçek icon seti
  tasarım tokenı geçişiyle birlikte gelecek)
- Mobile `ReportForm`'da client validasyon yoktu → backend'in kendi `CreateReportSchema`'sı
  (`packages/shared`) client'ta da `safeParse` ile kullanıldı
- Admin `erisim-yok/page.tsx` tamamen stilsizdi → Tailwind ile stillendirildi (mantık değişmedi)
- Web `manifest.json`'ın `theme_color`/`background_color`'ı eski koyu tondaydı (`#1a1611`),
  `layout.tsx`'in `PRIMITIVE_COLORS.cream`'i (`#f4f0e7`) ile eşleştirildi

**Hâlâ açık, bu adımda ele alınmadı (kapsam/boyut gerekçesiyle ayrı işe bırakıldı):**
- **CSP eksikliği** (web+admin `next.config.js`) — kod içinde bilinçli erteleme yorumu var
  (Leaflet/Supabase için allow-list gerektiriyor), orta öncelik/orta boyut

### Adım 5 — §2.2/§5.1 bulgusu: web'de serbest metin arama yoktu

`61f857f` — bounded brainstorming (kullanıcı "soru sormana gerek yok" dedi) + TDD. `packages/shared`
`VenueListQuerySchema`'ya `q` (trim, min 2, max 100) eklendi; `VenuesRepository.searchPublished()`
`q` varsa `name`/`cuisineType`/`editorialNote` üzerinde ILIKE koşulu ekliyor (repository katmanında
kalıyor, servis/controller generic pass-through); web'de 300ms debounce'lu arama input'u eklendi.
Bilinçli kapsam dışı: semantic/pgvector arama (Faz 2), aksan-duyarsız arama (pg_trgm/unaccent, MVP
ölçeğinde gerekmiyor).

**Review notu:** Codex bu diff'in cross-model-review'ında kota sınırına takıldı (28 Eylül'e kadar
sıfırlanmıyor), yapılandırılmış bir bulgu raporu üretemedi. Kullanıcı onayıyla kendim review ettim
(çapraz-model DEĞİL, kendi kör noktalarımı taşıyor) — bir gerçek bulgu buldu: ILIKE terimi
`%`/`_` karakterlerini kaçırmıyordu (Postgres LIKE wildcard'ları), arama metninde bu karakterler
olsa literal eşleşme yerine wildcard gibi davranırdı. Düzeltildi (`\\`-escape), hem unit hem
gerçek-DB e2e testiyle doğrulandı (`venues-search-query.e2e-spec.ts`). **Bu değişiklik gerçek
çapraz-model review görmedi — Codex kotası döndüğünde tekrar gözden geçirilmesi önerilir.**

### Adım 6 — Codex kotası dönene kadar: kalan güvenli/mekanik maddeler

2026-09-25, aynı gün, kullanıcı "kota yenilenene kadar yapılabilecek her şeyi yap" dedi. Kalan
REVIEW-PLAN.md maddeleri tek tek elden geçirildi: çoğu zaten stale (fark edilmeden önceki
oturumlarda çözülmüş — CSV injection, audit log, rate-limit, OG meta, tasarım tokenı, hepsi
doğrulanarak stale bulundu). Tarayıcı/hesap gerektirmeyen, gerçekten açık olanlar kapatıldı:

- **JSON-LD structured data** (`61f857f` sonrası, `6536858`) — `mekan/[slug]` sayfasına schema.org
  `Restaurant` yapısal verisi eklendi (`src/lib/venue-json-ld.ts`). XSS-güvenli: `toSafeJsonLdString`
  `<` karakterini kaçırıyor (JSON-LD-in-React'ın bilinen `</script>` breakout riski).
- **Twitter card meta** (`a2bd244`) — `mekan/[slug]` (fotoğraf varsa `summary_large_image`) ve
  `[district]` (`summary`) sayfalarına eklendi.
- **ReportForm maxLength + venue-detail lazy loading** (`d876c5e`) — web'in `ReportForm`'unda
  backend şemasıyla eşleşen `maxLength=500` yoktu; `venue-detail.tsx`'in foto galerisinde
  `loading="lazy"` eksikti (venue-card'da vardı).
- **Admin sign-out butonunda focus-visible yoktu** (`6278026`) — hem paylaşılan
  `(protected)/layout.tsx` hem `erisim-yok/page.tsx` (bugün stillendirilirken kaçmış) düzeltildi.

**Kasıtlı olarak yapılmadı (tarayıcı doğrulaması veya tasarım/hesap gerektiriyor):**
- **CSP header** (web+admin) — kod içinde zaten belgelenmiş bilinçli erteleme; bir CSP'yi gerçek
  tarayıcıda test etmeden şart koşmak (Leaflet/Supabase allow-list'i kırma riski) bu ortamda
  yapılamaz.
- **Maskable PWA icon** — mevcut ikonu `purpose:"maskable"` ile işaretlemek, safe-zone padding'i
  olmayan bir asset'i OS'un maske (dairesel/squircle) kırpmasına sokar — görsel doğrulama
  gerektirir.
- **Root layout OG image** (site geneli paylaşım önizlemesi) — marka assets'i (1200×630 görsel)
  gerektirir, tasarım kararı.
- **Manuel mekan düzenleme UI'ı, Gurme Puanı, semantic search, mod/durum bazlı arama** — hepsi ya
  Faz 2 kapsamında ya da ayrı bir brainstorming/plan gerektiren büyüklükte özellik, bu adımın
  "güvenli/mekanik düzeltme" kapsamının dışında.

**Tüm bu değişiklikler self-review ile geçti (Codex kotası nedeniyle çapraz-model DEĞİL) —
kota döndüğünde toplu bir cross-model-review önerilir.**

---

*(Buradan sonrası: kullanıcının önceliklendirme kararına göre aksiyon planı — ayrı bir konuşma/plan
dosyası olabilir.)*
