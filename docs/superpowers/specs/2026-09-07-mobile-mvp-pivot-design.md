# MVP Pivot — React Native (Expo) Native App — Design

**Tarih:** 2026-09-07 · **Durum:** Taslak — `idea-red-team` (Codex) henüz çalıştırılmadı.

İlgili: [product-overview.md](../../product-overview.md) (mobil "ana deneyim" — orijinal hedef) ·
[architecture.md](../../architecture.md) §3 (monorepo iskeleti, `apps/mobile` zaten planlanmıştı) ·
`docs/CHANGELOG.md` "2026-07-16 — Red-team pivotu" (React Native'in MVP'den Faz 2'ye ertelendiği
karar) · [2026-07-29-plan4d-kvkk-analytics-design.md](2026-07-29-plan4d-kvkk-analytics-design.md) ·
[2026-07-29-plan4e-provisioning-runbook-design.md](2026-07-29-plan4e-provisioning-runbook-design.md)

## 1. Bağlam ve karar

2026-07-16 round-2 red-team'i, orijinal spec'teki "React Native ana deneyim" kararını MVP kapsamı
için erteleyip web/PWA'ya indirgemişti (KOŞULLU: "retention kanıtlanırsa aç"). O zamandan beri
Plan 1 (backend), Plan 2 (web/PWA tüketici), Plan 3 (admin panel), Plan 4a-4c (altyapı taslağı +
düzeltmeler) bu web/PWA varsayımıyla tamamlandı ve `master`'a merge edildi (Task 27, 2026-09-06).

Kullanıcı bu kararı **pilot başlamadan önce** tersine çeviriyor: MVP'nin tüketici deneyimi artık
web/PWA değil, **native app (iOS+Android)** olacak. Gerekçe: (1) mağaza (App Store/Play Store)
görünürlüğü/güveni gerekli görülüyor, (2) PWA deneyiminin (konum, genel akıcılık) yetersiz
hissettirmesi. Bu, orijinal `architecture.md`'nin hedeflediği stack'e dönüş — yeni bir icat değil,
ertelenmiş kararın geri açılması.

**Önemli:** Bu bir kod yazma kararı değil, bir **kapsam** kararı — `idea-red-team`'in özellikle
sorması gereken soru, bu pivotun gerekçesinin (mağaza görünürlüğü + PWA yetersizliği) gerçekten
6 haftalık/30-45 mekanlık bir pilot için native app'in ekstra maliyetini (geliştirme süresi +
store review riski + $99/yıl Apple + $25 Google) haklı çıkarıp çıkarmadığıdır.

## 2. Kapsam

### 2.1 Yeni: `apps/mobile` (Expo + React Native + TypeScript)
Monorepo'ya yeni bir workspace eklenir. Mevcut `apps/api` **hiç değişmez** — zaten API-first
tasarlandı (REST + OpenAPI), tüketici istemcisinin web mi native mi olduğu backend'i ilgilendirmez.
`packages/shared`'daki zod şemaları ve `packages/api-client`'ın ürettiği tipler aynen tüketilir.

**Özellik kapsamı — `apps/web`'de (Plan 2) zaten yapılmış olanın birebir taşınması, yeni özellik
eklenmiyor:**
- Mekan keşfi/liste: ilçe + kategori + fiyat filtreleri (Kadıköy, Beşiktaş, Beyoğlu).
- Mekan detay sayfası.
- Favoriler: liste oluşturma, mekan ekleme (Supabase Auth ile giriş gerektirir, AK-02).
- "Buraya nasıl giderim" → Maps deep-link.
- Paylaş (native share sheet — `expo-sharing`, web'deki WhatsApp/platform share'in native karşılığı).
- "Bilgi yanlış" raporlama.
- Giriş/kayıt (Supabase Auth).
- Plan 4d'nin KVKK rıza checkbox'ı + hesap silme ekranı (mobile de birinci sınıf istemci sayılıyor).

**Kapsam DIŞI (bu planda):**
- Push notification — hiç istenmedi, YAGNI.
- Offline-first / önbellekleme stratejisi — MVP'de web'de de yoktu, aynı kapsam korunuyor.
- e2e test (Detox/Maestro) — küçük ekip, YAGNI; birim/component test yeterli.

