# Durum — 2026-09-05

## ⚠ Gerçek ilerleme bu branch'te DEĞİL
`master` hâlâ yalnızca spec/tasarım dokümanlarından oluşuyor (kod yok). Gerçek kod ilerlemesi
kilitli bir native worktree'de yaşıyor:
`.claude/worktrees/mvp-backend-foundation` — branch `worktree-mvp-backend-foundation`.
**Her yeni oturumda önce `git worktree list` ile bu worktree'nin hâlâ orada olduğunu doğrula**,
sonra o worktree'ye geçip kendi `docs/STATE.md`'sini oku — asıl güncel durum orada.

## Aktif plan
O worktree'de: Plan 1 ✅24/24, 2 ✅12/12, 3 ✅7/7, 4a ✅3/3, 4b ✅16/16, 4c ✅16/16 — final
review'lar TEMİZ. Task 26 (final whole-branch review düzeltmesi) + Task 27 (Task 26'nın kendi
review'ının bulduğu her şeyin düzeltmesi, 11 Codex turu) **tamamlandı, TEMİZ**. Sıradaki: Plan 4
(Infra/CI/KVKK/pilot). **Hiçbir plan henüz `master`'a merge edilmedi** (kullanıcı kararı — hepsi
bitince tek seferde review edilip merge edilecek).

## Şu an ne yapıyoruz
2026-09-05: Task 27 bitirildi — worktree'nin kendi `docs/STATE.md`'sinde tam detay.

## Sıradaki adım
Kullanıcıya `master`'a merge kararını sor; sonra worktree'ye geçip Plan 4d/4e'ye devam et.

## Bloke olanlar
- Yok.

## Yakın kararlar
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5
- Plan 1 mimari kararları: docs/adr/001-003
- Worktree'nin kendi STATE.md'si: Plan 3 kapsam daraltması, final-review red-team detayları

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü, semantic search/pgvector, geniş kullanıcı katkısı (MVP'de): ELENDİ → Faz 2. KALICI.
- React Native mobil (MVP'de): ELENDİ → web/PWA. KOŞULLU — retention kanıtlanırsa aç.
- Gurme Puanı/yorum-puanlama (MVP'de): ELENDİ. KALICI, Faz 2'ye kadar.
- Root `docs/STATE.md`'yi worktree'deki gerçek ilerlemeyle senkronize etmeden bırakmak: ELENDİ
  (2026-07-25) — tam da bu yüzden bir oturum yanlışlıkla ikinci bir worktree açıp bitmiş işi
  tekrarladı. KALICI kural: worktree'de anlamlı ilerleme olduğunda root STATE.md'ye en azından
  worktree'nin varlığını ve genel durumunu yazan bir işaretçi bırak, tam detayı tekrarlama.
