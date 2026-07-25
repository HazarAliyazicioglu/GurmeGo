# Durum — 2026-07-25

## ⚠ Gerçek ilerleme bu branch'te DEĞİL
`master` hâlâ yalnızca spec/tasarım dokümanlarından oluşuyor (kod yok). Gerçek kod ilerlemesi
kilitli bir native worktree'de yaşıyor:
`.claude/worktrees/mvp-backend-foundation` — branch `worktree-mvp-backend-foundation`.
**Her yeni oturumda önce `git worktree list` ile bu worktree'nin hâlâ orada olduğunu doğrula**,
sonra o worktree'ye geçip kendi `docs/STATE.md`'sini oku — asıl güncel durum orada.

## Aktif plan
O worktree'de: Plan 1 (Backend+Data) ✅ 24/24, Plan 2 (Web/PWA) ✅ 12/12, Plan 3 (Admin panel) ✅
7/7 — üçü de final review'dan (Superpowers + zorunlu Codex cross-model) geçti. Sıradaki: Plan 4
(Infra/CI/KVKK/pilot). **Hiçbir plan henüz `master`'a merge edilmedi** (kullanıcı kararı — hepsi
bitince tek seferde review edilip merge edilecek).

## Şu an ne yapıyoruz
2026-07-25: bir önceki oturum session limitine çarpıp yarım kesilmişti (Plan 3 Task 7 ortasında).
Bu oturumda: (1) worktree karışıklığı bulunup çözüldü — yanlışlıkla `master`'da ikinci, gereksiz
bir worktree açılmıştı, silindi; (2) Task 7 gerçek HTTP + gerçek Supabase JWT ile doğrulandı; (3)
zorunlu final review 4 fix/re-review turu gerektirdi (her turda önceki fix kendi regresyonunu
yarattı) — 5. turda TEMİZ. Tam ayrıntı: worktree'nin `docs/STATE.md`'si + `.superpowers/sdd/
progress.md`'si (worktree-lokal, git-ignored ama git log'da kalıcı).

## Sıradaki adım
Worktree'ye geç, Plan 4'e başla: `superpowers:brainstorming` → zorunlu `idea-red-team` (Codex).

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
