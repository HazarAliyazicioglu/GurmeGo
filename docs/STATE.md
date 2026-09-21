# Durum — 2026-09-21

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje — repo HazarAliyazicioglu/GurmeGo). Kaynak: 2026-09-08.

## Ürün vizyonu (2026-09-09)
Hedef kitle: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Marka: sıcak/editöryel kimlik. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Şu an neredeyiz
`docs/DENETIM-RAPORU.md` (53 bulgu) uygulanıyor. Kullanıcı 2026-09-21'de tüm yetkiyi devretti ("planlama, programlama, araştırma sende; vizyona uygun en üst seviye").
**Kritik 11/11 KAPANDI** (PR #1 Next 16/React 19, #2 NestJS 11+Fastify 5; prod audit 3 critical/50 high → 0/0).
**Orta paket A (API) KAPANDI** (PR #4 çekirdek, #5 audit log; plan: docs/superpowers/plans/2026-09-21-api-hardening.md, ADR 006 v2): helmet, gzip,
ortak admin rate-limit (60/dk tek kova, import 5/saat), CSV 2000 satır sınırı, ölçülmüş liste indeksi (50k satırda 7.7→0.07 ms), hata zarfı normalizasyonu,
DB-seviyesinde append-only `audit_log` (rol/venue/kuyruk atomik+fail-closed, CSV niyet-önce-etki). API: 54 suite / 352 test.

## Sıradaki adım
Kalan Orta bulgular, paket paket (TDD → Codex review → PR → CI → merge): **web** (next/image, tasarım tokenı+font, error/not-found, güvenlik başlıkları, favori liste unique, harita CSS) →
admin (rol/veri-kalitesi/geri-alma ekranları, nav, hata listesi sınırı) → mobil (8 Orta) → altyapı (Dependabot, .env.example, docs gerçeği). API'de ayrıca: pino observability (KVKK: konum redaksiyonu), DB pooling kararı.

## Bloke olanlar: Yok.
Plan 4e (canlıya çıkış) eylem maddeleri: uygulamanın DB rolü `audit_log` sahibi olmayacak/yalnız INSERT+SELECT (ADR 006); SUPABASE_JWT_ISSUER/AUDIENCE set edilecek.

## Test altyapısı
`apps/api` e2e'leri Postgres+PostGIS docker'a (`gurmego-test-db`, port 5434) karşı, `.env` gitignore'lu. Docker Desktop kapalıysa önce aç. Yerel smoke: önce `rm -rf apps/api/dist`.

## Yakın kararlar
ADR 005 native mobile · ADR 006 audit log · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2'ye; Gurme Puanı/geniş katkı markanın uzun vadeli kimliği, öncelik yeniden bakılabilir.
- Review/red-team'i tek turda bitirmeyi ummak · CI'nın "yazıldı = çalışıyor" varsayımı · cross-session guard'larda TEK sinyal: ELENDİ (monotonic counter).
- Expo `EXPO_PUBLIC_*` dinamik erişim: ELENDİ; mobile gerçek Expo dev server'da hiç elle denenmemiş.
- Testte `new Date().getDay()`: ELENDİ (CI UTC vs İstanbul UTC+3). react-native-safe-area-context'in `jest/mock.js`'i: ELENDİ (named export kırar).
- Codex review'ı çıktısını görmeden "çalışıyor" saymak: ELENDİ. Sessiz hatalar: model/CLI uyumsuzluğu (`ERROR` satırı) VE Windows'ta ~32KB üstü prompt (`Argument list too long`).
  Kural: prompt `codex exec … - < dosya` (stdin), bitiş = çıktıda `tokens used`, `^ERROR` yok; "codex.exe var mı" ile bekleme (başka codex işlemi yanıltır).
- Majör bağımlılık yükseltmesini "testler yeşil" ile kapatmak: ELENDİ (Fastify 5 cors metod regresyonunu yalnız canlı probe yakaladı). Framework'ün kendi bağımlılığı olan paketi `^` ile pinlemek: ELENDİ (exact pin).
- `prisma migrate dev`'in ürettiği migration'ı olduğu gibi uygulamak: ELENDİ, KALICI — PostGIS GiST `Venue_location_idx`'i "drift" sanıp DROP önerir; her migration'da elle çıkar (e2e koruması var).
- `src/` dışından import (tsconfig include=[src]): ELENDİ — rootDir kayar, çıktı `dist/src/main.js` olur, CI smoke kırılır. jest 29 ESM-only transitive'leri parse edemez (Nest 12 ESM-only ⇒ Vitest göçü gerekir, KOŞULLU).
- Okuma-sonra-yazma ile "önceki değeri" kaydetmek (kilitsiz): ELENDİ — koşullu `updateMany` kalıbı; transaction atomikliği kaydedilen öncekinin doğruluğunu sağlamaz.