### 2.2 `apps/web` — SEO/marketing sitesine indirgeniyor
Tüketici deneyimi native app'e taşınıyor, ama `apps/web` **bırakılmıyor** — `architecture.md`'nin
zaten belirttiği SEO/SSR amacıyla kalıyor (mekan sayfalarının Google'da indekslenmesi, native
app'e yönlendirme). Mevcut kod (Plan 2) korunur, aktif tüketici akışı olarak geliştirilmez ama
kaldırılmaz. Bu planın kapsamı dışında — ayrı, küçük bir takip maddesi (hangi sayfaların kalacağı,
hangi CTA'ların native app'e yönlendireceği) `idea-red-team`'den sonra netleşir.

### 2.3 `apps/admin` — değişmiyor
Admin panel web kalıyor, bu pivot admin tarafını etkilemiyor.

## 3. Mimari

- **Framework:** Expo (bare değil, managed workflow) — EAS Build/Submit ile mağaza dağıtımı,
  OTA update imkanı (gelecekte).
- **Navigasyon:** React Navigation (stack + tab, mevcut web'in route yapısına paralel: keşif →
  detay, favoriler, giriş).
- **Auth:** `@supabase/supabase-js` + `expo-secure-store` (token'lar için, web'in
  localStorage/cookie yaklaşımının native karşılığı).
- **Konum:** `expo-location` (web'in `useGeolocation` hook'unun native karşılığı, gerçek native
  izin akışıyla — PWA'nın "yetersiz hissettirme" endişesinin çözümü tam olarak burada).
- **API istemcisi:** `packages/api-client` aynen kullanılır (React Native, Node.js `fetch`
  polyfill'iyle uyumlu, ekstra bir adaptasyon beklenmiyor — `idea-red-team` bunu doğrulamalı).
- **State/veri çekme:** Web'deki mevcut desenlere paralel (React hooks, ekstra bir state
  kütüphanesi — Redux/Zustand — eklenmiyor, YAGNI; web'de de yoktu).

## 4. Test stratejisi

- Jest + React Native Testing Library — component/hook birim testleri, web'deki
  `*.spec.tsx` konvansiyonuna paralel.
- Gerçek cihaz/simulator testi: Expo Go (geliştirme sırasında) + EAS Build ile gerçek build
  (TestFlight/Play internal testing) üzerinden manuel doğrulama — otomatik e2e yok (kapsam dışı,
  §2.1).

## 5. Dağıtım

- Expo EAS Build (iOS + Android tek yapılandırmadan).
- EAS Submit → TestFlight (iOS) + Play internal testing (Android) → prod store listing.
- Apple Developer Program ($99/yıl) + Google Play Console ($25 tek seferlik) — Plan 4e'nin
  "DURAKLAMA NOKTASI" (para harcayan adım, kullanıcı onayı) kuralı burada da geçerli.
- Store review süresi pilot başlangıcını geciktirebilir — kullanıcı bunu kabul etti (§bkz. karar
  geçmişi), sabit bir tarih yok.

## 6. Plan 4d/4e ile ilişki

Plan 4d (KVKK+event-capture+hesap silme) ve Plan 4e (provisioning+go-live runbook) **iptal
edilmiyor** — ikisi de hâlâ gerekli, ama:
- Plan 4d'nin web-taraflı UI parçaları (checkbox, hesap silme butonu) artık HEM web HEM mobile'da
  olmalı — Plan 4d'nin kapsamı bu pivotla genişliyor, `idea-red-team`'e bu şekilde gidecek.
- Plan 4e'nin Adım 3'ü (Vercel web+admin) admin + SEO-web için geçerli kalıyor; yeni bir "Adım 3b"
  (EAS Build/Submit + store hesapları) eklenmesi gerekiyor.
- Event-capture noktaları (`MAPS_CLICK`, `FAVORITE_ADD`/`FAVORITE_REMOVE`, `SHARE_CLICK`) artık
  hem web hem native'de tetiklenmeli.

Bu doküman bu ilişkiyi işaret ediyor ama Plan 4d/4e'nin kendi dokümanlarını bu pivota göre
güncellemek ayrı bir adım (writing-plans aşamasında).

## 7. Yeni plan sıralaması (bu pivotun sonucu)

Eski sıralama (Plan 4d → Plan 4e) yerine önerilen yeni sıra:
1. **Plan 5 — Mobile MVP** (bu doküman) — `apps/mobile`'ın Plan 2 özellik setini native'e taşıması.
2. **Plan 4d (güncellenmiş)** — KVKK+event-capture+hesap silme, artık hem web hem mobile kapsıyor.
3. **Plan 4e (güncellenmiş)** — provisioning + EAS Build/Submit + store hesapları dahil.

`idea-red-team` bu sıralamayı da sorgulamalı (paralel yürütülebilir mi, yoksa sıralı mı olmalı).
