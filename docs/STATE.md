# Durum — 2026-07-25

## Aktif plan
Plan 1 ✅ 24/24, Plan 2 ✅ 12/12, Plan 3 ✅ 7/7 — hepsi final review'dan geçti, `master`'a henüz
merge edilmedi (kullanıcı kararı: hepsi bitince tek seferde). Detay: `.superpowers/sdd/progress.md`
(worktree-lokal, git-ignored, git log'da kalıcı).

## Şu an ne yapıyoruz
Plan 4a (Infra/CI) tasarımı: idea-red-team round 1 **NO-GO** (orijinal tasarım 150 kullanıcılık
pilotun önüne gereksiz kurumsal staging/prod CI/CD koreografisi koyuyordu). Kapsam küçültüldü:
yalnızca `packages/shared` build fix + basit Railway/Vercel deploy hazırlığı + provisioning
runbook. Tasarım: `docs/superpowers/specs/2026-07-25-infra-ci-design.md` (red-team bulguları dosya
sonunda).

## Sıradaki adım
Küçültülmüş Plan 4a tasarımını hızlı bir doğrulama red-team turundan geçir, sonra `writing-plans`.

## Bloke olanlar
- Yok.

## Acil: production build kırık (Plan 4a'da çözülecek)
`packages/shared`'ın build adımı yok — `dist/main.js` gerçek Node'da çöküyor (Jest/ts-node bunu
maskeliyor). Geçici çözüm: `npx ts-node -T src/main.ts`. Kalıcı çözüm Plan 4a Bölüm 2'de (tsup).

## Yakın kararlar
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5
- Plan 1 mimari kararları: docs/adr/001-003
- Plan 3 red-team + final-review kayıtları: docs/superpowers/plans/2026-07-25-admin-panel.md sonu
- Plan 4a red-team kayıtları: docs/superpowers/specs/2026-07-25-infra-ci-design.md sonu

## Ertelenen takip maddeleri (özet — tam liste docs/CHANGELOG.md 2026-07-25 girdisinde)
- Pilot karar metrikleri (Maps/kaydet/paylaş, 4. hafta dönüş) hiçbir yerde ölçülmüyor — ayrı plan.
- Auth: JWT `user_role` claim'i gerçek projede custom access token hook gerektirir (lokal doğrulandı).
- RateLimitGuard trustProxy yok, sayaçlar temizlenmiyor; eslint any/unused "warn" kaldı (86 uyarı).
- Plan 1: open-now filtresi yok. Plan 2: E2E kapsamı kısmi, birkaç Minor UI bulgusu.
- Plan 3: birkaç controller'da gereksiz (zararsız) çift guard.

## Denenmiş ve ELENMİŞ yaklaşımlar (özet — gerekçe git log/CHANGELOG'da)
- Tam menü, semantic search, geniş kullanıcı katkısı (MVP'de): ELENDİ → Faz 2. KALICI.
- React Native (MVP'de), Gurme Puanı/yorum (MVP'de), landing page ön-testi: ELENDİ (round 3 kararları).
- Final review'u tek fix turuyla bitirmeyi ummak: ELENDİ — 4 tur gerekti, her tur yeni regresyon
  çıkardı. KALICI ders: Codex gerçekten TEMİZ diyene kadar review loop'u kesme.
- `codex exec`'e büyük diff'i (>150KB) komut satırı argümanı olarak verme: ELENDİ ("Argument list
  too long" / hang riski). KALICI çözüm: stdin'den pipe et, gerekirse parçalara böl.
- Plan 4a'nın orijinal (staging+manuel gate+Sentry/pino bir arada) tasarımı: ELENDİ (idea-red-team
  NO-GO). KALICI ders: bu ölçekte (150 kullanıcı/6 hafta) kurumsal CD koreografisi yerine
  platformların native git-deploy'una güven.
