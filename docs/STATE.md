# Durum — 2026-09-26 (3. tur)

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
**PR #38 canlıda: REPORT'a yapısal düzeltme (field/suggestedValue) eklendi.** `EDIT` tipini kasıtlı KULLANMADIM — approve(EDIT) otomatik `verifiedAt` günceller + venue-başına-tek-PENDING-EDIT unique index'i re-verify cron'una ait, kullanıcı düzeltmesiyle çakışırdı. Web'de ReportForm'a "Düzeltme öner" toggle'ı, admin'de queue-item'da gösterim eklendi.

Bu turda kürasyon kuyruğunun üç girişi de (yeni mekan önerisi #36, düzeltme #38, şikayet zaten vardı) tamam. Sıradaki adaylar, öncelik sırasıyla değil: (1) mobil app'i gerçek kullanıcı gözüyle tara (henüz bu turda hiç bakılmadı), (2) arama/harita akışlarını canlıda uçtan uca test et, (3) `NEXT_PUBLIC_SITE_URL` Vercel'de set mi kontrol et (kullanıcı kararı — önceki turda not edildi), (4) tasarım tokenı sistemi (180 hardcode hex, REVIEW-PLAN §2.3) — kozmetik, düşük öncelik.

## Bloke olanlar
- **Codex kotası** (2026-09-28'e kadar).
- CSP header, maskable icon, root OG görseli — tarayıcı/tasarım doğrulaması gerektiriyor.
- Seed placeholder verisi gerçek mekan verisiyle değiştirilmeli (kullanıcı kararı bekliyor, acil değil).

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
