# Plan 4d — KVKK + Pilot Event-Capture + Hesap Silme — Design

**Tarih:** 2026-07-29 · **Durum:** Taslak — `idea-red-team` (Codex) henüz çalıştırılmadı, kota
2026-08-01 23:26'ya kadar dolu.

İlgili: [prd.md](../../prd.md) §1 madde 6, §5 (Pilot Karar Sözleşmesi) ·
[2026-07-29-infra-launch-design.md](2026-07-29-infra-launch-design.md) (orijinal taslak, bölünme
gerekçesi) · [2026-07-29-plan4e-provisioning-runbook-design.md](2026-07-29-plan4e-provisioning-runbook-design.md)
(bağımlı plan — bkz. §5)

Bu plan, eski tek "Plan 4" taslağının §7'sindeki açık sorulara kullanıcının verdiği cevaplarla
netleşti:
- Event-capture: **kendi Postgres tablosu** (üçüncü parti değil).
- Hesap silme akışı: **bu plana dahil**, kullanıcılar kendi hesaplarını silebilmeli.
- KVKK metinlerinin hukuki onayı: **kapsam dışı, en sona bırakılıyor** (kullanıcı ayrıca halledecek).

## 1. Kapsam

Bu plan tamamen **kod + doküman** — gerçek hesap/provisioning gerektirmiyor, lokal/test ortamında
tam TDD döngüsüyle yürütülebilir. Üç parça:

1. **KVKK aydınlatma/rıza/saklama metni** (doküman, yayın öncesi kullanıcı+opsiyonel hukuki onay).
2. **Pilot karar metrikleri için event-capture** (`AnalyticsEvent` tablosu + 3 event noktası +
   admin rapor sayfası).
3. **Hesap silme akışı** ("hesabımı sil" — kullanıcı kendi `User` kaydını + bağlı
   `Favorite`/`FavoriteList` kayıtlarını silebilir).

**Kapsam DIŞI:** KVKK metninin gerçek yayına alınması (bu, Plan 4e'nin Faz D'sine bağlı — metin
gerçek kullanıcı verisi toplanmadan önce prod'da olmalı, ama "prod" Plan 4e'nin provisioning'i
bitmeden yok). Yani bu plan metni YAZAR, Plan 4e onu YAYINA ALIR.

## 2. Bileşenler

### 2.1 KVKK metni
- Aydınlatma metni: hangi veri toplanıyor (email, favori listeleri, `AnalyticsEvent` kayıtları —
  konum HARİÇ, NFR-04/ADR 004 gereği konum hiç saklanmıyor, yalnızca sorgu parametresi — bu ayrım
  metinde açıkça yazılmalı), toplama amacı, saklama süresi, üçüncü taraflarla paylaşım (yok —
  Google Places API'ye yalnızca deep-link, veri gönderilmiyor; event-capture kendi tablomuzda,
  üçüncü tarafa gitmiyor).
- Açık rıza akışı: kayıt formunda checkbox + metne link (`auth-form.tsx`'e eklenir, zod şemasında
  zorunlu `acceptedPrivacyPolicy: z.literal(true)` gibi bir alan).
- Veri saklama/silme politikası: §2.3'teki hesap silme akışına referans verir.
- Statik bir sayfa olarak yayınlanır (`apps/web/src/app/gizlilik/page.tsx` gibi — mevcut Next.js
  App Router konvansiyonuna uyar).

### 2.2 Event-capture
- Yeni Prisma modeli `AnalyticsEvent` (id, userId nullable — anonim kullanıcı da olabilir, type,
  venueId nullable, createdAt). Migration + repository katmanı (ADR 002 kapsamına girmiyor çünkü
  PostGIS/raw SQL değil, normal Prisma CRUD — ama yine de `*.repository.ts` konvansiyonuna uyar,
  proje genelinde tutarlılık için).
