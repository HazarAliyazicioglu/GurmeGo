# GurmeGo — Proje Özeti ve İlerleme Durumu

Bu dosya projeye yeni katılan biri için yazıldı: ürün ne, mimari nasıl kurgulandı,
şu ana kadar ne bitti, sırada ne var.

## Repo yapısı — ÖNEMLİ

Bu repoda **iki branch** var ve ikisi de farklı şeyleri temsil ediyor:

- **`master`** — yalnızca `docs/` altında spec/tasarım dokümanları var, kod yok.
  Ürünün ne olacağının tam yazılı tarifi burada (aşağıdaki doküman haritasına bakın).
- **`worktree-mvp-backend-foundation`** — **asıl kod burada.** Backend (NestJS),
  web (Next.js) ve admin panel (Next.js) implementasyonları, testler, migration'lar,
  CI konfigürasyonu — hepsi bu branch'te. Henüz `master`'a merge edilmedi (bilinçli
  karar: tüm planlar bitince tek seferde review edilip merge edilecek).

Koda bakmak istiyorsan:
```bash
git checkout worktree-mvp-backend-foundation
```

## Ürün nedir

GurmeGo, İstanbul'un butik/özel yemek mekanlarını (zincirler hariç) yapısal veriyle
(konum, menü, fiyat, ulaşım) keşfettiren bir platform. MVP kapsamı **Kadıköy, Beşiktaş,
Beyoğlu** ile sınırlı. Tek backend/API; web (Next.js, SEO/SSR) + admin panel
(kürasyon/onay arayüzü) besliyor. Mobil (React Native) MVP kapsamından çıkarıldı,
Faz 2'ye ertelendi (web/PWA validasyonu önce).

Detaylı ürün tarifi: `docs/product-overview.md`, `docs/prd.md`.

## Mimari — kısa özet

```
apps/api/        NestJS backend — TÜM iş mantığı burada, Fastify adapter
apps/web/         Next.js — tüketici tarafı (SSR/SSG, SEO)
apps/admin/        Next.js — kürasyon/onay paneli (CSR, iç araç)
packages/shared/   zod şemaları, ortak tipler, sabitler
packages/api-client/  OpenAPI'den üretilen tip güvenli istemci
```

- **DB:** PostgreSQL + PostGIS (coğrafi sorgular) üzerinde Prisma ORM, Supabase'de host'lanıyor.
- **Auth:** Supabase Auth (JWT), NestJS guard JWKS ile doğruluyor.
- **Redis yok (bilinçli MVP kararı):** cache + rate limit Postgres `unlogged` tablolarda,
  `CacheStore` interface arkasında — trafik büyüyünce yalnızca adapter değişimiyle Redis'e geçilir.
