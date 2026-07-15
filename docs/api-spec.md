# GurmeGo — API Spec

**Versiyon:** 1.0 · **Tarih:** 2026-07-06 · **Stil:** REST + OpenAPI 3.1

İlgili: [architecture.md](architecture.md) · [rule-engine.md](rule-engine.md)

---

## 1. Genel İlkeler

- **Base URL:** `https://api.gurmego.app/v1` — versiyon path'te; kırıcı değişiklik = yeni major (`/v2`).
- **Format:** JSON; `Content-Type: application/json`; tarihler ISO 8601 UTC.
- **Auth:** `Authorization: Bearer <supabase-jwt>`. Anonim uçlar token'sız çalışır (AK-02 varsayılanı).
- **OpenAPI:** NestJS decorator'larından üretilir; `packages/api-client` tipleri buradan generate edilir.

### Hata modeli

```json
{
  "error": {
    "code": "VENUE_NOT_FOUND",
    "message": "Mekan bulunamadı",
    "details": {}
  }
}
```

HTTP kodları: 400 validasyon, 401 auth yok, 403 rol yetersiz, 404, 409 çakışma (ör. çift puan), 422 iş kuralı ihlali, 429 rate limit.

### Sayfalama (cursor/keyset)

İstek: `?limit=20&cursor=<opaque>` · Yanıt zarfı:

```json
{ "data": [...], "meta": { "next_cursor": "abc...", "has_more": true } }
```

`cursor` opak base64 (sıralama anahtarı + id). Yeni kayıt eklenince kayma olmaz; NFR-02 hedefiyle uyumlu.

## 2. Public API — Keşif & Arama

| Method | Path | Auth | Açıklama |
|---|---|---|---|
| GET | `/districts?city=istanbul` | — | İlçe listesi (MVP: Kadıköy, Beşiktaş, Beyoğlu) |
| GET | `/districts/nearest?lat&lng` | — | Konumdan ilçe önerisi (FR-KA-01); koordinat loglanmaz (NFR-04) |
| GET | `/venues` | — | Keşif listesi. Filtreler: `district_id, category, cuisine, price_range, open_now, is_boutique, lat, lng, radius_m, sort=distance\|gourmet_score\|newest` |
| GET | `/venues/map?bbox=...` | — | Harita görünümü: bbox içi hafif payload (id, name, location, category, gourmet_score) |
| GET | `/search?q=...` | — | Doğal dil arama (FR-AI-01/02). Yanıt: yapısal sonuç + `interpreted_filters` (LLM çıkarımı şeffaf gösterilir). AI hatasında yapısal fallback (FR-AI-03) |

## 3. Public API — Mekan Detay

| Method | Path | Auth | Açıklama |
|---|---|---|---|
| GET | `/venues/:slug` | — | Tam profil: menü, fiyat aralığı, ulaşım notu, saatler, fotoğraflar, gourmet_score, `verified_at` + `source` (FR-MD-04) |
| GET | `/venues/:id/reviews` | — | Yorumlar; `sort=helpful\|newest` (FR-MD-02) |
| GET | `/venues/:id/menu` | — | Kalem + fiyat listesi |

Yol tarifi (FR-MD-03) istemci tarafı deep link — API ucu gerekmez; detay yanıtı `location` içerir.

## 4. Public API — Katkı, Yorum, Puan, Favoriler

Hepsi `user` rolü ister (AK-02: katkı için hesap).

| Method | Path | Açıklama |
|---|---|---|
| POST | `/venues/:id/reviews` | Yorum + yıldız. Anında yayın, şikayet üzerine inceleme (FR-KG-03) |
| POST | `/reviews/:id/report` | Şikayet → moderasyon kuyruğu |
| PUT | `/venues/:id/gourmet-rating` | Gurme Puanı oyu (1-5). Rol kontrolü AK-01 konfigürasyonuna göre (`approved_rater` gerekebilir). Unique upsert → tek kullanıcı-tek mekan-tek puan (FR-GP-04) |
| POST | `/contributions/venues` | Yeni mekan önerisi → ContributionQueue (FR-KG-01) |
| POST | `/venues/:id/contributions` | Düzeltme önerisi (fiyat/menü/kapandı) → kuyruk (FR-KG-02) |
| GET/POST | `/me/lists` · `/me/lists/:id/venues` | Favori koleksiyonları (FR-KA-04) |
| GET | `/me/contributions` | Kullanıcının önerileri + durumları |

## 5. Admin API — `/v1/admin/*` (curator/admin role guard)

Tek NestJS app içinde; ayrı servis yok (MVP kararı).

| Method | Path | Açıklama |
|---|---|---|
| GET | `/admin/queue?type=&status=` | Onay kuyruğu: öneriler + düzeltmeler + şikayetler tek yerde (FR-AP-01) |
| POST | `/admin/queue/:id/approve` · `/reject` | Onay → Venue'ye uygula + VenueVersion + `verified_at` güncelle |
| POST | `/admin/venues` · PUT `/admin/venues/:id` | Manuel kürasyon CRUD |
| POST | `/admin/venues/:id/revert/:versionId` | Versiyon geri alma (FR-MV-05) |
| POST | `/admin/import` | CSV toplu import (FR-AP-02); satır bazlı hata raporu döner |
| GET | `/admin/reports/data-quality` | İlçe başına mekan, bayat kayıtlar (verified_at > N gün), kaynak dağılımı (FR-AP-03) |
| GET | `/admin/reports/rating-anomalies` | Şüpheli puanlama desenleri (NFR-10, [rule-engine.md](rule-engine.md)) |
| PUT | `/admin/users/:id/roles` | Rol atama: `approved_rater`, `curator` (FR-AP-04) |
| GET | `/admin/export?format=json\|csv` | Mekan verisi export (NFR-06) |

## 6. Rate Limiting

Değerler config'te (`RATE_LIMIT_*` env), başlangıç seti:

| Kapsam | Limit | Anahtar |
|---|---|---|
| Okuma uçları | 100 istek/dk | IP |
| Yorum yazma | 5/saat | kullanıcı |
| Gurme Puanı | 20/gün | kullanıcı |
| Öneri/düzeltme | 10/gün | kullanıcı |
| NL arama (`/search`) | 30/gün | kullanıcı (anonim: 10/gün IP) — AI maliyet disiplini (NFR-05) |

Aşımda `429` + `Retry-After` header. Kural gerekçeleri: [rule-engine.md](rule-engine.md).
