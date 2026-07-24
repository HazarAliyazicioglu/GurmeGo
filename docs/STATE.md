# Durum — 2026-07-24

## Aktif plan
`docs/superpowers/plans/2026-07-24-mvp-backend-foundation.md` — Plan 1/4 (Backend + Data Foundation).
**TAMAMLANDI: 24/24 task.** `subagent-driven-development` ile yürütüldü (worktree:
`mvp-backend-foundation`, branch `worktree-mvp-backend-foundation`). Her task TDD + Claude task-reviewer
(spec+quality) geçti. Sonunda Task 24: Claude whole-branch review (4 Important bulgu, hepsi
düzeltildi) + zorunlu Codex cross-model-review (3 High/Critical bulgu — JWT alg/issuer/audience
eksikti, admin queue approve/reject atomik değildi, revert() venue/version eşleşmesi kontrol
etmiyordu — hepsi düzeltildi ve doğrulandı). Sonuç: 77/77 test geçiyor, tsc temiz, lint 0 hata.
Henüz master'a merge edilmedi — worktree'de duruyor, sıradaki plan(lar) da aynı worktree'de devam
edecek, hepsi bittiğinde tek seferde review edilip merge edilecek.

Yol haritası: 1) Backend+Data ✅ TAMAMLANDI → 2) Web/PWA client (sırada) → 3) Admin panel UI → 4) Infra/CI/KVKK/pilot.

**Teknik notlar:**
- Codex CLI sandbox'ı proje dizini dışındaki dosyaları okuyamıyor — süresiz takılıyor, önce proje içine kopyala.
- Yerel Supabase stack bu worktree'de `npx supabase start` ile ayakta (portlar 54421-54429, `Gastrova`
  adlı başka bir projeyle çakışmayı önlemek için varsayılan 54321-54329'dan kaydırıldı — bkz.
  `supabase/config.toml`). DB: `postgresql://postgres:postgres@127.0.0.1:54422/postgres`.
- Docker Desktop'ın çalışır durumda olması gerekiyor (`npx supabase start` başlatamazsa önce Docker'ı aç).

## Şu an ne yapıyoruz
Kullanıcı Plan 1'i uçtan uca otonom yürütmemi istedi ("sormadan devam et, hata varsa düzelt, arayüzlü
neredeyse çalışan bir app olana kadar bu döngüde devam et"). Plan 1 bu şekilde tamamlandı — 24 task,
her biri gerçek DB'ye/gerçek HTTP isteğine karşı doğrulanarak. Süreçte bulunup düzeltilen önemli
hatalar: Task 6 GIST index kullanılmıyordu (~460x yavaş), Task 16 mekan oluşturma DB'de tamamen
çöküyordu + CSV import Fastify'da hiç çalışmıyordu (ikisi de gerçek DB/HTTP ile doğrulanarak
düzeltildi), Task 9/12/19'da NestJS exception wire-format hatası (3 kez, aynı hata sınıfı — üçüncüsünde
regresyon testiyle kapatıldı), Task 23'te eslint hiç kurulu değildi (CI hiç yeşile geçemezdi) +
turbo.json Turbo 2.x uyumsuzluğu (root-level pnpm run test/lint/typecheck Task 0'dan beri kırıktı).

## Sıradaki adım
Plan 2 (Web/PWA client) — `superpowers:writing-plans` ile yazılacak, sonra `plan-red-team`, sonra
aynı worktree'de `subagent-driven-development` ile yürütülecek. Kullanıcıya sormadan devam.

## Bloke olanlar
- Yok.

## Yakın kararlar
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5
- Plan 1 mimari kararları: docs/adr/001-003
- Plan 1 yürütme kaydı (task-by-task, bulgular, düzeltmeler): worktree'deki
  `.superpowers/sdd/progress.md` (worktree silinirse kaybolur — git log kalıcı kayıt)

## Ertelenen takip maddeleri (Plan 4 / gerçek Supabase projesi kurulunca)
- Rol kaynağı kopuk: AdminUsersService DB'ye User.role yazıyor ama JwtAuthMiddleware rolü JWT'nin
  user_role claim'inden okuyor — gerçek senkron için Supabase custom access token hook gerekiyor.
- Rol string case'i (küçük harf decorator'lar vs. büyük harf Prisma enum) — gerçek JWT claim casing'i
  Supabase projesi kurulunca doğrulanmalı.
- RateLimitGuard req.ip kullanıyor, trustProxy yok — gerçek reverse proxy arkasında tüm kullanıcılar
  aynı IP'yi paylaşabilir. rate_limit_counters satırları hiç temizlenmiyor (yavaş büyüme).
- VenueVersion snapshot'ı yalnızca admin-queue approve() akışında oluşuyor, doğrudan admin CRUD'da değil.
- isBoutique DRAFT durumunda true olabiliyor (kural PUBLISHED gerektiriyor); kısmi update'lerde bayat kalabiliyor.
- REPORT onayı hiçbir düzeltme uygulamadan verifiedAt'i yeniliyor — ürün semantiği sorusu, kullanıcıya sorulmalı.
- eslint no-explicit-any/no-unused-vars "warn" (74 önceden var olan kullanım), "error"a sıkılaştırılmalı.

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü, semantic search/pgvector, geniş kullanıcı katkısı (MVP'de): ELENDİ → Faz 2. KALICI.
- "Butik" tanımı salt DB kuralı: ELENDİ, hâlâ tam ölçülebilir değil — kaynak-linki önerildi (Sorun 3).
- React Native mobil (MVP'de): ELENDİ (round 3) → web/PWA ile pilot. KOŞULLU — retention kanıtlanırsa aç.
- Gurme Puanı/yorum-puanlama (MVP'de): ELENDİ (round 3, 4 ajan+Codex mutabakatı). KALICI, Faz 2'ye kadar.
- Landing page ön-testi: ELENDİ (kullanıcı kararı). KOŞULLU — pilot sonrası Codex'in eşikleri uygulanacak.
