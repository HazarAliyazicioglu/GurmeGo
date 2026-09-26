# GurmeGo — Rule Engine

**Versiyon:** 1.3 (2026-09-26: §5/§6 kullanıcı katkısı akışları eklendiği için güncellendi) · **Önceki:** 1.2 (round 3 panel + Codex koşullu-GO sonrası revize, 2026-07-24)

Tüm kurallar deterministik/kod tabanlı; AI karar vermez. Eşikler config'te (`RULES_*` env / ayarlar tablosu) — ayar değişikliği deploy gerektirmez.

İlgili: [prd.md](prd.md) · [architecture.md](architecture.md) · [docs/CHANGELOG.md](CHANGELOG.md)

**Not (2026-07-24, hâlâ geçerli):** Gurme Puanı (§3, §4) Faz 2'ye ertelendi — MVP'de bu kurallar
kodda yer almaz, yalnızca referans olarak saklanır. Bu, "Codex kotası dönene kadar" gibi geçici bir
erteleme değil, kalıcı bir ürün/kapsam kararı — DB'de oy/rating modeli hiç yok, üç istemcide de oy
verme UI'ı hiç yok. Yeniden açılması ayrı bir brainstorming + idea-red-team gerektirir.

**Güncelleme (2026-09-26):** §5/§6'daki "Faz 2'de eklenecek" listesi MVP'de kısmen açıldı — "yeni
mekan önerisi" ve "düzeltme önerisi" artık kodda var (aşağıda işaretli). §3/§4 (Gurme Puanı) hâlâ
tamamen kapalı.

---

## 1. "Butik" Tanım Kuralları (FR-MV-04)

**Tanım (revize 2026-07-16):** "Butik", Codex red-team'in "kullanıcı için anlamsız, keyfi DB kuralı"
eleştirisi üzerine netleşti. Artık salt bir şube-sayısı eşiği değil, **gerçek dünyada tanınabilir bir
kategori**: Burger King, McDonald's, Starbucks, Kahve Dünyası, Simit Sarayı gibi **çok şubeli
zincirlerin karşıtı** — Instagram/TikTok'ta "mekan önerisi" olarak paylaşılan, en fazla 2-3 şubeli
yerler. Şube sayısı eşiği bu tanımı **uygulamak** için kullanılan bir kod kuralı, tanımın kendisi değil.

Bir mekan `is_boutique = true` olur ⟺ tüm koşullar sağlanır:

