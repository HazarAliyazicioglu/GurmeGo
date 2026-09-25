# Durum — 2026-09-25 (gece, 3. tur)

## Veri sınırı
Codex: izinli ama **kota bitti, 2026-09-28'e kadar geri dönmüyor**. GLM: izinli. Kaynak: 2026-09-08 + bugünkü kota hatası.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23/25, pekiştirildi):** A-Z yetki, kapanış sorusu bile sormadan sıradaki işe geç. Gerçek prod erişimi gerektiren adımlarda (hesap açma, ödeme) kullanıcı hâlâ kendisi yapıyor, ben env/deploy config'ini hazırlayıp doğruluyorum.

## Şu an ne yapıyoruz
**2026-09-25 gece: Supabase + Railway canlıya alındı — projenin ilk gerçek deploy'u.**
- **Supabase:** proje kuruldu, 6 migration gerçek DB'de uygulandı, PostGIS aktif, JWKS/anon key doğrulandı. Proje bölgesi `ap-southeast-2` (Sydney) — İstanbul'a ideal değil ama şimdilik sorun değil.
- **Railway (backend API):** Railpack'in bu pnpm monorepo'da 3 farklı şekilde başarısız olması üzerine (no start command → npm+workspace: protokolü hatası → yanlış deploy-image path) **kendi Dockerfile'ımızı yazdık** (repo kökünde `Dockerfile`, multi-stage: `pnpm install` → `turbo run build --filter=@gurmego/api` → `node dist/main.js`). Lokalde `docker build`+`docker run` ile gerçek Supabase'e karşı doğrulandı, sonra Railway'de de başarılı oldu. `https://gurmego-production.up.railway.app/health` ve `/v1/districts` şu an **canlı ve HTTP 200 dönüyor**.
- Env var eksikliği (`SUPABASE_JWKS_URL` vb.) ve port uyuşmazlığı (Target Port vs `PORT` env var) ayrı ayrı çıkıp çözüldü.

## Sıradaki adım
**Vercel'e geç (web + admin).** İki ayrı Vercel projesi: `apps/web` ve `apps/admin` root directory'leriyle. Env var'lar: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase'den, zaten elimizde), `NEXT_PUBLIC_API_BASE_URL=https://gurmego-production.up.railway.app/v1`. Vercel deploy URL'leri gelince Railway'deki `CORS_ORIGIN`'i güncellememiz gerekecek (şu an localhost'a işaret ediyor, gerçek Vercel origin'leri olmadan web/admin API'ye tarayıcıdan istek atamaz).

**Codex kotası 2026-09-28'e kadar yok** — bugünkü kod değişiklikleri (arama özelliği + REVIEW-PLAN.md backlog'u) self-review ile geçti, kota dönünce toplu bir cross-model-review yapılmalı.

## Bloke olanlar
- **Codex kotası** (2026-09-28'e kadar).
- Vercel hesabı henüz açılmadı — web/admin deploy'u bekliyor.
- CSP header, maskable icon, root OG görseli — tarayıcı/tasarım doğrulaması gerektiriyor.

## Yakın kararlar
- ADR 006: DB-trigger'lı append-only audit log → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- **Railway + pnpm monorepo + Railpack (otomatik tespit): ELENDİ, KALICI.** Root Directory=apps/api → "no start command" (Railpack sadece workspace kökünün package.json'ına bakıyor). Root Directory=repo kökü + custom buildCommand → npm'e düşüyor, `workspace:*` protokolünü anlamıyor. Root Directory=repo kökü + Railpack'in kendi deploy-image path normalizasyonu → `/app/dist/main.js` bulunamıyor (gerçek yol `/app/apps/api/dist/main.js`). **Çözüm: kendi Dockerfile'ını yaz, repo kökünde, otomatik tespite hiç güvenme.**
- Railway'de "Generate Domain" sonrası `*.railway.internal` adresi PUBLIC değil, private service-to-service — dışarıdan erişim için ayrıca public domain/Target Port ayarlanmalı.
- Supabase'in "direct connection" (`db.<ref>.supabase.co:5432`) adresi çoğu ağda **sadece IPv6** — bağlanılamıyorsa önce bunu kontrol et, **Session/Transaction pooler** (`aws-0-<region>.pooler.supabase.com`, IPv4) adresine geç.
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU.
- Codex çıktısını "tokens used" satırı göründü diye otomatik geçerli saymak: ELENDİ, KALICI — kota hatası da bu satırla bitebiliyor.
- REVIEW-PLAN.md'deki "UYGULANMADI" etiketleri zamanla stale kalabiliyor — kodla çapraz kontrol et. KALICI.
- pino-http'de sadece bilinen alanı redact etmek · global tip adını gölgeleyen component import'u · Prisma7 `$connect()` lazy güveni · zod v4 `.partial()` default enjeksiyonu · JS `/i` Türkçe "İ" eşleşmiyor: hepsi ELENDİ, KALICI.
