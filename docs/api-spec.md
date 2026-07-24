# GurmeGo — API Spec

**Versiyon:** 1.2 (round 3 panel + Codex koşullu-GO sonrası revize) · **Tarih:** 2026-07-24 · **Stil:** REST + OpenAPI 3.1

İlgili: [architecture.md](architecture.md) · [rule-engine.md](rule-engine.md) · [docs/CHANGELOG.md](CHANGELOG.md)

**Not (2026-07-24):** Yorum/puanlama ve Gurme Puanı uçları Faz 2'ye ertelendi (MVP'de yok). Yerine
mekan detayında Google puanı özet rozeti (FR-MD-05) ve kimlik gerektirmeyen genel "bilgi yanlış"
bildirimi (§4) var.

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
| GET | `/venues` | — | Keşif listesi. Filtreler: `district_id, category, cuisine, price_range, open_now, is_boutique, lat, lng, radius_m, sort=distance\|newest` (`sort=gourmet_score` **Faz 2**, MVP'de yok) |
| GET | `/venues/map?bbox=...` | — | Harita görünümü: bbox içi hafif payload (id, name, location, category) — `gourmet_score` **Faz 2** |
| GET | `/search?q=...` | — | **Faz 2, MVP'de yok.** Doğal dil arama (FR-AI-01/02). Yanıt: yapısal sonuç + `interpreted_filters` (LLM çıkarımı şeffaf gösterilir). AI hatasında yapısal fallback (FR-AI-03) |

## 3. Public API — Mekan Detay

| Method | Path | Auth | Açıklama |
|---|---|---|---|
| GET | `/venues/:slug` | — | Tam profil: fiyat aralığı, favori ürünler, ulaşım notu, saatler, fotoğraflar, imzalı editöryal öneri, Google puanı özet rozeti + deep-link, `verified_at` + `source` (FR-MD-01, FR-MD-04, FR-MD-05). `gourmet_score` **Faz 2** |
| GET | `/venues/:id/reviews` | — | **Faz 2, MVP'de yok.** Yorumlar; `sort=helpful\|newest` (FR-MD-02) |
| GET | `/venues/:id/menu` | — | **Faz 2, MVP'de yok.** Kalem + fiyat listesi (tam menü sistemi) |

Yol tarifi (FR-MD-03) ve mekan paylaşımı (FR-MD-06, WhatsApp) istemci tarafı deep link — API ucu
gerekmez; detay yanıtı `location` içerir.

## 4. Public API — Bildirim, Favoriler (MVP) / Yorum, Puan, Katkı (Faz 2)

| Method | Path | Auth | Açıklama |
|---|---|---|---|
| POST | `/venues/:id/report` | — (kimlik gerektirmez) | **MVP.** Genel "bu bilgi yanlış" bildirimi → `ContributionQueue` (`report` tipi), rate limit IP bazlı (FR-KG-03) |
| GET/POST | `/me/lists` · `/me/lists/:id/venues` | `user` | **MVP.** Favori koleksiyonları (FR-KA-04) |
| POST | `/venues/:id/reviews` | `user` | **Faz 2, MVP'de yok.** Yorum + yıldız. Anında yayın, şikayet üzerine inceleme (FR-KG-03) |
| POST | `/reviews/:id/report` | `user` | **Faz 2, MVP'de yok.** Yorum şikayeti → moderasyon kuyruğu |
| PUT | `/venues/:id/gourmet-rating` | `approved_rater` | **Faz 2, MVP'de yok.** Gurme Puanı oyu (1-5). Rol kontrolü AK-01 konfigürasyonuna göre. Unique upsert → tek kullanıcı-tek mekan-tek puan (FR-GP-04) |
| POST | `/venues/:id/owner-verification` | — (tek kullanımlı token) | **Faz 2, MVP'de yok.** Mekan sahibi doğrulama/itiraz akışı |
| POST | `/contributions/venues` | `user` | **Faz 2, MVP'de yok.** Yeni mekan önerisi → ContributionQueue (FR-KG-01) |
| POST | `/venues/:id/contributions` | `user` | **Faz 2, MVP'de yok.** Düzeltme önerisi (fiyat/kapandı) → kuyruk (FR-KG-02) |
| GET | `/me/contributions` | `user` | **Faz 2, MVP'de yok.** Kullanıcının önerileri + durumları |

## 5. Admin API — `/v1/admin/*` (curator/admin role guard)

Tek NestJS app içinde; ayrı servis yok (MVP kararı).

| Method | Path | Açıklama |
|---|---|---|
| GET | `/admin/queue?type=&status=` | Onay kuyruğu: MVP'de yalnızca şikayetler; öneri/düzeltme tipleri Faz 2'de aynı kuyruğa eklenir (FR-AP-01) |
| POST | `/admin/queue/:id/approve` · `/reject` | Onay → Venue'ye uygula + VenueVersion + `verified_at` güncelle |
| POST | `/admin/venues` · PUT `/admin/venues/:id` | Manuel kürasyon CRUD |
| POST | `/admin/venues/:id/revert/:versionId` | Versiyon geri alma (FR-MV-05) |
| POST | `/admin/import` | CSV toplu import (FR-AP-02); satır bazlı hata raporu döner |
| GET | `/admin/reports/data-quality` | İlçe başına mekan, bayat kayıtlar (verified_at > N gün), kaynak dağılımı (FR-AP-03) |
| GET | `/admin/reports/rating-anomalies` | **Faz 2, MVP'de yok.** Şüpheli puanlama desenleri (NFR-10, [rule-engine.md](rule-engine.md)) |
| PUT | `/admin/users/:id/roles` | Rol atama: `curator` (MVP); `approved_rater` **Faz 2** (FR-AP-04) |
| GET | `/admin/export?format=json\|csv` | Mekan verisi export (NFR-06) |

## 6. Rate Limiting

Değerler config'te (`RATE_LIMIT_*` env), başlangıç seti:

| Kapsam | Limit | Anahtar |
|---|---|---|
| Okuma uçları | 100 istek/dk | IP |
| Bilgi yanlış bildirimi (MVP) | 10/gün | IP (kimlik gerektirmez) |
| Yorum yazma (**Faz 2**) | 5/saat | kullanıcı |
| Gurme Puanı (**Faz 2**) | 20/gün | kullanıcı |
| Öneri/düzeltme (**Faz 2**) | 10/gün | kullanıcı |
| NL arama (**Faz 2**, `/search`) | 30/gün | kullanıcı (anonim: 10/gün IP) — AI maliyet disiplini (NFR-05) |

Aşımda `429` + `Retry-After` header. Kural gerekçeleri: [rule-engine.md](rule-engine.md).
