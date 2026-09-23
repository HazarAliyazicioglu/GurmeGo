# Durum — 2026-09-23

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje). Kaynak: 2026-09-08.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23, kullanıcı beyanı, pekiştirildi):** A-Z yetki verildi, kapanış sorusu bile sormadan sıradaki işe geç — büyük şirket ürünü kalite çıtası, süreç disiplini (PR+CI+cross-model review) düşürülmez. Yalnız gerçek Supabase/production erişimi gerektiren geri dönüşsüz adımlarda durulur. 4 alt proje + AK-02 tamam. Şu an: Dependabot majör bump triyajı sürüyor.

## Şu an ne yapıyoruz
**Dependabot 7 majör bump triyajı (2026-09-23), sonuç:**
- **#21 Tailwind v4 — MERGE (5482816).** `@tailwindcss/postcss` migrasyonu + Codex'in bulduğu MAJOR erişilebilirlik regresyonu (`outline-none`→`outline-hidden`, forced-colors modunda focus kayboluyordu) düzeltildi.
- **#25 Prisma7 + #27 TS6 — MERGE, bundled (39a3976).** Dependabot'un PR'ı sadece CLI'ı yükseltip client'ı 5.14.0'da bırakmıştı (kırık); gerçek geçiş yapıldı: `@prisma/client`→7.10.0, `prisma.config.ts` eklendi, `PrismaService` artık `@prisma/adapter-pg` kullanıyor. TS6 bundled çünkü Prisma5+TS6 `TransactionClient` uyumsuzluğunu Prisma7 çözüyor. **Codex review (yüksek efor, 2 tur) gerçek prodüksiyon bug'ı yakaladı:** `isUniqueViolation()` (CSV import duplicate-skip) Prisma7'nin hata kodu taşınmasıyla sessizce bozulacaktı + `.env` auto-load kayboldu + eksik `DATABASE_URL` sessiz fallback riski + Prisma7'nin lazy connection pool'u nedeniyle derlenmiş uygulama **erişilemez DB ile bile boot olup /health 200 dönüyordu** — hepsi düzeltilip ampirik doğrulandı (kötü URL artık boot'u patlatıyor). Doğrulama: yerel Postgres + gerçek CI 3 kez yeşil, jest 366/366, web+admin 159/159+106/106.
- **#20/#22/#26 NestJS trio — ERTELENDİ.** Her PR `@nestjs/*` ailesinden sadece biri, `@nestjs/core` dahil hiçbiri kapsanmıyor — tek koordineli PR gerekiyor.
- **#18 — upstream'de bloklu**, fastify 5.12.x uyumlu plugin sürümü henüz yok.
- **#24 zod v4 — önceden NO-GO** (bkz. ELENMİŞ).

## Sıradaki adım
NestJS 11→12 trio için tüm `@nestjs/*` ailesini birlikte yükselten tek plan/PR hazırla. AK-03 (gelir modeli) PRD'nin kendi zamanlaması gereği Faz 2'ye açık bırakıldı, zorlanmadı. Gerçek Supabase kurulunca DB rol script'i uygulanacak.

## Bloke olanlar
- Yok. Gerçek Supabase erişimi gerektiren adımlar (DB rolü script'i, JWT env) kod/doküman tarafında hazır.

## Yakın kararlar
- ADR 006: DB-trigger'lı append-only audit log → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU.
- Review/red-team'i tek turda bitirmeyi ummak · CI "yazıldı=çalışıyor" varsayımı · Codex çıktısını görmeden "çalışıyor" saymak: ELENDİ, KALICI. `codex exec … - < dosya` (stdin), bitiş = `tokens used`.
- Majör bağımlılık yükseltmesini "testler yeşil" ile kapatmak: ELENDİ, KALICI — zod v4/TS6/Prisma7 hepsi bunu doğruladı; canlı `tsc`/worktree probe + gerçek DB/boot testi şart, mock yetmez.
- Versiyon-özel tsconfig bayrağını (ör. TS6'nın `ignoreDeprecations`) ana `tsconfig.base.json`'a önden eklemek: ELENDİ, KALICI — o PR'ın kendi branch'inde test et.
- Dependabot bir paket ailesinden (Prisma CLI+client, `@nestjs/*`) sadece BİR üyeyi yükseltebiliyor, diğerlerini eski bırakıp kırık kombinasyon oluşturuyor: ELENDİ, KALICI — merge etmeden önce ailenin diğer üyelerinin durumunu kontrol et.
- Prisma7 driver adapter'da `$connect()` lazy (ilk sorguya kadar gerçek bağlantı açmıyor): ELENDİ, KALICI — boot-time kanıt için `onModuleInit`'e gerçek sorgu (`SELECT 1`) şart; health-check/smoke-test iddialarını kötü bir URL ile ampirik doğrula.
- Worktree'de `apps/api` typecheck'i bazen master'dan FARKLI (yanlış) hata verebiliyor (kaynak/config/generated client birebir aynı olsa bile): ELENDİ, KALICI — körü körüne gerçek sanma, gerçek CI'da doğrula.
- `prisma migrate dev` çıktısını olduğu gibi uygulamak: ELENDİ, KALICI — PostGIS GiST index'ini "drift" sanıp DROP önerir, elle çıkar.
- Workspace'te birden çok `@types/react` sürümü: ELENDİ, KALICI — `scripts/check-single-types-react.mjs` korur.
- Paylaşılan zod şemasına zorunlu alan eklemek, tek app'in testine bakıp "yeşil" saymak: ELENDİ, KALICI — tüm `apps/`'i grep'le.
- JS regex `/i` ile Türkçe büyük "İ" eşleştirmek: ELENDİ, KALICI.
- Seçili öğe değişirken önceki async yanıtları guard'lamamak: ELENDİ, KALICI — eski state'i hemen temizle + ref kontrolü.
- Mobile gerçek Expo dev server'da hiç elle denenmemiş: ELENDİ, KALICI.
- `apps/mobile` VenueDetailScreen ilk testi CI'da global 15sn jest timeout'unu aşıyordu: ELENDİ, KALICI — sadece o testin timeout'u 20sn'ye çıkarıldı.
- `gh pr merge --squash` sonrası yerel `master` "fast-forward yapılamıyor" hatası: ELENDİ, KALICI — GitHub'da merge olmuştur, `git reset --hard origin/master` ile hizala.
- `next.config.js`'de `images.remotePatterns: [{hostname:"**"}]`: ELENDİ, KALICI — açık proxy riski.
- zod v4 `.partial()` default alanları sessizce output'a enjekte ediyor: ELENDİ, KALICI — `X.partial()` türetilen HER update şemasını her `.default(...)` alan için denetle.
- Fastify patch bump'ları bile plugin tipleriyle kırılabiliyor: ELENDİ, KALICI.
