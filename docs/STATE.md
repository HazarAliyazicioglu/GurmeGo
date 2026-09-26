# Durum — 2026-09-26 (6. tur)

## Veri sınırı
Codex: izinli ama **kota bitti, 2026-09-28'e kadar geri dönmüyor**. GLM: izinli. Kaynak: 2026-09-08 + bugünkü kota hatası.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23/25, pekiştirildi):** A-Z yetki, kapanış sorusu bile sormadan sıradaki işe geç. Gerçek prod erişimi gerektiren adımlarda (hesap açma, ödeme) kullanıcı hâlâ kendisi yapıyor, ben env/deploy config'ini hazırlayıp doğruluyorum.

## Şu an ne yapıyoruz
**2026-09-25 gece: Supabase + Railway + Vercel canlıya alındı — proje artık gerçekten internette, uçtan uca doğrulandı.**
- **Supabase:** proje kuruldu, 6 migration gerçek DB'de uygulandı, PostGIS aktif, JWKS/anon key doğrulandı. Proje bölgesi `ap-southeast-2` (Sydney) — İstanbul'a ideal değil ama şimdilik sorun değil.
- **Railway (backend API):** Railpack'in bu pnpm monorepo'da 3 farklı şekilde başarısız olması üzerine (no start command → npm+workspace: protokolü hatası → yanlış deploy-image path) **kendi Dockerfile'ımızı yazdık** (repo kökünde `Dockerfile`, multi-stage: `pnpm install` → `turbo run build --filter=@gurmego/api` → `node dist/main.js`). `https://gurmego-production.up.railway.app` canlı.
- **Vercel:** iki proje — web (`https://gurme-go-web.vercel.app`) ve admin (`https://gurme-go-admin-blush.vercel.app`) — ikisi de deploy oldu.
- **Seed data:** kullanıcı onayıyla `apps/api/prisma/seed.ts` (placeholder/örnek veri, "Örnek kürasyon notu" metinleriyle) gerçek prod DB'sine yazıldı — 3 ilçe (Kadıköy/Beşiktaş/Beyoğlu) + 6 örnek mekan. **Bunlar gerçek ürün verisi değil**, admin panelden gerçek verilerle değiştirilmesi/silinmesi gerekiyor.
- `https://gurme-go-web.vercel.app/kadikoy` test edildi — gerçek mekan isimleri (Moda Meyhanesi, Kadıköy Kahvecisi) görünüyor, SSR çalışıyor.

## Sıradaki adım
**Kullanıcı "duracak mısın, devam et, projenin başında sen varsın" dedi (2026-09-26) — bundan sonra iş bitince kapanış sorusu YOK, sıradaki en değerli işe kendiliğinden geç.** Bu turda: PR #44 (rule-engine/architecture/api-spec dokümantasyonu #36/#38 ile senkronize edildi — mimari değişiklik yapıp docs güncellememek CLAUDE.md ihlaliydi, düzeltildi), PR #45 (admin CSV import sayfasına sütun formatı referansı + örnek indirme), PR #46 (roller sayfasında curator atamadan önce onay adımı — geri alma UI'ı olmadığı için tek tıkla geri dönüşsüzdü).

Admin panelinin 6 sayfasından (kuyruk, import, roller taranmış; mekan-gecmisi, veri-kalitesi, erisim-yok hızlıca göz gezdirildi, ciddi bir sorun görülmedi) tarama tamamlandı. Sıradaki: **backend'in kendisini** (rate-limit config, audit log gerçekten çalışıyor mu, `/health` dışı observability) tara — üç istemciyi bitirdik ama API'nin operasyonel olgunluğuna hiç bakmadık.

## Bloke olanlar
- **Codex kotası** (2026-09-28'e kadar).
- CSP header, maskable icon, root OG görseli — tarayıcı/tasarım doğrulaması gerektiriyor.
- Seed placeholder verisi gerçek mekan verisiyle değiştirilmeli (kullanıcı kararı bekliyor, acil değil).
- Mobil deep-linking ve mobil tasarım sistemi — kullanıcıyla kapsam konuşulmadan başlanmayacak.

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
