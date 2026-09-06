# Durum — 2026-09-06

## Kod artık `master`'da
Bugüne kadar kod `.claude/worktrees/mvp-backend-foundation` (branch
`worktree-mvp-backend-foundation`) içinde izole tutuluyordu. Bu tarihte, tüm planlar TEMİZ
review'dan geçtikten sonra kullanıcı onayıyla **`master`'a merge edildi**. Worktree hâlâ diskte
duruyor (silinmedi) ama artık `master`'ın gerisinde kalmış eski bir kopya — yeni işe worktree'den
değil, doğrudan `master`'dan devam et.

## Aktif plan
Plan 1 ✅24/24, 2 ✅12/12, 3 ✅7/7, 4a ✅3/3, 4b ✅16/16, 4c ✅16/16 — final review'lar TEMİZ.
Task 26 (final whole-branch review düzeltmesi) + Task 27 (Task 26'nın kendi review'ının bulduğu
3 MAJOR+5 MINOR'un düzeltmesi, 11 Codex turu) tamamlandı, TEMİZ. Tam ayrıntı: docs/CHANGELOG.md
"2026-09-05 — Task 27" girdisi.

## Şu an ne yapıyoruz
Merge tamamlandı. Sıradaki: Plan 4d (KVKK+event-capture+hesap silme, saf kod) ve Plan 4e (gerçek
provisioning+auth-sync+go-live runbook) — ikisi de tasarım taslağı hâlinde, henüz `idea-red-team`'den
geçmedi.

## Sıradaki adım
Kullanıcıya Plan 4d'nin 4 açık sorusunu ve Plan 4e'nin 3 açık sorusunu sor, sonra ikisini de
`idea-red-team`'den geçir.

## Bloke olanlar
- Yok.

## Yakın kararlar
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5
- Plan 1 mimari kararları: docs/adr/001-004
- admin-queue.service.ts sınırsız fetch kararı + favoriler.tsx GET-vs-create sınırı: kod içi
  yorumlarla belgeli, bilinçli kabul edilmiş MVP trade-off'ları.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search/geniş kullanıcı katkısı/React Native/Gurme Puanı (MVP'de): Faz 2'ye.
- Review/red-team'i tek turda bitirmeyi ummak: ELENDİ — Codex TEMİZ diyene kadar kesme (Task 27
  bunu 11 turda kanıtladı).
- Cross-session guard'larda TEK bir sinyal (token VEYA identity) kullanmak: ELENDİ — "401→signOut"
  kararı TOKEN eşleşmesiyle, "stale-ama-aynı-kullanıcı yanıtı uygula" kararı IDENTITY ile
  verilmeli; karıştırmak yanlış signOut ya da kalıcı UI kilidi üretiyor.
- Cross-session invalidation için plain identity STRING karşılaştırması: ELENDİ — A→B→A
  round-trip'te eski isteğin identity'si tekrar günceli eşleyebilir. SADECE identity değişiminde
  bumplanan, o işleme özel ayrı bir sayaç kullan.