- 3 event tipi (Pilot Karar Sözleşmesi'nin "karar eylemi" tanımına birebir): `MAPS_CLICK`,
  `FAVORITE_ADD`, `SHARE_CLICK`.
- Event noktaları (mevcut bileşenlere ekleme, yeni bileşen değil):
  - `venue-detail.tsx`'teki "buraya nasıl giderim" deep-link → `MAPS_CLICK`.
  - `favorite-button.tsx`'in var olan ekleme akışı → `FAVORITE_ADD` (yalnızca ekleme, çıkarma
    "karar eylemi" sayılmıyor — Pilot Karar Sözleşmesi'nin tanımı bu şekilde okunuyor, **açık
    varsayım, kullanıcı onaylamalı**).
  - `whatsapp-share-button.tsx` (+ Plan 4c'nin platform share sheet genişletmesi) → `SHARE_CLICK`.
- Event gönderimi: istemciden API'ye küçük bir `POST /v1/analytics/events` ucu, rate-limited
  (mevcut `RateLimitGuard`/`CacheStore` deseniyle — event spam'ini önlemek için, `RATE_LIMIT_*`
  env konvansiyonuna uyar).
- 4. hafta geri dönüş kohortu: `User.createdAt` + `AnalyticsEvent`'teki en son event zaman damgası
  arasında bir sorgu; admin panelde yeni bir "Pilot Metrikleri" sayfası (`data-quality` raporunun
  yanına, aynı desenle — tablo/sayaç, yeni bir chart kütüphanesi eklenmez, YAGNI).

### 2.3 Hesap silme akışı
- Yeni endpoint: `DELETE /v1/me` (authenticated) — Prisma `$transaction` içinde: kullanıcının
  `FavoriteList`/`Favorite` kayıtlarını sil, sonra `User` kaydını sil. Supabase Auth tarafındaki
  kullanıcı (asıl kimlik doğrulama kaydı) BU planın kapsamında silinmiyor mu, siliniyor mu —
  **açık soru (§4)**: Supabase Admin API ile `auth.users`'tan da silmek "gerçek" bir hesap silme,
  yalnızca Prisma `User`'ı silmek "uygulama verisini" siler ama kullanıcı hâlâ tekrar giriş
  yapabilir (yeni bir `User` kaydı otomatik oluşur, Plan 4e'nin auth-sync hook'u sayesinde).
- Web tarafı: profil/ayarlar sayfasında "Hesabımı sil" butonu + onay modalı (yanlışlıkla tıklamayı
  önlemek için bir "yazarak onayla" veya iki adımlı confirm — mevcut UI kütüphanesi/deseniyle,
  yeni bir modal kütüphanesi eklenmez).
- **Admin panelinden görünürlük** (kullanıcının açık talebi: "kullanıcıların hesaplarını silip
  silemediğini görebilelim") — admin panelde silinen hesap sayısı/tarihi görülebilir bir kayıt
  gerekiyor. Bu, `User` kaydını FİZİKSEL silmek yerine bir `deletedAt` (soft-delete) alanı mı,
  yoksa fiziksel silip ayrı bir `AccountDeletionLog` (yalnızca "ne zaman, hangi userId — PII
  içermeyen") tablosu mu tutmak arasında bir tasarım kararı gerektiriyor. **Açık soru (§4).**

## 3. Test stratejisi

Normal TDD, `subagent-driven-development` ile tam uyumlu:
- `AnalyticsEvent` repository/service: gerçek test-Postgres'e karşı unit/integration test.
- `POST /v1/analytics/events` ucu: e2e test (rate-limit davranışı dahil, mevcut e2e desenine uyar).
- `DELETE /v1/me`: e2e test — kullanıcı sil, bağlı `Favorite`/`FavoriteList` kayıtlarının da
  silindiğini doğrula (transaction atomikliği), soft-delete/log kararına göre ilgili tablo/alanı
  doğrula.
- KVKK sayfası: statik içerik, birim testi gerekmez, self-review yeterli.
- Web tarafı (checkbox, "hesabımı sil" butonu): Vitest component testleri, mevcut
  `auth-form.spec.tsx`/`favorite-button.spec.tsx` konvansiyonlarına uyar.

## 4. Açık sorular (kullanıcı onayı gerekiyor, `idea-red-team`'den önce)

1. **Hesap silme: Supabase Auth kaydı da silinsin mi, yoksa yalnızca Prisma `User`?** Yalnızca
   Prisma silinirse kullanıcı teknik olarak "hesabını silmiş" olmuyor, tekrar login olabiliyor —
   gerçek bir "hesabımı sil" beklentisini karşılamayabilir. Ama Supabase Admin API'sinden silmek
   ekstra bir entegrasyon (service-role anahtarı, admin API çağrısı) gerektiriyor.
2. **Silinen hesapların admin'de görünürlüğü: soft-delete (`deletedAt` alanı) mı, ayrı bir
   PII-içermeyen log tablosu mu?** Soft-delete daha basit ama "silinmiş" veriyi DB'de tutmaya
   devam eder (KVKK'nın "silme" talebiyle gerçekte çelişebilir mi, tartışmalı). Ayrı log tablosu
   KVKK'ya daha sadık (gerçek veri silinir, yalnızca "böyle bir olay oldu" kaydı kalır) ama ekstra
   bir tablo/model.
3. **`FAVORITE_ADD` favoriden çıkarma da "karar eylemi" sayılmalı mı?** Pilot Karar Sözleşmesi'nin
   metnini birebir okursam sadece "kaydetme" diyor, çıkarma bir geri alma — ekleme yeterli
   görünüyor ama teyit edilmeli.
4. **Event-capture'ın anonim (giriş yapmamış) kullanıcı için de çalışması gerekiyor mu?** Favoriler
   zaten hesap gerektiriyor (AK-02 kararı: (a) anonim gezinme, katkı için hesap), ama `MAPS_CLICK`/
   `SHARE_CLICK` hesap olmadan da tetiklenebilir bir eylem — bunları oturum olmadan (anonim, örn.
   bir cihaz-local id ile) da yakalamak Pilot Karar Sözleşmesi'nin "kullanıcıların ≥%25'i" oranını
   daha doğru ölçer mi, yoksa yalnızca giriş yapmış kullanıcılar mı sayılmalı?

## 5. Bağımlılık

Bu planın KODU Plan 4e'den (provisioning) bağımsız yazılabilir/test edilebilir. Ama KVKK metninin
gerçek YAYINA ALINMASI ve event-capture'ın gerçek trafiğe AÇILMASI, Plan 4e'nin provisioning'i
(gerçek prod ortamı) tamamlanmadan anlamsız — bu yüzden bu plan "tamamlandı" (kod+test yeşil) olsa
bile, "devrede" olması Plan 4e'nin bitmesini bekler. Bu, iki planın aynı anda `idea-red-team`'e
gitmesini engellemiyor (kod bağımsız yazılabilir) ama final "pilot başlıyor" kararının her iki
planın da bitmesini beklediğini netleştiriyor.