- **Kürasyon kuyruğu:** kullanıcı katkısının (yeni mekan, düzeltme, şikayet) tek giriş noktası.
  Onaysız hiçbir şey `Venue`'ye yazılmıyor. Onaylanan her değişiklik `VenueVersion`'a
  snapshot alıyor (geri alma = eski snapshot'ı uygulamak).
- **Rule engine:** "butik" tanımı, moderasyon eşikleri, veri güncellik kuralları gibi her şey
  deterministik ve config'den okunuyor — kodda sabit değer yok.

Mimari kararların gerekçesi ve kabul edilen bedelleri `docs/adr/` altında (4 ADR):
Redis'siz cache, PostGIS raw SQL izolasyonu, tek NestJS monolith, konum bilgisinin HTTP
header ile taşınması.

Tam mimari: `docs/architecture.md`, kural motoru detayı: `docs/rule-engine.md`.

## Şu ana kadar tamamlanan (worktree branch'inde)

Geliştirme, brainstorming → plan → red-team → uygulama → çapraz-model code review
akışıyla ilerledi (her plan Codex ile red-team'den ve final code review'dan geçti).

| Plan | Kapsam | Durum |
|---|---|---|
| Plan 1 | Backend + veri modeli temeli (NestJS, Prisma, PostGIS, Supabase auth, arama, venue/district CRUD) | ✅ 24/24 task, final review temiz |
| Plan 2 | Web/PWA (Next.js tüketici arayüzü, arama, mekan detay, favoriler) | ✅ 12/12 task, final review temiz |
| Plan 3 | Admin panel (kürasyon kuyruğu, onay/red akışı, kullanıcı/venue yönetimi, auth) | ✅ 7/7 task, final review temiz |
| Plan 4a | (Infra/CI temel adımları) | ✅ 3/3 task |
| Plan 4b | (Infra/CI devamı) | ✅ 16/16 task |
| Plan 4c | (Infra/CI devamı) | ✅ 16/16 task |
| Task 17–26 | Plan 1-4c'nin tamamı üzerinde full-codebase cross-model review + bulunan sorunların düzeltilmesi (son turda apps/admin ilk kez sıfır hata) | ✅ tamamlandı |

**Toplam 265 commit** worktree branch'inde. Backend (`apps/api`), web (`apps/web`) ve
admin panel (`apps/admin`) çalışır durumda, gerçek Supabase JWT ile test edildi.

Tam gün-gün ilerleme kaydı: `docs/CHANGELOG.md` ve `docs/SESSION-LOG-2026-07-26.md`.

## Sırada ne var (yapılması planlanan)

**Plan 4 — Infra / CI / KVKK / pilot lansman** üzerinde çalışılıyordu, ikiye bölündü:

- **Plan 4d** — KVKK uyumluluğu, event-capture, hesap silme akışı. Saf kod, gerçek
  hesap/servis gerektirmiyor. Tasarımı yazıldı, kullanıcı onayı bekleyen açık sorular var,
  sonra `idea-red-team`'den geçecek.
- **Plan 4e** — gerçek provisioning (Supabase prod projesi açma, domain, ödeme adımları),
  auth-sync, go-live. **Kod üretmiyor, bir runbook** — her hesap açma/ödeme adımı kullanıcı
  onayı gerektiriyor (para harcayan/geri dönüşü zor adımlar olduğu için bilinçli olarak
  otomatikleştirilmedi).

Bunlardan sonra: tüm planlar (`Plan 1` → `Plan 4e`) tek seferde `master`'a merge edilecek
(kullanıcı kararı — parça parça değil, hepsi bitince).

## Bilinçli olarak MVP dışına bırakılanlar (Faz 2)

- Tam menü verisi, semantic search / pgvector tabanlı arama
- Geniş kullanıcı katkısı akışları
- React Native mobil uygulama (retention web'de kanıtlanırsa açılacak)
- Gurme Puanı / yorum-puanlama sistemi

Bu kararların gerekçesi `docs/STATE.md`'nin "Denenmiş ve ELENMİŞ yaklaşımlar" bölümünde.

## Doküman haritası

- `docs/prd.md` — detaylı gereksinimler, açık kararlar
- `docs/architecture.md` — sistem tasarımı, veri modeli, arama katmanı
- `docs/rule-engine.md` — tüm deterministik kurallar ve config eşikleri
- `docs/api-spec.md` — REST/OpenAPI uçları
- `docs/infrastructure.md` — hosting, ortamlar, CI/CD
- `docs/development-guidelines.md` — test stratejisi, PR süreci
- `docs/adr/` — mimari kararlar (4 ADR)
- worktree branch'inde ek olarak: `docs/CHANGELOG.md`, `docs/DECISIONS.md`,
  `docs/AUDIT-2026-07-26.md`, `docs/SESSION-LOG-2026-07-26.md`

## Nasıl katkı verilir

- Branch adlandırma: `feat/...`, `fix/...`, `chore/...`
- Commit mesajları: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- `main`/`master` korumalı olacak — doğrudan push yok, PR + review + yeşil CI zorunlu
- Şema değişikliği yalnızca `prisma migrate` ile — Supabase dashboard'dan elle değişiklik yasak
