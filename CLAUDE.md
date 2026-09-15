# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@docs/STATE.md

## Proje durumu

Kod var ve aktif geliştiriliyor — `apps/api` (NestJS), `apps/web`, `apps/admin` (Next.js), `apps/mobile` (Expo/React Native) hepsi `master`'da, gerçek bir CI hattı (`.github/workflows/ci.yml`) ve yüzlerce test var. Güncel durum ve aktif iş için bkz. `docs/STATE.md` (yukarıda otomatik yükleniyor) ve `docs/REVIEW-PLAN.md`.

## Ürün özeti

GurmeGo, İstanbul'un butik/özel yemek mekanlarını (zincirler hariç) yapısal veriyle (konum, menü, fiyat, ulaşım) keşfettiren mobil öncelikli platform. MVP kapsamı: **Kadıköy, Beşiktaş, Beyoğlu**. Tek backend/API; React Native mobil (ana deneyim) + Next.js web (SEO/SSR) + Next.js admin (kürasyon paneli) besler. Detay: [product-overview.md](docs/product-overview.md).

## Stack ve komutlar (hedef durum)

| Katman | Seçim |
|---|---|
| Backend | NestJS (Node.js + TypeScript), Fastify adapter |
| ORM | Prisma — PostGIS/pgvector sorguları yalnızca repository katmanında `$queryRaw` ile |
| DB | PostgreSQL + PostGIS (coğrafi) + pgvector (semantic search), Supabase üzerinde |
| Auth | Supabase Auth (JWT, NestJS guard JWKS ile doğrular) |
| Mobil | React Native (Expo önerilir) |
| Web/Admin | Next.js — web SSR/SSG (SEO), admin CSR (iç araç) |
| API stili | REST + OpenAPI → `packages/api-client` tip üretimi |
| Repo aracı | pnpm workspace + Turborepo, Node sürümü `.nvmrc` ile sabit |

Beklenen komutlar (Turborepo üzerinden, `turbo.json` kurulunca):
- Lint/typecheck/test: paket bazlı, CI'da zorunlu, pre-commit hook (husky + lint-staged)
- Şema migration: yalnızca `prisma migrate` — Supabase dashboard'dan elle şema değişikliği **yasak**
- `pnpm export:venues` — venue verisinin JSON/CSV export'u (haftalık cron + admin panelden tetiklenebilir)

Tek bir testi çalıştırma komutu (Vitest/Jest) iskelet kurulduğunda buraya eklenmeli.

## Mimari — büyük resim

**Monorepo yapısı** ([architecture.md](docs/architecture.md) §3):
```
apps/api/        # NestJS — TÜM iş mantığı burada
apps/mobile/      # React Native
apps/web/         # Next.js tüketici (SSR/SSG)
apps/admin/       # Next.js kürasyon paneli
packages/shared/  # zod şemaları, ortak tipler, sabitler (ilçe listesi, enum'lar)
packages/api-client/  # OpenAPI'den üretilen tip güvenli istemci
```
İstemciler (mobile/web/admin) iş mantığı içermez — yalnızca görüntüleme + istek katmanı. Aynı zod şemaları hem API validasyonunda hem istemci form validasyonunda kullanılır.

**Arama iki parçalı** ([architecture.md](docs/architecture.md) §6):
1. Yapısal filtreler (kategori, fiyat, ilçe, mesafe) → doğrudan SQL + PostGIS (`ST_DWithin`/`ST_Distance`), keyset pagination, hedef <300ms.
2. Semantic: doğal dil sorgu → LLM ile filtre çıkarımı + pgvector benzerlik, sonuç yapısal filtrelerle AND'lenir. AI kapalıyken yapısal arama tek başına tam çalışmalı (FR-AI-03) — bu invariant'ı bozan hiçbir değişiklik yapılmamalı.

**Kürasyon kuyruğu** tüm kullanıcı katkısının (yeni mekan önerisi, düzeltme, şikayet) tek giriş noktası — onaysız hiçbir şey `Venue`'ye yazılmaz. Onaylanan her değişiklik `VenueVersion`'a snapshot alır (geri alma = eski snapshot uygulama). Detay: [architecture.md](docs/architecture.md) §5, veri modeli §4.

