# Durum — 2026-07-26

## Aktif plan
Plan 1 ✅ 24/24, Plan 2 ✅ 12/12, Plan 3 ✅ 7/7, Plan 4a ✅ 3/3, **Plan 4b ✅ 16/16 (backend
düzeltmeleri)** — hepsi task-review'dan geçti, `master`'a henüz merge edilmedi (kullanıcı kararı:
hepsi bitince tek seferde). Detay: `.superpowers/sdd/progress.md` (worktree-lokal, git-ignored).

## Şu an ne yapıyoruz
**Plan 4b TAMAMEN BİTTİ:** 16/16 task + final whole-branch review (Codex, 2 fix turu — round 1'de
3 gerçek bulgu, round 2'de 1 gerçek regresyon + 2 minor, round 3 TEMİZ). Her `code-reviewer`
dispatch'i bu ortamda zaten Codex'e yönleniyor, yani "her zaman cross-model-review çalıştır"
kuralı boyunca zaten sağlanmış — ayrı bir skill çağrısına gerek kalmadı. Tam kayıt
`docs/SESSION-LOG-2026-07-26.md` + `.superpowers/sdd/progress.md`.

## Sıradaki adım
Plan 4c (frontend düzeltmeleri, design doc HAZIR: `docs/superpowers/specs/2026-07-26-frontend-fixes-design.md`)
için `writing-plans` ile implementasyon planı yaz, `plan-red-team`'den geçir, sonra
`subagent-driven-development` ile yürüt — Plan 4b ile aynı süreç.

## Bloke olanlar
- Yok.

## Yakın kararlar
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5. Plan 1-3/4a
  mimari kararları/red-team kayıtları: docs/adr/001-003, ilgili plan/spec dosyaları.

## Ertelenen takip maddeleri (özet — tam liste docs/CHANGELOG.md 2026-07-25 girdisinde)
- **Öncelikli:** Supabase Auth↔Prisma `User` senkronizasyonu yok (trigger eksik) — kayıt olan
  kullanıcı ilk favoriyi eklerken FK hatası alabilir. Pilot açılmadan önce düzeltilmeli.
- Pilot karar metrikleri (Maps/kaydet/paylaş, 4. hafta dönüş) ölçülmüyor; JWT `user_role` claim'i
  gerçek projede custom access token hook gerektirir (lokal doğrulandı) — ayrı işler.
- RateLimitGuard trustProxy yok (x-forwarded-for hiç okunmuyor), Postgres-backed sayaçlar hiç
  temizlenmiyor (86400sn pencere) — Plan 4b'nin e2e testlerinde tekrar tekrar flaky'ye yol açtı,
  gerçek bir CI sağlığı riski. eslint any/unused "warn" kaldı (134 uyarı, bilinçli kabul edildi).
- Plan 2/3: birkaç Minor UI bulgusu, gereksiz (zararsız) çift guard.
- `apps/api/src/common/postgres-cache-store.service.ts` bir `.service.ts` dosyasında `$queryRaw`
  kullanıyor — ADR 002 ihlali (raw SQL yalnız `*.repository.ts`). Plan 4b Task 5 review'ında
  bulundu (2026-07-26), Plan 4b kapsamı dışı, ayrı düzeltilmeli.
- `apps/api/.env.example`'daki varsayılan Supabase portları (54321/54322) bu worktree'nin gerçek
  local stack'iyle (54421/54422) uyuşmuyor, bayat (plan-red-team, 2026-07-26).
- Railway/Vercel/Supabase provisioning + gerçek deploy hazırlığı: hesap açılınca ayrı bir oturumda
  yazılacak (Plan 4a'dan idea-red-team ile bilinçli çıkarıldı — hesapsız doğru yazılamıyordu).

## Denenmiş ve ELENMİŞ yaklaşımlar (özet — gerekçe git log/CHANGELOG'da)
- Tam menü, semantic search, geniş kullanıcı katkısı (MVP'de): ELENDİ → Faz 2. KALICI.
- React Native (MVP'de), Gurme Puanı/yorum (MVP'de), landing page ön-testi: ELENDİ (round 3 kararları).
- Review/red-team'i tek turda bitirmeyi ummak: ELENDİ — Plan 3 final review 4 tur, Plan 4a
  plan-red-team 3 tur gerektirdi, her seferinde küçülen ama gerçek bulgular çıktı. KALICI ders:
  Codex gerçekten TEMİZ/HAZIR diyene kadar kesme.
- `codex exec`'e büyük diff'i (>150KB) argüman olarak verme: ELENDİ (hang/"too long" riski).
  KALICI çözüm: stdin'den pipe et, gerekirse parçalara böl.
- Plan 4a'nın orijinal (staging+manuel gate+Sentry/pino) tasarımı: ELENDİ (idea-red-team NO-GO).
  KALICI ders: bu ölçekte kurumsal CD koreografisi yerine native git-deploy'a güven.
- Bir sözleşme değişikliğini (şema/tip) tüketicisinden farklı task'a koymak: ELENDİ (Plan 4b,
  3 kez aynı hata sınıfı farklı alan çiftlerinde). KALICI: "bunu kim üretiyor, aynı task'ta mı?"
