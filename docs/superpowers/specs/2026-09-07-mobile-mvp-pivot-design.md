# MVP Pivot — React Native (Expo) Native App — Design

**Tarih:** 2026-09-07 · **Durum:** `idea-red-team` (Codex) çalıştırıldı → **NO-GO**, yüksek güven.
Kullanıcı verdikti bilerek reddetti ("gözler açık ilerle") — bkz. §8. writing-plans'a geçiliyor.

İlgili: [product-overview.md](../../product-overview.md) (mobil "ana deneyim" — orijinal hedef) ·
[architecture.md](../../architecture.md) §3 (monorepo iskeleti, `apps/mobile` zaten planlanmıştı) ·
`docs/CHANGELOG.md` "2026-07-16 — Red-team pivotu" (React Native'in MVP'den Faz 2'ye ertelendiği
karar) · [2026-07-29-plan4d-kvkk-analytics-design.md](2026-07-29-plan4d-kvkk-analytics-design.md) ·
[2026-07-29-plan4e-provisioning-runbook-design.md](2026-07-29-plan4e-provisioning-runbook-design.md)

## 0. Red-team verdikti (Codex, `idea-red-team`, 2026-09-07) — KAYIT, KARAR DEĞİL

**VERDİKT: NO-GO** — "doğrulanmamış mağaza-güven varsayımı uğruna tamamlanmış doğrulama yüzeyini
(web/PWA) yeniden yazıp pilotu başlamadan bloke ediyor."

**CONFIDENCE:**
- GÜVEN: yüksek
- VARSAYIMLAR: küçük/tek ekip; kanıtlanmış store yayın hattı yok; Expo prod tecrübesi yok; 150
  kullanıcı hedefi korunuyor; PWA'nın reddedildiğini gösteren saha verisi yok.
- FİKRİMİ NE DEĞİŞTİRİR: 100 kullanıcıyla eşzamanlı testte native koldaki 50 kişiden ≥30'unun
  kurulumu tamamlaması + kuranların ≥%25'inin D7'de dönmesi + PWA kolunun D7 dönüşünün %10'un
  altında kalması + iki mağaza için release candidate'ın ≤10 mühendis-gününde gerçek cihazda hazır
  olduğunun gösterilmesi.
- BİLİNMEYENLER: Apple/Google hesap türü/yaşı, kurucunun gerçek RN/Expo tecrübesi, PWA'nın gerçek
  cihaz performansı, native isteyen kullanıcı görüşme sayısı.

**Kullanıcının kararı:** Verdikti bilerek reddetti — "app olması şart, işlevselliği o zaman ortaya
çıkıyor." Kabul edilen/reddedilen bulgular için §8'e bakın.

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
Monorepo'ya yeni bir workspace eklenir. Mevcut `apps/api` **neredeyse hiç değişmez** — zaten
API-first tasarlandı (REST + OpenAPI), tüketici istemcisinin web mi native mi olduğu backend'i
ilgilendirmez. Tek istisna: `plan-red-team`'in bulduğu gibi "favoriden çıkarma" ne backend'de ne
web'de hiç var olmayan bir özellikti; kullanıcı gerçek parite için bunu da eklemeye karar verdi
(`DELETE /me/lists/:id/venues/:venueId`, implementasyon planı Task 1). `packages/shared`'daki zod
şemaları aynen tüketilir (bkz. §3 — `packages/api-client` KULLANILMIYOR, aşağıda düzeltildi).

**Özellik kapsamı — `apps/web`'de (Plan 2) zaten yapılmış olan özellik SETİNİN aynısı, yeni özellik
eklenmiyor. Ama Codex'in haklı olarak işaret ettiği gibi bu bir "kod taşıma" değil, UI'nin sıfırdan
native'de yeniden inşası (31 dosya/~2.200 satır web koduna karşılık native tarafı sıfırdan
yazılacak) — bu maliyeti küçük göstermemek için burada açıkça yazılıyor:**
- Mekan keşfi/liste: ilçe + kategori + fiyat filtreleri (Kadıköy, Beşiktaş, Beyoğlu).
- Mekan detay sayfası, **native harita** (aşağıya bkz., web'in Leaflet'inin native karşılığı —
  önceki taslakta eksikti, `idea-red-team` bulgusu).
