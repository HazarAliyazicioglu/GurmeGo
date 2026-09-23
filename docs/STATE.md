# Durum — 2026-09-23

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje). Kaynak: 2026-09-08.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23, kullanıcı beyanı):** A-Z yetki verildi — planlama, tasarım, kod, PR, merge dahil. Yalnız gerçek Supabase/production erişimi gerektiren geri dönüşsüz adımlarda durulur. 4 alt proje tamamlandı (PR #4-#29, master'da). AK-02 kapandı. Şu an: kalan majör dependency bump'ları triyaj ediliyor.

## Şu an ne yapıyoruz
**AK-02 kapandı (2026-09-23, docs/prd.md):** "Kullanıcı hesabı ne kadar zorunlu?" — zaten kodda (a) ("anonim gezinme, katkı için hesap") uygulanmış durumdaydı (`venues.controller.ts`/`reports.controller.ts` guard'sız, `favorites.controller.ts` guard'lı, `architecture.md` §7 zaten (a)'yı varsayılan belgeliyordu). Yeni karar değil, PRD durumunu gerçeğe eşitleme.

**AK-03 (gelir modeli) açık bırakıldı** — PRD'nin kendi zamanlaması "Faz 2 başında" diyor, MVP'de zorlanmadı.

**7 Dependabot majör bump'ı (#18, #20-27 hariç merge edilenler) CI'da FAIL, tek tek incelendi (2026-09-23):**
- **#27 (TS 6):** İlk bakışta tek satır (`moduleResolution=node10` deprecated) sanıldı, worktree'de test edilince apps/api'de `@types/jest` ambient tip çözümü bozuluyor (describe/it/expect "cannot find name") + 1 implicit-any (`venues.repository.ts:325`) ortaya çıktı. **Gerçek migrasyon, one-liner değil.**
- **#20/#22/#26 (NestJS 11→12 trio):** #20 fastify plugin tip uyumsuzluğu (`main.ts`, helmet/compress/multipart), #22/#26 jest ESM "Cannot use import statement outside a module" — koordineli, üçü birlikte ele alınmalı.
- **#25 (Prisma 5→7):** `schema.prisma`'daki `datasource url` artık desteklenmiyor, `prisma.config.ts`'e taşınma gerekiyor — config mimarisi değişikliği.
- **#21 (Tailwind v4):** `apps/web` testi FAIL, tailwind'e özgü mü genel mi netleşmedi — ayrı incelenmeli.
- **#18 (minor-and-patch, 24 update):** #20 ile aynı kök neden (fastify plugin tipleri).
- **#24 (zod v4):** önceden NO-GO (bkz. ELENMİŞ).

## Sıradaki adım
**#27 (TS6) derinlemesine incelendi (2026-09-23), TEK BAŞINA ERTELENDİ:** `moduleResolution=node10` + ambient `@types` taraması (TS6'da kapatıldı, `"types":["jest","node"]` eklenmeli) düzeltilebilir görünüyordu, ama asıl sorun daha derinde — Prisma 5.22'nin ürettiği `Prisma.TransactionClient = Omit<DefaultPrismaClient, ITXClientDenyList>` tipi TS6 altında TÜM delegate property'lerini kaybediyor (`contributionQueue`/`venue`/`venueVersion`/`auditLog`/`user`/`$queryRaw` hepsi "does not exist" hatası veriyor), `denylist` kaynağı doğru tanımlı — TS6'nın generic/`Omit` çözümlemesi Prisma 5.x tipleriyle uyumsuz. Bu, transaction içindeki HER admin serviste (queue/users/venues) ve audit log yazma yolunda (ADR 006) tip güvenliğini kırar; `as any` ile yamanacak bir şey değil. PR #27'ye bulgu yazıldı. **TS6 ve Prisma7 (#25) birlikte ele alınmalı** — sıradaki adım: #25 Prisma7'yi (schema `datasource url`→`prisma.config.ts` migrasyonu) önce çöz, sonra TS6'yı aynı pakette dene. Sonra #20/22/26 NestJS trio → #21 Tailwind4 → #18.

Gerçek Supabase kurulunca DB rol script'i uygulanacak.

## Bloke olanlar
- Yok. Gerçek Supabase erişimi gerektiren adımlar (DB rolü script'i, JWT env) kod/doküman tarafında hazır.

## Yakın kararlar
- ADR 006: DB-trigger'lı append-only audit log → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU.
- Review/red-team'i tek turda bitirmeyi ummak · CI "yazıldı=çalışıyor" varsayımı · Codex çıktısını görmeden "çalışıyor" saymak: ELENDİ, KALICI. `codex exec … - < dosya` (stdin), bitiş = `tokens used`.
- Majör bağımlılık yükseltmesini "testler yeşil" ile kapatmak: ELENDİ, KALICI — zod v4 ve TS6 (bkz. yukarı) ikisi de bunu doğruladı; canlı `tsc`/worktree probe'u şart.
- **TS6'nın `ignoreDeprecations: "6.0"` bayrağını mevcut TS5.9.3 base config'e önden eklemek: ELENDİ, KALICI** — TS5.9 bu değeri tanımıyor (`TS5103: Invalid value`), ana repo typecheck'ini anında kırdı. Versiyon-özel config değişikliklerini o PR'ın kendi branch'inde/worktree'sinde test et, ana `tsconfig.base.json`'a asla önden ekleme.
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
- Fastify patch bump'ları (#18) bile `@fastify/{helmet,compress,multipart}` plugin tipleriyle kırılabiliyor: ELENDİ, KALICI.
- TypeScript 6 + Prisma 5.22 birlikte: `Prisma.TransactionClient` tipi delegate property'lerini kaybediyor (Omit/generic çözümleme uyumsuzluğu). KOŞULLU — Prisma 7'ye geçilince yeniden denenmeli, TS6'yı Prisma7'den önce/ayrı merge etmeye çalışma.
