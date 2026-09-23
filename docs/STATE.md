# Durum — 2026-09-23

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje). Kaynak: 2026-09-08.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23, kullanıcı beyanı, pekiştirildi):** A-Z yetki verildi, kapanış sorusu bile sormadan sıradaki işe geç — büyük şirket ürünü kalite çıtası, süreç disiplini (PR+CI+cross-model review) düşürülmez. Yalnız gerçek Supabase/production erişimi gerektiren geri dönüşsüz adımlarda durulur. 4 alt proje + AK-02 tamam. **Dependabot 7 majör bump triyajı TAMAMLANDI** — hepsi kapandı (aşağı bkz.).

## Şu an ne yapıyoruz
**Dependabot majör bump triyajı kapandı (2026-09-23):**
- **#21 Tailwind v4 — MERGE (5482816).** Codex'in bulduğu MAJOR erişilebilirlik regresyonu (`outline-none`→`outline-hidden`) düzeltildi.
- **#25 Prisma7 + #27 TS6 — MERGE, bundled (39a3976).** Gerçek geçiş: `@prisma/client`→7.10.0, `prisma.config.ts`, `PrismaService`→`@prisma/adapter-pg`. Codex review gerçek bir prodüksiyon bug'ı (`isUniqueViolation()` CSV import duplicate-skip kırılıyordu) + lazy-connection-pool nedeniyle smoke test'in yanlış "bağlandı" iddiası verdiğini buldu, hepsi düzeltildi.
- **#20/#22/#26 NestJS trio → gerçek koordineli migrasyon (PR #30, e3911af) — MERGE, üçü kapatıldı.** Tüm `@nestjs/*` ailesi (common/core/platform-fastify/schedule/swagger/cli/testing) 12.x'e + fastify 5.12.5'e hizalandı. Codex review (2 tur, yüksek efor) 1 MAJOR + 2 MINOR buldu: (a) Fastify 5.12 numeric `trustProxy`'i sessizce fail-closed yapıyordu → `resolveTrustProxy` artık aynı eski hop-counting semantiğini taklit eden bir fonksiyon döndürüyor, ama bu YENİ bir açık değil — Fastify'ın 5.12'de kapattığı AYNI zayıf (adres doğrulamadan sadece pozisyon sayan) deseni geri getiriyor; kodda açıkça işaretlendi, Plan 4'te gerçek CIDR doğrulamasıyla değiştirilmeli, TRUST_PROXY_HOPS şu an her yerde unset/dormant. (b) `enableCors()` artık koşulsuz `import()` kullanıyor → `app.register(fastifyCors,...)`'a geçirildi (hem prod hem test için daha sağlam). (c) manuel multipart register NestJS'in kendi dinamik-import'una yönlendiriliyordu → `multipart: false`. Jest, NestJS12'nin saf-ESM paketlerini parse edemiyordu (prod etkilenmiyor, Node 22 `require(esm)` ile sorunsuz) → pnpm-farkında `transformIgnorePatterns` + özel küçük bir babel plugin'i (`import.meta.url`→`__filename`, sadece `createRequire(...)` çağrısında) eklendi. Doğrulama: jest 366/366 (52→54/54 suite), gerçek CORS preflight header testi, kötü DATABASE_URL/DB ile boot patlıyor.
- **#18 — upstream'de bloklu**, fastify 5.12.x uyumlu plugin sürümü henüz yok.
- **#24 zod v4 — önceden NO-GO** (bkz. ELENMİŞ).

## Sıradaki adım
Dependabot triyajı bitti, açık majör bump yok. AK-03 (gelir modeli) PRD'nin kendi zamanlaması gereği Faz 2'ye açık bırakıldı. Gerçek Supabase kurulunca DB rol script'i uygulanacak. Takip edilecek küçük borç: `@nestjs/schematics@12.0.5`'in Node engine aralığı (`^22.22.3`) `.nvmrc`'in 22.19.0'ını kapsamıyor (pnpm strict enforce etmiyor, CI yeşil) — ayrı bir `.nvmrc` bump değerlendirmesi gerektirir, aceleye getirilmedi. `resolveTrustProxy`'nin hop-counting sınırlaması Plan 4'te gerçek CIDR doğrulamasıyla değiştirilmeli.

## Bloke olanlar
- Yok. Gerçek Supabase erişimi gerektiren adımlar (DB rolü script'i, JWT env) kod/doküman tarafında hazır.

## Yakın kararlar
- ADR 006: DB-trigger'lı append-only audit log → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU.
- Review/red-team'i tek turda bitirmeyi ummak · CI "yazıldı=çalışıyor" varsayımı · Codex çıktısını görmeden "çalışıyor" saymak: ELENDİ, KALICI. `codex exec … - < dosya` (stdin), bitiş = `tokens used`.
- **Codex kotası dolduğunda "birazdan tekrar dene" değil, SABİT bir saatte yenileniyor** (mesajdaki saat = gerçek reset zamanı): ELENDİ, KALICI — erken tekrar denemek zaman kaybı, mesajdaki saate kadar bekle.
- Majör bağımlılık yükseltmesini "testler yeşil" ile kapatmak: ELENDİ, KALICI — zod v4/TS6/Prisma7/NestJS12 hepsi bunu doğruladı; canlı `tsc`/worktree probe + gerçek DB/boot testi şart, mock yetmez.
- Dependabot bir paket ailesinden (Prisma CLI+client, `@nestjs/*`) sadece BİR üyeyi yükseltebiliyor, diğerlerini eski bırakıp kırık kombinasyon oluşturuyor: ELENDİ, KALICI — merge etmeden önce ailenin diğer üyelerinin durumunu kontrol et.
- Prisma7 driver adapter'da `$connect()` lazy: ELENDİ, KALICI — boot-time kanıt için gerçek sorgu (`SELECT 1`) şart.
- Worktree'de `apps/api` typecheck'i bazen master'dan FARKLI (yanlış) hata verebiliyor: ELENDİ, KALICI — gerçek CI'da doğrula.
- `prisma migrate dev` çıktısını olduğu gibi uygulamak: ELENDİ, KALICI — PostGIS GiST index'ini "drift" sanıp DROP önerir.
- Workspace'te birden çok `@types/react` sürümü: ELENDİ, KALICI — `scripts/check-single-types-react.mjs` korur.
- Paylaşılan zod şemasına zorunlu alan eklemek, tek app'in testine bakıp "yeşil" saymak: ELENDİ, KALICI.
- JS regex `/i` ile Türkçe büyük "İ" eşleştirmek: ELENDİ, KALICI.
- Seçili öğe değişirken önceki async yanıtları guard'lamamak: ELENDİ, KALICI.
- Mobile gerçek Expo dev server'da hiç elle denenmemiş: ELENDİ, KALICI.
- `gh pr merge --squash` sonrası yerel `master` "fast-forward yapılamıyor" hatası: ELENDİ, KALICI — `git reset --hard origin/master`.
- `next.config.js`'de `images.remotePatterns: [{hostname:"**"}]`: ELENDİ, KALICI — açık proxy riski.
- zod v4 `.partial()` default alanları sessizce output'a enjekte ediyor: ELENDİ, KALICI.