| # | Kural | Config | Başlangıç |
|---|---|---|---|
| B1 | Şube sayısı ≤ eşik | `RULES_BOUTIQUE_MAX_BRANCHES` | **3** *(revize 2026-07-16: "en fazla 2-3 şube" tanımına göre 4'ten indirildi; veriyle ayarlanabilir, tek config değişikliği)* |
| B2 | Franchise/zincir markası değil | `franchise_flag = false` (kürasyon girer) | — |
| B3 | Kürasyon onayı: editöryal not girilmiş ve `status = published` | — | — |

- Eşiği aşan mekan otomatik dışlanmaz; `is_boutique = false` ile **ayrı kategoride** kalabilir (kürasyon kararı).
- `branch_count` ve `franchise_flag` kürasyon ekibi tarafından girilir/doğrulanır; değişince kural yeniden değerlendirilir (DB trigger veya service hook).
- Sınır durumları (ör. hızlı büyüyen 3 şubeli bir marka) kürasyon ekibinin editöryal takdirine bırakılır — B3 (editöryal not) bu yüzden zorunlu, salt sayısal kural yeterli değil.

## 2. Veri Güncellik Kuralları (FR-MV-03)

- **N = 90 gün** (`RULES_STALE_DAYS`). Gerekçe: fiyat/menü verisi TR koşullarında ~3 ayda bayatlar; pilot
  kapsamı 30-45 mekan ([prd.md §5](prd.md) Pilot Karar Sözleşmesi) → 6 haftalık pilot süresinde re-verify
  yükü pratikte oluşmaz, Faz 2'de mekan sayısı artınca devreye girer.
- Günlük cron: `verified_at < now() - 90 gün` olan yayınlanmış kayıtlar için ContributionQueue'ya `re_verify` görevi açılır (mevcut açık görev varsa çift açılmaz).
- Bayat kayıt yayında kalır ama detay sayfasında güncellik damgası gösterilir (FR-MD-04) — kullanıcı "son doğrulama: X" görür.
- Onaylanan her kürasyon işlemi `verified_at`'i günceller.

## 3. Gurme Puanı Hesaplama (FR-GP-03) — Faz 2, MVP'de yok

**Oy verme (UX):** basit 1-5 tam yıldız. Kullanıcı tek dokunuşla puan verir; başka girdi yok.

**Gösterilen skor (hesap):** Bayesian ağırlıklı ortalama — az oylu mekanın uç değer göstermesini engeller (3 oyla 5.0 görünmez). Kullanıcıya formül değil sadece skor + oy sayısı gösterilir.

```
gourmet_score = (C × m + Σ(oy_i × w_i)) / (C + Σ w_i)
```

| Parametre | Anlam | Config | Başlangıç |
|---|---|---|---|
| C | öncelik gücü (sanal oy sayısı) | `RULES_GS_PRIOR_COUNT` | 10 |
| m | öncelik ortalaması | `RULES_GS_PRIOR_MEAN` | 3.5 |
| w_i | oy sahibinin rol ağırlığı | rol tablosu | user: 1.0 · approved_rater: 3.0 · curator: 5.0 |

- Rol ağırlıkları **AK-01 açık kararını** destekler: (a) onaylı-only seçilirse `user` ağırlığı 0 yapılır; (b) herkes seçilirse tablo olduğu gibi; (c) ekip-only seçilirse yalnızca curator > 0. Şema/kod değişikliği yok.
- Skor `numeric(2,1)` olarak Venue'ye denormalize yazılır (her yeni/güncellenen oyda yeniden hesap); listeleme sorguları ek join yapmaz.
- Zaman azalımı (eski oyların ağırlığının düşmesi) **Faz 2** adayı; formüle `w_i × decay(t)` çarpanı olarak eklenebilir.
- Minimum gösterim eşiği: `Σ w_i < 3` ise skor yerine "yeni" rozeti (`RULES_GS_MIN_WEIGHT`).

## 4. Puanlama Bütünlüğü (FR-GP-04, NFR-10) — Faz 2, MVP'de yok

- Unique(user_id, venue_id) — tek kullanıcı-tek mekan-tek puan; tekrar oy = güncelleme (PUT upsert).
- Her oy `created_at/updated_at` ile izlenebilir; kim, ne zaman, hangi mekan.
- **Anomali raporu** (`/admin/reports/rating-anomalies`) şu desenleri işaretler:
  - Aynı mekana kısa aralıkta (< 24 saat) anormal oy yığılması (eşik: mekan ortalama günlük oyunun 5 katı)
  - Yeni hesapların (< 7 gün) tek mekana yoğunlaşan oyları
  - Hep 5 veya hep 1 veren, mekan çeşitliliği düşük kullanıcılar
- Rapor işaretler, otomatik silmez — karar kürasyon ekibinin (NFR-01 ruhu: doğruluk > otomasyon).

## 5. Moderasyon Kuralları (FR-KG-03, NFR-07) — revize 2026-07-24 (MVP'de yorum yok)

- **Rate limit** değerleri (MVP): [api-spec.md §6](api-spec.md) — yalnızca "bilgi yanlış" bildirimi
  (10/gün, IP bazlı, kimlik gerektirmez). Yorum (5/saat) ve Gurme Puanı (20/gün) limitleri **Faz 2**,
  o modüller açılınca aktive olur. Öneri/düzeltme 10/gün limiti Faz 2'de kullanıcı katkısı açılınca
  aktive olur; NL arama 30/gün limiti Faz 2'te.
- **Bilgi yanlış bildirimi akışı (MVP):** herhangi bir ziyaretçi mekan sayfasından "bu bilgi yanlış"
  bildirir → `ContributionQueue` (`REPORT` tipi) → moderasyon kuyruğu. Şikayet eşiği: aynı mekana ≥3
  farklı bildirim gelirse mekan kürasyon kuyruğuna **"acil"** etiketiyle düşer (`RULES_MOD_AUTO_HIDE_REPORTS = 3`,
  isim korunuyor ama davranışı değişti: MVP'de bir şeyi otomatik *gizlemez* — mekan yayında kalır,
  yalnızca kürasyon ekibine önceliklendirilmiş inceleme sinyali gönderir; içerik anonim olduğu için
  otomatik gizleme yanlış pozitif riski taşırdı).
- **Düzeltme önerisi (MVP, 2026-09-26'da açıldı):** bildirim gönderirken opsiyonel olarak "hangi
  bilgi" + "doğrusu ne olmalı" alanları doldurulabilir (`CreateReportSchema.field`/`suggestedValue`,
  `packages/shared`). Kasıtlı olarak ayrı bir `ContributionType` DEĞİL, aynı `REPORT` satırının
  payload'ında taşınıyor — `EDIT` tipini kullanmak, approve(EDIT)'in otomatik `verifiedAt`
  güncellemesiyle ve venue-başına-tek-PENDING-EDIT unique index'iyle (re_verify cron'u için) çakışırdı.
  Kürasyon ekibi öneriyi görüp gerçek düzeltmeyi kendi elleriyle `AdminVenuesService.update()` ile
  uygular; onaylamak Venue'ye otomatik yazmaz.
