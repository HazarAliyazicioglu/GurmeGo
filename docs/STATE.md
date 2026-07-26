# Durum — 2026-07-26

## Aktif plan
Plan 1 ✅ 24/24, Plan 2 ✅ 12/12, Plan 3 ✅ 7/7, **Plan 4a ✅ 3/3 (shared build fix)** — hepsi final
review'dan geçti, `master`'a henüz merge edilmedi (kullanıcı kararı: hepsi bitince tek seferde).
Detay: `.superpowers/sdd/progress.md` (worktree-lokal, git-ignored, git log'da kalıcı).

## Şu an ne yapıyoruz
Plan 4a bitti. Plan 4b (backend düzeltmeleri, `docs/superpowers/plans/2026-07-26-backend-fixes.md`,
16 task) yazıldı ve plan-red-team'den 6 tur sonunda geçti (Codex, `docs/SESSION-LOG-2026-07-26.md`'de
tam kayıt) — metin-bazlı red-team döngüsü bilinçli olarak kesildi, kalan küçük sınırlamalar plana
açıkça yazıldı, implementasyona geçildi. Kullanıcının "sormadan devam et" talimatı (2026-07-26)
uyarınca `subagent-driven-development` ile yürütülüyor.

## Sıradaki adım
Plan 4b'yi `subagent-driven-development` ile Task 1'den başlayarak yürüt. Her task: implementer
subagent → task reviewer (spec+kalite) → gerekirse düzeltme. Bitince final whole-branch review +
zorunlu `cross-model-review` (Codex). Sonra Plan 4c (frontend düzeltmeleri, design doc zaten HAZIR:
`docs/superpowers/specs/2026-07-26-frontend-fixes-design.md`) aynı süreçle yazılacak.

## Bloke olanlar
- Yok.

## Yakın kararlar
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5. Plan 1 mimari
  kararları: docs/adr/001-003.
- Plan 3/4a red-team + final-review kayıtları: docs/superpowers/plans/2026-07-25-admin-panel.md,
  docs/superpowers/specs/2026-07-25-infra-ci-design.md, docs/superpowers/plans/2026-07-26-shared-build-fix.md

## Ertelenen takip maddeleri (özet — tam liste docs/CHANGELOG.md 2026-07-25 girdisinde)
- **Öncelikli:** Supabase Auth↔Prisma `User` senkronizasyonu yok (trigger eksik) — kayıt olan
  kullanıcı ilk favoriyi eklerken FK hatası alabilir. Pilot açılmadan önce düzeltilmeli.
- Pilot karar metrikleri (Maps/kaydet/paylaş, 4. hafta dönüş) hiçbir yerde ölçülmüyor — ayrı plan.
- Auth: JWT `user_role` claim'i gerçek projede custom access token hook gerektirir (lokal doğrulandı).
- RateLimitGuard trustProxy yok, sayaçlar temizlenmiyor; eslint any/unused "warn" kaldı (86 uyarı).
- Plan 1: open-now filtresi yok. Plan 2/3: birkaç Minor UI bulgusu, gereksiz (zararsız) çift guard.
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
- Derlenmiş barrel export'ta string arayan `grep` ile doğrulama: ELENDİ (false-negative — `export *`
  runtime'da `__exportStar` loop'una derleniyor). KALICI çözüm: gerçek `require()`+property-check.