- Favoriler: liste oluşturma, mekan ekleme/çıkarma (Supabase Auth ile giriş gerektirir, AK-02).
- "Buraya nasıl giderim" → Maps deep-link.
- Paylaş — React Native'in kendi `Share.share()` API'si (**`expo-sharing` DEĞİL** — o, yerel dosya
  paylaşımı için; metin/URL paylaşımı `react-native`'in `Share` modülüyle yapılır. `idea-red-team`
  bulgusu, önceki taslaktaki hata düzeltildi).
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
- **Harita:** `react-native-maps` — iOS'ta ek yapılandırma gerektirmeyen Apple Maps varsayılanıyla
  çalışır; **Android'de gerçek Google Maps API anahtarı/credential gerekir** (`plan-red-team`
  bulgusu — önceki taslakta "ekstra API anahtarı/maliyet gerektirmez" yanlış yazılmıştı,
  düzeltildi). Bu credential'ın provisioning'i Plan 4e'nin kapsamına düşüyor (gerçek bir Google
  Cloud hesabı/API anahtarı gerektirdiği için, para/hesap kararı) — implementasyon planına not
  olarak düşüldü. Web'in Leaflet'inin native karşılığı.
- **API istemcisi:** `packages/api-client` **KULLANILMIYOR** — `idea-red-team`'in bulduğu gibi
  onun ürettiği response tipleri `never`, "tip güvenli" bir transport değil. Native taraf, web'in
  `apps/web/src/lib/api.ts`'deki gibi doğrudan `fetch` + `packages/shared` zod şemalarıyla
  doğrulama yapan ince bir katman yazacak — `packages/api-client`'a hiç bağımlı değil.
- **State/veri çekme:** Web'deki mevcut desenlere paralel (React hooks, ekstra bir state
  kütüphanesi — Redux/Zustand — eklenmiyor, YAGNI; web'de de yoktu).
- **Şema tekilliği:** `plan-red-team`'in bulduğu gibi, response-şekli şemalarının (liste/harita/
  rapor projeksiyonları) hem web'de hem mobile'da ayrı ayrı tanımlanması bir drift riskiydi.
  İmplementasyon planı (Task 2) bunları `packages/shared`'a taşıyor, `apps/web` de oradan import
  ediyor — artık TEK tanım, iki kopya değil.

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
- **Google Play'in yeni geliştirici hesaplarında prod erişimi için 12 test kullanıcısıyla 14 gün
  kesintisiz closed test şartı var** (`idea-red-team` bulgusu, kabul edildi) — bu, geliştirmeyle
  paralel başlatılmalı (build hazır olur olmaz closed test başlatılır), zaman çizelgesine dahil.
- **Apple, hesap açan uygulamalarda uygulama-içi hesap silmeyi zorunlu tutuyor** — Plan 4d'nin
  "Supabase Auth kaydı da silinsin mi" açık sorusu bu yüzden native app için ARTIK açık soru değil,
  **zorunluluk**: Supabase Auth kaydı da silinmeli (Plan 4d §4 madde 1'in cevabı zaten bu yöndeydi,
  bu bulgu o kararı güçlendiriyor).
- Store review süresi pilot başlangıcını geciktirebilir — kullanıcı bunu kabul etti, sabit bir
  tarih yok.

## 5.1 Gerçekçi zaman/maliyet tahmini (`idea-red-team` bulgusu, kabul edildi)

- **Geliştirme:** 20-35 mühendis-günü (auth/session/lifecycle karmaşıklığı dahil — web'in favori
  ekranındaki oturum yarışları 11 review turu gerektirmişti, native lifecycle'da aynı sınıf
  hataların tekrar çıkması bekleniyor).
