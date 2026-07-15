# GurmeGo — Architecture

**Versiyon:** 1.1 (red-team sonrası revize) · **Tarih:** 2026-07-16

İlgili: [prd.md](prd.md) · [api-spec.md](api-spec.md) · [infrastructure.md](infrastructure.md) · [docs/CHANGELOG.md](CHANGELOG.md)

**Not:** pgvector/semantic search MVP'den çıkarılıp Faz 3'e alındı (bkz. [docs/CHANGELOG.md](CHANGELOG.md)
2026-07-16 madde 9). Bu dokümanda pgvector/embedding'e dair maddeler Faz 3 olarak işaretlendi, MVP
mimarisinden çıkarılmadı — çünkü extension'ı migration'a baştan eklemek (kullanmadan) ileride şema
değişikliği gerektirmiyor; asıl maliyet olan LLM çağrısı + embedding pipeline'ı MVP'de kurulmuyor.

---

## 1. Stack Kararları

| Katman | Seçim | Gerekçe |
|---|---|---|
| Backend | **NestJS (Node.js + TypeScript)** | Module/DI/guard yapısı; public API + admin + rol bazlı yetki için uygun; Fastify adapter ile performans |
| Veritabanı | **PostgreSQL + PostGIS** | Coğrafi veri çekirdek varlık; ilçe sınırı + yakınlık sorguları DB seviyesinde |
| Semantic index | **pgvector** (aynı Postgres) — **Faz 3, MVP'de kurulmaz** | Extension migration'a eklenir (şema hazır) ama embedding pipeline/LLM çağrısı MVP'de yok; maliyet + operasyon sadeliği (NFR-05) |
| Mobil | **React Native** | iOS + Android tek kod tabanı; ana deneyim |
| Web | **Next.js (SSR/SSG)** | Mekan sayfaları SEO indekslenebilir (FR-MW-03) |
| Admin panel | **Next.js (ayrı app, CSR yeterli)** | İç ekip aracı; SEO gereksiz |
| Auth | **Supabase Auth** | E-posta + Google/Apple hazır; Postgres stack'le uyumlu; hızlı MVP |
| API stili | **REST + OpenAPI** | Cache dostu, SSR uyumlu; OpenAPI'den istemci tipleri üretilir |
| Repo | **Monorepo (pnpm workspace + Turborepo)** | API ↔ istemci tip paylaşımı |

## 2. Sistem Diyagramı

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│ RN Mobile   │  │ Next.js Web│  │ Next.js    │
│ (iOS/And.)  │  │ (SSR/SSG)  │  │ Admin      │
└──────┬─────┘  └──────┬─────┘  └──────┬─────┘
       │               │               │
       └───────────────┼───────────────┘
                       ▼
              ┌─────────────────┐        ┌──────────────┐
              │  NestJS API      │◄──────►│ Supabase Auth│
              │  (REST/OpenAPI)  │        └──────────────┘
              │                  │        ┌──────────────┐
              │  - Discovery     │ · · · ▶│ LLM API      │ (Faz 3, MVP'de yok)
              │  - Venue         │        │ (NL search)  │
              │  - Moderation    │        └──────────────┘
              │  - GourmetScore  │
              │  - Curation(adm) │
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │ PostgreSQL       │
              │ + PostGIS        │  ← coğrafi sorgular (MVP)
              │ + pgvector       │  ← semantic search (Faz 3, extension kurulu ama kullanılmıyor)
              └─────────────────┘
```

## 3. Monorepo Yapısı

```
gurmego/
├─ apps/
│  ├─ api/        # NestJS
│  ├─ mobile/     # React Native (Expo önerilir)
│  ├─ web/        # Next.js tüketici web
│  └─ admin/      # Next.js kürasyon paneli
├─ packages/
│  ├─ shared/     # ortak tipler, zod şemaları, sabitler
│  └─ api-client/ # OpenAPI'den üretilen tip güvenli istemci
└─ docs/
```

İş mantığı yalnızca `apps/api`'de; istemciler tekrar etmez (PRD teknik karar #2).

## 4. Veri Modeli (ER özeti)

```
City (1) ──< District (1) ──< Venue
Venue (1) ──< MenuItem        # Faz 2 (kalem+fiyat tam menü sistemi); MVP'de yok
Venue (1) ──< Photo
Venue (1) ──< Review          # standart yorum + yıldız
Venue (1) ──< GourmetRating   # Gurme Puanı oyları (rol ağırlıklı)
Venue (1) ──< VenueVersion    # versiyonlama (FR-MV-05)
Venue (1) ──< MediaRef        # Faz 2 Reels için esneklik
User  (1) ──< Review, GourmetRating, Contribution, Favorite
User  (1) ──< FavoriteList (koleksiyon) ──< Favorite >── Venue
ContributionQueue: MVP'de yalnızca moderasyon şikayeti; yeni mekan önerisi + düzeltme önerisi tipleri
                   Faz 2'de aktive olur (şema baştan hazır, `type` enum'unda duruyor)
