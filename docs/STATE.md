# Durum — 2026-09-22

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje — repo HazarAliyazicioglu/GurmeGo). Kaynak: 2026-09-08.

## Ürün vizyonu (2026-09-09)
Hedef kitle: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Marka: sıcak/editöryel kimlik. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
`docs/DENETIM-RAPORU.md` (53 bulgu) uygulanıyor. Biten plan: docs/superpowers/plans/2026-09-21-api-hardening.md — 11/11 task. Yeni plan (web/admin/mobil/altyapı) henüz yazılmadı.
(2026-09-07-mobile-mvp.md checkbox'la izlenmiyor; 0/128 işaretsiz ama mobil master'da, ADR 005 sonrası eski sayılır.)

## Şu an ne yapıyoruz
Kullanıcı 2026-09-21'de tüm yetkiyi devretti ("planlama, programlama, araştırma sende; vizyona uygun en üst seviye"); PR akışı/CI/Codex review kuralları aynen geçerli.
Bu oturumda `master`'a girenler: **Kritik 11/11** (PR #1 Next 16/React 19, #2 NestJS 11+Fastify 5; prod audit 3 critical/50 high → 0/0) ve **Orta paket A** (PR #4 çekirdek, #5 audit log;
ADR 006 v2): helmet, gzip, ortak admin rate-limit, CSV 2000 satır sınırı, ölçülmüş liste indeksi, hata zarfı normalizasyonu, DB-seviyesinde append-only `audit_log`. API 54 suite / 352 test.
Son commit: CI kararsızlığı (aynı commit'te bir koşu TS2742 verdi) → workspace'te tek `@types/react` + CI'da lockfile koruması, PR #7 CI yeşil geçti ve `master`'a squash-merge edildi (2026-09-22).

## Vizyon cevabı (2026-09-22)
Web `venue-card` fotoğraf eksikliği bilinçli editöryel tercih DEĞİL — eksik özellik. Fotoğraf gösterimi eklendi (aşağıya bkz).

## Bu oturumda tamamlanan: venue-card kapak fotoğrafı (PR #8, 2026-09-22)
Bounded görev (brainstorming onayı alındı, spec dosyası yok). `VenueListItemSchema`'ya `coverPhoto: string | null` eklendi (tam `photos` dizisi değil), API `searchPublished` SELECT'ine `v.photos[1] AS "coverPhoto"`, web `venue-card.tsx` düz `<img>` ile kapak fotoğrafı gösteriyor. TDD ile katman katman (shared→API→web), Codex cross-model review 5 minor bulgu (2 kabul, 1 red, 2 zaten temiz). CI kırmızıya düştü (`@gurmego/mobile#test` — mobile'ın kendi `api.spec.ts` fixture'ı da aynı şemayı runtime doğruluyordu, coverPhoto eksikti), düzeltildi, CI yeşil, `master`'a squash-merge.

## Admin paketi ilerlemesi (kullanıcı onaylı sıra: veri kalitesi → rol atama → mekan geri alma → nav zaten 1'le birlikte gitti)
1/3 tamam: **veri kalitesi raporu** (PR #9, 2026-09-22) — `/veri-kalitesi` sayfası + nav linkleri, `DataQualityReportSchema` eklendi.

## Sıradaki adım
Admin alt görev 2/3: **rol atama** ekranı. Backend'de `PUT /admin/users/:id/roles` var ama kullanıcı arama endpoint'i YOK — önce `GET /admin/users?search=` (email/isim) gibi bir arama endpoint'i eklenmeli, sonra admin sayfası. Ardından 3/3: **mekan geri alma** — `POST /admin/venues/:id/revert/:versionId` var ama versiyon listeleme endpoint'i yok, o da önce eklenmeli. Mobil liste ekranı (`DiscoveryScreen`) venue-card ile aynı fotoğraf eksikliğini taşıyor — kapsam dışı bırakıldı, istenirse ayrı bounded görev olarak alınabilir.

## Bloke olanlar
- Yok. Plan 4e (canlıya çıkış) eylem maddeleri hâlâ açık: uygulamanın DB rolü `audit_log` sahibi olmayacak/yalnız INSERT+SELECT (ADR 006); SUPABASE_JWT_ISSUER/AUDIENCE set edilecek.

## Yakın kararlar
- ADR 006: aynı DB'de DB-trigger'lı append-only audit log, aynı transaction'da → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU — Gurme Puanı/geniş katkı markanın uzun vadeli kimliği; öncelik yeniden bakılabilir.
- Review/red-team'i tek turda bitirmeyi ummak · CI'nın "yazıldı = çalışıyor" varsayımı · cross-session guard'larda TEK sinyal: ELENDİ, KALICI (monotonic counter).
- Expo `EXPO_PUBLIC_*` dinamik erişim; testte `new Date().getDay()` (CI UTC vs UTC+3); safe-area-context `jest/mock.js`: ELENDİ, KALICI. Mobile gerçek Expo dev server'da hiç elle denenmemiş.
- Codex review'ı çıktısını görmeden "çalışıyor" saymak: ELENDİ, KALICI. Sessiz hatalar: eski CLI/model uyumsuzluğu VE Windows'ta ~32KB üstü prompt (`Argument list too long`).
  Kural: `codex exec … - < dosya` (stdin), bitiş = çıktıda `tokens used` + `^ERROR` yok; "codex.exe var mı" ile bekleme.
- Majör bağımlılık yükseltmesini "testler yeşil" ile kapatmak: ELENDİ, KALICI (Fastify 5 cors metod regresyonunu yalnız canlı probe yakaladı). Framework'ün kendi bağımlılığını (fastify) `^` ile pinlemek: ELENDİ (exact pin).
- `prisma migrate dev` çıktısını olduğu gibi uygulamak: ELENDİ, KALICI — PostGIS GiST `Venue_location_idx`'i "drift" sanıp DROP önerir; her migration'da elle çıkar (e2e koruması var).
- `src/` dışından import (tsconfig include=[src]): ELENDİ — rootDir kayar, çıktı `dist/src/main.js`, CI smoke kırılır; yerel smoke'tan önce `rm -rf apps/api/dist`.
- Workspace'te birden çok `@types/react` sürümü: ELENDİ, KALICI — pnpm hoist rastgele seçer, aynı commit'te flaky TS2742. CI'da scripts/check-single-types-react.mjs korur.
- Kilitsiz okuma-sonra-yazma ile "önceki değeri" kaydetmek: ELENDİ — koşullu `updateMany` kalıbı. jest 29 ESM-only transitive'leri parse edemez: NestJS 12 (ESM-only) KOŞULLU — Vitest göçü yapılırsa yeniden bak.
- Paylaşılan (`packages/shared`) bir zod şemasına zorunlu alan eklemek: sadece değiştirdiğin app'in testine bakıp "yeşil" saymak ELENDİ, KALICI — o şemayı runtime doğrulayan HER app'in kendi fixture'ı kırılır (web VE mobile'ın ayrı ayrı `lib/api.spec.ts`'i var, ikisi de aynı `VenueListItemSchema`'yı `safeParse` ediyor). Yeni alan eklerken `grep -rn "<benzer_alan_adı>"` ile tüm apps/ dizinini tara, sadece dokunduğun app'i değil.