- **Play closed test:** +14 takvim günü (geliştirmeyle paralel yürütülebilir, yukarıya bkz.).
- **Apple review:** değişken (genelde 1-3 gün), red riski var.
- **Toplam gerçekçi gecikme, pilot başlangıcına kadar: 5-9 hafta.** Pilotun kendisi 6 hafta —
  yani pivot, "öğrenme süresini geliştirme süresine çeviriyor" (Codex'in ifadesi). Kullanıcı bu
  maliyeti bilerek kabul etti (§0, §8).

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

## 8. Red-team bulguları — kabul/ret kaydı

`idea-red-team` NO-GO verdi (§0). Kullanıcı verdikti bilerek reddetti: "app olması şart, işlevselliği
o zaman ortaya çıkıyor." Bulgu bazında karar:

### Kabul edilenler (plana işlendi)
- **Mağaza-güven varsayımı kanıtsız** — kabul edildi, gerçek bir varsayım olarak kayda geçti (§0),
  çürütülmedi ama kullanıcı bilerek üstleniyor.
- **`packages/api-client`'ın "tip güvenli" iddiası şişirilmiş** (response tipleri `never`) —
  düzeltildi, §3.
- **`expo-sharing` yanlış API seçimi** — düzeltildi (`react-native`'in `Share` modülü), §2.1.
- **Native harita çözümü tanımsızdı** — `react-native-maps` eklendi, §3.
- **Google Play 14-gün closed test şartı** — eklendi, §5.
- **Apple'ın hesap-içi silme zorunluluğu** — Plan 4d'nin açık sorusunu (Supabase Auth kaydı
  silinsin mi) zorunluluğa çevirdi, §5.
- **Gerçekçi efor tahmini (20-35 mühendis-günü + 14 gün Play test + Apple review)** — eklendi, §5.1.
- **İki istemci (web+mobile) bakım yükünün küçümsenmesi** — kabul edildi, §6'da zaten iki istemcili
  event-capture/KVKK olarak işaretlenmişti, bu bulgu o kararın maliyetini teyit etti.

### Reddedilenler
- **"Gereksiz kılan çözüm: Google Maps zaten var"** — reddedildi. Gerekçe: bu argüman native app
  kararına değil, GurmeGo'nun VAR OLMA gerekçesine karşı — aynı eleştiri web/PWA'ya da, projenin
  kendisine de uygulanabilir, ve `product-overview.md`'de zaten ele alınmış (Maps'te kürasyon yok,
  zincir/butik ayrımı yok, fiyat aralığı eksik). Bu yanlışsa ne olur: GurmeGo'nun temel tezi
  (Maps'in üstüne kürasyon katmanı) çürük demektir — ama bu, native-spesifik bir risk değil,
  projenin baştan beri taşıdığı bir risk, zaten bir kez red-team'den geçmiş.
- **"MAPS_CLICK yanıltıcı metrik olabilir" ölüm senaryosu** — native kararına özgü bir risk olarak
  reddedildi (bu web/PWA'da da aynı derecede geçerli bir sorun), ama Plan 4d'ye not olarak eklendi:
  event-capture tasarımı "karar eylemi" ile "terk etme sinyali" ayrımını netleştirmeli.

### Kabul edilmeyen ama izlenecek (Codex'in "fikrimi ne değiştirir" kriteri)
Codex'in verdiği somut ters-kanıt eşiği (§0) bir izleme kriteri olarak saklanıyor: eğer native
kurulum/dönüş oranları bu eşiklerin belirgin altında kalırsa (özellikle D7 dönüş <%25 — bkz.
ADR 005'in kendi "erken uyarı sinyalleri" bölümü, `plan-red-team`'in 2. turda düzelttiği tek,
tutarlı eşik), bu MVP kararının yanlış olduğunun erken sinyali sayılacak ve web/PWA'ya geri dönüş
gündeme gelecek.

## 9. Plan-red-team (2. tur) — YENİDEN BÖL verdikti, plan v2

`writing-plans` sonrası, `subagent-driven-development` başlamadan önce zorunlu ikinci bir Codex
denetimi (`plan-red-team`) çalıştırıldı: **YENİDEN BÖL** verdikti — sözleşme sırası hataları
(Task 1'in paket-adı-önce-install-sonra sırası ters yazılmıştı, plan hiç çalışmadan kırılırdı),
kategori filtresinin unutulması, favoriler ekranı/tab navigasyonunun hiç olmaması gibi gerçek
bulgular buldu. Plan `docs/superpowers/plans/2026-09-07-mobile-mvp.md`'de v2 olarak tamamen
yeniden yazıldı — tüm bulgular ya düzeltmeye işlendi ya da (favoriden çıkarma gibi) kullanıcıya
sorulup kapsam genişletilerek çözüldü. Kabul/ret detayları o planın kendi sonundaki
"Plan-red-team bulguları — reddedilenler" bölümünde.
