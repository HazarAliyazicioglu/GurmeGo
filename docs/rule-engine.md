# GurmeGo — Rule Engine

**Versiyon:** 1.1 (red-team sonrası revize) · **Tarih:** 2026-07-16

Tüm kurallar deterministik/kod tabanlı; AI karar vermez. Eşikler config'te (`RULES_*` env / ayarlar tablosu) — ayar değişikliği deploy gerektirmez.

İlgili: [prd.md](prd.md) · [architecture.md](architecture.md) · [docs/CHANGELOG.md](CHANGELOG.md)

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

- **N = 90 gün** (`RULES_STALE_DAYS`). Gerekçe: fiyat/menü verisi TR koşullarında ~3 ayda bayatlar; 3 ilçe × ~75 mekan → ayda ~75 re-verify, küçük ekiple sürdürülebilir.
- Günlük cron: `verified_at < now() - 90 gün` olan yayınlanmış kayıtlar için ContributionQueue'ya `re_verify` görevi açılır (mevcut açık görev varsa çift açılmaz).
- Bayat kayıt yayında kalır ama detay sayfasında güncellik damgası gösterilir (FR-MD-04) — kullanıcı "son doğrulama: X" görür.
- Onaylanan her kürasyon işlemi `verified_at`'i günceller.

## 3. Gurme Puanı Hesaplama (FR-GP-03)

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

## 4. Puanlama Bütünlüğü (FR-GP-04, NFR-10)

- Unique(user_id, venue_id) — tek kullanıcı-tek mekan-tek puan; tekrar oy = güncelleme (PUT upsert).
- Her oy `created_at/updated_at` ile izlenebilir; kim, ne zaman, hangi mekan.
- **Anomali raporu** (`/admin/reports/rating-anomalies`) şu desenleri işaretler:
  - Aynı mekana kısa aralıkta (< 24 saat) anormal oy yığılması (eşik: mekan ortalama günlük oyunun 5 katı)
  - Yeni hesapların (< 7 gün) tek mekana yoğunlaşan oyları
  - Hep 5 veya hep 1 veren, mekan çeşitliliği düşük kullanıcılar
- Rapor işaretler, otomatik silmez — karar kürasyon ekibinin (NFR-01 ruhu: doğruluk > otomasyon).

## 5. Moderasyon Kuralları (FR-KG-03, NFR-07)

- **Rate limit** değerleri (MVP): [api-spec.md §6](api-spec.md) (yorum 5/saat, puan 20/gün). Öneri/düzeltme
  10/gün limiti Faz 2'de kullanıcı katkısı açılınca aktive olur; NL arama 30/gün limiti Faz 3'te.
- Yorum akışı: anında yayın → şikayet → moderasyon kuyruğu → curator kararı (kaldır/tut). Şikayet eşiği: aynı yoruma ≥3 farklı kullanıcı şikayeti → yorum otomatik gizlenir, kuyruğa "acil" etiketiyle düşer (`RULES_MOD_AUTO_HIDE_REPORTS = 3`).
- Yeni hesap kısıtı: kayıttan sonraki 24 saat yorum/puan limiti yarıya iner (`RULES_NEW_ACCOUNT_HOURS = 24`).
- Otomatik spam filtresi (içerik analizi) **Faz 2**.

## 6. Kürasyon Kuyruğu Öncelik Kuralları

Kuyruk sıralaması (FR-AP-01):

**MVP** (yalnızca moderasyon şikayeti + re-verify akışta):
1. Otomatik gizlenen yorumlar (acil)
2. `re_verify` görevleri (90 gün)

**Faz 2'de eklenecek** (kullanıcı katkısı + mekan-sahibi-girişi açılınca):
3. "Mekan kapandı" düzeltme önerileri (yanlış açık bilgi = güven kırıcı)
4. Fiyat/favori ürün düzeltmeleri
5. Yeni mekan önerileri

Hedef SLA: öneri → karar ≤ 72 saat (başarı metriği, [prd.md §5](prd.md)).
