# Durum — 2026-07-25

## Aktif plan
Plan 1 ✅ (24/24), Plan 2 ✅ (12/12), **Plan 3 ✅ (7/7, final review 4 fix/re-review turundan sonra
temiz)** — hepsi tamamlandı. Detay: `.superpowers/sdd/progress.md` (worktree-lokal, git-ignored).
Sıradaki: Plan 4 (Infra/CI/KVKK/pilot) — henüz başlamadı.

## Şu an ne yapıyoruz
Plan 3 Task 7'yi (yarım kalmış oturumdan devam) bitirdik: kritik Fastify guard bug'ı gerçek HTTP +
gerçek Supabase JWT ile doğrulandı, ardından zorunlu final review (Superpowers/Codex-routed +
bağımsız ikinci Codex geçişi) 4 fix/re-review turu gerektirdi — her turda önceki fix'in kendisi
yeni bir regresyon çıkardı (bkz. Denenmiş/ELENMİŞ altında not), son turda TEMİZ verdi. Hiçbir plan
henüz `master`'a merge edilmedi (kullanıcı kararı, değişmedi — hepsi bittiğinde tek seferde review
edilip merge edilecek).

## Sıradaki adım
Plan 4'e (Infra/CI/KVKK/pilot) geç: `superpowers:brainstorming` ile başla, `idea-red-team`
çalıştırmayı unutma (önceki planlarda olduğu gibi zorunlu).

## Bloke olanlar
- Yok.

## Acil: production build kırık (Plan 2 Task 11'de keşfedildi, hâlâ çözülmedi)
`packages/shared`'ın build adımı yok — `apps/api`'nin derlenmiş `dist/main.js`'i VE `pnpm run
start:dev` Node'un native TS type-stripping'i altında extensionless import'lar yüzünden çöküyor.
Plan 4'ten önce çözülmeli: `packages/shared`'a bir build adımı (tsc/tsup) eklenip `apps/api`'nin
ona derlenmiş çıktı üzerinden bağımlı olması gerekiyor. Geçici çözüm (yalnızca lokal test için):
`npx ts-node -T src/main.ts`.

## Yakın kararlar
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5
- Plan 1 mimari kararları: docs/adr/001-003
- Plan 3 kapsam daraltması + red-team kayıtları: docs/superpowers/specs/2026-07-24-admin-panel-design.md,
  docs/superpowers/plans/2026-07-25-admin-panel.md'nin sonundaki "Red-team bulguları" bölümü
- Yürütme kayıtları (task-by-task): `.superpowers/sdd/progress.md` (worktree-lokal, git log kalıcı)

## Ertelenen takip maddeleri (Plan 4 / gerçek Supabase projesi kurulunca)
- Rol kaynağı kopuk: DB'ye User.role yazılıyor ama JWT'nin user_role claim'i gerçek bir custom
  access token hook gerektiriyor — Plan 3 Task 7'de LOKAL olarak bunu geçici kurup doğruladık
  (2026-07-25'te tekrar doğrulandı), gerçek projede kalıcı kurulması gerekiyor.
- RateLimitGuard req.ip kullanıyor, trustProxy yok. rate_limit_counters hiç temizlenmiyor.
- VenueVersion snapshot'ı yalnızca admin-queue approve() akışında oluşuyor.
- isBoutique DRAFT'ta true olabiliyor, kısmi update'lerde bayat kalabiliyor.
- REPORT onayı düzeltme uygulamadan verifiedAt'i yeniliyor — ürün semantiği sorusu.
- eslint no-explicit-any/no-unused-vars "warn", "error"a sıkılaştırılmalı (86 pre-existing warning).
- Plan 1: açık/kapalı (open-now) filtresi hiç implemente edilmedi.
- Plan 2 final review Minor bulguları: E2E suite 2/4-5 senaryo, useGeolocation iki kez mount
  oluyor, setVenues'ta sıra koruması yok.
- Plan 2 Task 9: FavoriteButton'da double-click guard yok.
- CSV import (Plan 3): şema kısmen packages/shared'a taşındı ama category/branchCount/
  openingHours validator'ları paylaşılan ortak kaynağa çıkarıldı (2026-07-25 fix'inde çözüldü) —
  bu madde artık kapalı, referans için bırakıldı.

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü, semantic search/pgvector, geniş kullanıcı katkısı (MVP'de): ELENDİ → Faz 2. KALICI.
- React Native mobil (MVP'de): ELENDİ (round 3) → web/PWA. KOŞULLU — retention kanıtlanırsa aç.
- Gurme Puanı/yorum-puanlama (MVP'de): ELENDİ (round 3). KALICI, Faz 2'ye kadar.
- Landing page ön-testi: ELENDİ (kullanıcı kararı).
- Plan 3'ün orijinal 6 sayfalı admin app kapsamı: ELENDİ (idea-red-team NO-GO + kullanıcı kararı)
  → 2 sayfaya daraltıldı. KALICI.
- Final review'da tek fix turuyla bitirmeyi ummak: ELENDİ (2026-07-25, Plan 3 Task 7). 4 fix/
  re-review turu gerekti, her turda önceki fix kendi regresyonunu yarattı (özellikle kuyruk
  sayfasının error-state mantığı 4 kez dokunuldu). KALICI ders: review loop'u "muhtemelen
  temizdir" varsayımıyla erken kesme — Codex gerçekten TEMİZ diyene kadar devam et, özellikle
  aynı dosya/state mantığı birden fazla kez düzeltiliyorsa (bu, regresyon riskinin arttığının
  işareti, azaldığının değil).
- `codex exec`'e tek seferde büyük diff (>150KB) verme: ELENDİ (2026-07-25). Komut satırı argümanı
  olarak embed edildiğinde "Argument list too long", dosya okutulduğunda ise süresiz hang/timeout
  riski var. KALICI çözüm: diff'i stdin'den pipe et (`codex exec --skip-git-repo-check - < prompt.txt`),
  gerekirse mantıksal parçalara böl (apps/api vs apps/admin gibi).