Tag/Collection: mekanlara dış etiket — ileri faz influencer listeleri için esneklik (FR-IL-03)
```

### Kritik alanlar

**Venue (revize 2026-07-16 — bkz. [docs/CHANGELOG.md](CHANGELOG.md) madde 3):**
| Alan | Tip | Not |
|---|---|---|
| id | uuid | |
| name, slug | text | slug → SEO URL |
| district_id | fk | şehir/ilçe birinci sınıf boyut (NFR-03) |
| location | geography(Point) | PostGIS; GIST index |
| category, cuisine_type | enum/text | |
| price_range | enum (₺..₺₺₺₺) | MVP'de menü yerine tek fiyat sinyali (FR-MV-01) |
| signature_items | text[] | **yeni** — "favori ürünler" (FR-MV-01); tam menü sistemi (MenuItem) Faz 2 |
| transport_note | text | ulaşım (FR-MV-01) |
| opening_hours | jsonb | gün bazlı |
| editorial_note | text | kürasyon notu; Faz 3'te embedding kaynağı olacak |
| is_boutique | boolean | rule-engine hesaplar (FR-MV-04) — artık gerçek dünya tanınırlığına dayalı tanım |
| branch_count | int | butik kuralı girdisi |
| source | enum: manual/user/auto | MVP'de her zaman `manual` (FR-MV-02); `user` Faz 2, `auto` Faz 2+ |
| verified_at | timestamptz | güncellik damgası (FR-MV-03) |
| status | enum: draft/published/archived | |
| gourmet_score | numeric(2,1) | denormalize; rule-engine yazar |
| featured | boolean | gelir modeli esnekliği (NFR-08); MVP'de hep false |
| embedding | vector | **Faz 3** — pgvector; editorial_note + özet. Kolon migration'da var ama MVP'de hiç yazılmaz |

**GourmetRating:** user_id, venue_id, score (1-5), weight (rol bazlı — AK-01 hangi yönde çözülürse çözülsün destekler), created_at. Unique(user_id, venue_id) → tek kullanıcı-tek mekan-tek puan (FR-GP-04).

**ContributionQueue:** id, type (new_venue/edit/report), payload (jsonb), submitted_by, status (pending/approved/rejected), reviewed_by, reviewed_at. MVP'de yalnızca `report` tipi aktif akışta kullanılır (moderasyon şikayeti, FR-KG-03); `new_venue`/`edit` tipleri Faz 2'de kullanıcı katkısı ve mekan-sahibi-girişi açılınca devreye girer — onaysız yayın yok kuralı (PRD teknik karar #3) o zaman da geçerli.

## 5. Kürasyon Kuyruğu Akışı

**MVP'de** kürasyon ekibi mekanları doğrudan admin panelden girer/günceller (FR-AP-02 CSV import +
manuel CRUD); `ContributionQueue`'ya yalnızca **şikayetler** düşer. Kullanıcı önerisi/düzeltme akışı
Faz 2'de aktive olur (aşağıdaki diyagramdaki ilk iki dal).

```
Kullanıcı önerisi ──┐  (Faz 2)
Düzeltme önerisi ───┼──► ContributionQueue (pending)
Şikayet ────────────┘         │              (MVP'de yalnızca bu dal aktif)
                              ▼
                    Admin panel inceleme
                    ├─ approve → Venue'ye uygula + VenueVersion kaydet + verified_at güncelle
                    └─ reject  → gerekçeyle kapat
Cron: verified_at > N gün ──► kürasyon kuyruğuna "re-verify" görevi (FR-MV-03)
```

## 6. Arama Katmanı — MVP'de tek parçalı, Faz 3'te iki parçalı olacak

**MVP:** yalnızca **yapısal** arama. Kategori, fiyat, ilçe, açık/kapalı, mesafe → doğrudan SQL +
PostGIS (`ST_DWithin`, `ST_Distance` sıralama). Hedef < 300 ms (NFR-02): district_id + GIST index'ler,
keyset pagination. Serbest metin arama kutusu yok.

**Faz 3 (planlı, MVP'de yok):** Semantic katman eklenecek — doğal dil sorgu → LLM ile yapısal filtre
çıkarımı (FR-AI-01) + pgvector benzerlik (FR-AI-02). Sonuç yapısal filtrelerle AND'lenecek. Eklendiğinde
de AI kapalıyken yapısal arama tam çalışır invariant'ı (FR-AI-03) korunacak. Tasarım detayı saklanıyor:
[ai-prompt-design.md](ai-prompt-design.md).

## 7. Auth & Yetkilendirme

- **Supabase Auth:** e-posta + Google/Apple. JWT'yi NestJS guard doğrular (JWKS).
- **Roller:** `anonymous` (keşif/arama/detay — AK-02 varsayılanı), `user` (favori, yorum, şikayet; öneri/düzeltme Faz 2'de eklenir), `approved_rater` (Gurme Puanı — AK-01 kararına göre atama), `curator` (admin panel), `admin`.
- Rol → yetki eşlemesi DB'de tutulur; AK-01/AK-02 kararları **konfigürasyon değişikliğiyle** uygulanır, kod/şema değişikliği gerektirmez.
- Konum gizliliği (NFR-04): kullanıcı koordinatı loglanmaz, yalnızca sorgu parametresi olarak kullanılır, kalıcı saklanmaz.

## 8. Kesitsel Konular

- **Versiyonlama:** Venue yazma işlemleri VenueVersion'a snapshot; geri alma = eski snapshot'ı uygula (FR-MV-05).
- **Export:** `pnpm export:venues` → JSON/CSV (NFR-06); admin panelden de tetiklenebilir.
- **Rate limiting:** API gateway seviyesinde IP bazlı + kullanıcı bazlı (yorum/puan/öneri uçları sıkı) — [api-spec.md](api-spec.md).
- **Cache:** keşif listeleri kısa TTL (60 sn) HTTP cache; mekan detay ETag. (NL arama cache'i Faz 3'te eklenecek, bkz. NFR-05.)