- **Yeni mekan önerisi (MVP, 2026-09-26'da açıldı):** herhangi bir ziyaretçi `/mekan-oner` (web)
  üzerinden isim/ilçe/kategori/adres/not girerek yeni bir mekan önerebilir → `ContributionQueue`
  (`NEW_VENUE` tipi, `venueId: null`) → admin kuyruğunda ayrı bir "Yeni mekan önerileri" sekmesi.
  Onaylamak yalnızca öneriyi incelendi olarak işaretler, **Venue kaydını otomatik oluşturmaz** —
  kürasyon ekibi mekanı CSV import veya Prisma Studio ile kendi ekler (bu panelde manuel mekan
  oluşturma UI'ı yok, bilinçli kapsam kararı, §6'daki EDIT/NEW_VENUE için de geçerli).
- Yeni hesap kısıtı (`RULES_NEW_ACCOUNT_HOURS = 24`) ve otomatik spam filtresi (içerik analizi): **Faz 2**
  — MVP'de bildirim kimliksiz olduğu için hesap yaşına dayalı kısıt uygulanamaz.

## 6. Kürasyon Kuyruğu Öncelik Kuralları

Kuyruk sıralaması (FR-AP-01):

**MVP** (kodda gerçekten böyle sıralanıyor, `admin-queue.service.ts`'nin `tierOf()`'u):
1. "Acil" etiketli REPORT'lar (≥3 bildirim, bkz. §5)
2. `re_verify` görevleri (90 gün)
3. Diğer her şey — düzeltme önerileri (REPORT + field/suggestedValue) ve yeni mekan önerileri
   (NEW_VENUE) dahil, aralarında ayrı bir öncelik sırası YOK (hepsi `createdAt asc`). Admin panelinde
   REPORT ve NEW_VENUE ayrı sekmelerde gösteriliyor (kuyruk sayfası tek seferde tek tipi çekiyor),
   bu üçüncü tier o yüzden şu an pratikte gözlemlenmiyor — ileride tek bir birleşik görünüm
   eklenirse devreye girer.

**Faz 2'de eklenecek** (mekan-sahibi-girişi + mekan-sahibi-doğrulama açılınca — "yeni mekan önerisi"
ve "düzeltme önerisi" artık burada değil, MVP'ye taşındı, bkz. §5):
4. Mekan sahibi doğrulama/itiraz talepleri (`OWNER_VERIFICATION`)

Hedef SLA: öneri → karar ≤ 72 saat (başarı metriği, [prd.md §5](prd.md)).