**Rule engine** ([rule-engine.md](docs/rule-engine.md)) — tüm kurallar deterministik, AI karar vermez, eşikler hardcode edilmez (config/`RULES_*`'dan okunur):
- "Butik" tanımı: şube sayısı ≤ eşik + franchise değil + kürasyon onaylı, hepsi birlikte.
- Gurme Puanı: Bayesian ağırlıklı ortalama (rol bazlı oy ağırlığı: user/approved_rater/curator), `Venue.gourmet_score`'a denormalize yazılır — listeleme ek join yapmaz.
- Veri güncellik: 90 gün sonra otomatik `re_verify` görevi kuyruğa düşer.
- Moderasyon: 3 farklı şikayet → yorum otomatik gizlenir + kuyrukta "acil" etiketi.

**Rol/yetki modeli**: `anonymous < user < approved_rater < curator < admin`. Rol→yetki eşlemesi DB'de tutulur; açık kararlar (Gurme Puanı'nı kimin verebileceği gibi) kod/şema değişikliği değil **konfigürasyon değişikliği** ile çözülür.

**Konum gizliliği (NFR-04)**: kullanıcı koordinatı hiçbir log/analytics çağrısına yazılmaz, yalnızca sorgu parametresi olarak kullanılır — code review kontrol maddesi, her PR'da denetlenir.

**Redis yok (bilinçli MVP kararı)**: cache + rate limit sayaçları Postgres `unlogged` tablolarda, kodda `CacheStore` interface arkasında — trafik büyüyünce yalnızca adapter değişimiyle Redis'e geçilir. Bu soyutlamayı bypass eden doğrudan Postgres erişimi yazmayın.

## Kodlama kuralları

- TypeScript `strict: true` her pakette; `any` yasak (kaçınılmazsa gerekçeli `// eslint-disable`).
- Tüm API girdileri `packages/shared` içindeki zod şemalarıyla doğrulanır (NestJS pipe entegrasyonu).
- PostGIS/pgvector raw SQL'i yalnızca repository katmanında; servis katmanı raw SQL görmemeli.
- Rule engine eşikleri asla kodda sabit değer olarak yazılmaz.
- Branch: `feat/...`, `fix/...`, `chore/...`; commit: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- `master` korumalı — doğrudan push yok, PR + ≥1 onay + yeşil CI zorunlu, squash merge.

## Asla yapma

- Supabase dashboard'dan elle şema değişikliği yapma — yalnızca `prisma migrate`.
- Kullanıcı konum koordinatını log/analytics'e yazma.
- Rule engine eşiklerini (butik şube sınırı, Gurme Puanı parametreleri, güncellik günü, moderasyon eşikleri) hardcode etme.
- `ContributionQueue`'yu atlayıp kullanıcı katkısını doğrudan `Venue`'ye yazma — onay akışı zorunlu.
- Servis katmanına raw SQL/PostGIS sorgusu sızdırma — repository katmanıyla sınırla.
- İstemcilere (mobile/web/admin) iş mantığı ekleme — iş mantığı yalnızca `apps/api`.
- Mimari/kural değişikliği yapan bir PR'ı ilgili `docs/*.md` dosyasını güncellemeden birleştirme.

## Doküman haritası

- [prd.md](docs/prd.md) — detaylı gereksinimler, açık kararlar (AK-01/02/03)
- [architecture.md](docs/architecture.md) — sistem tasarımı, veri modeli, arama katmanı
- [rule-engine.md](docs/rule-engine.md) — tüm deterministik kurallar ve config eşikleri
- [api-spec.md](docs/api-spec.md) — REST/OpenAPI uçları, rate limit değerleri
- [ai-prompt-design.md](docs/ai-prompt-design.md) — semantic search LLM prompt tasarımı
- [infrastructure.md](docs/infrastructure.md) — hosting, ortamlar, CI/CD, izleme
- [development-guidelines.md](docs/development-guidelines.md) — test stratejisi, PR süreci
