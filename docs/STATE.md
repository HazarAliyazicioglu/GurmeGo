# Durum — 2026-09-26 (2. tur)

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
**PR #36 canlıda: "mekan öner" özelliği uçtan uca çalışıyor** (shared şema + `POST /venue-suggestions` + admin kuyrukta Şikayetler/Yeni-mekan-önerileri sekmesi + web `/mekan-oner` sayfası, header+footer'dan linkli). Prod'da canlı doğrulama sırasında gerçek bir test kaydı düştü: admin panelde "Yeni mekan önerileri" sekmesinde "Test Ping Kahvecisi" (Kadıköy/cafe) görünecek — **reddet yeterli**, Venue tablosuna hiç yazılmadı.

Kullanıcı "ürün hâlâ kullanışlı değil, geliştirmeye devam" dedi (2026-09-26). REVIEW-PLAN.md'nin çoğu bulgusu stale çıktı (zaten çözülmüş: helmet, rate-limit, security header'lar, error/not-found sayfaları, SEO). Gerçek boşluk mimari denetimden çıkmadı, kod okumaktan çıktı: `architecture.md`'nin vaat ettiği "kürasyon kuyruğu = yeni mekan önerisi + düzeltme + şikayet" üçlüsünden sadece şikayet vardı. Şimdi ikisi var (öneri + şikayet); **"düzeltme" (mevcut mekan bilgisini kullanıcının düzeltme önermesi, ContributionType.EDIT) hâlâ yok** — sıradaki aday bu. Ayrıca mobil app ve arama/harita akışları henüz gerçek kullanıcı gözüyle taranmadı.

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
