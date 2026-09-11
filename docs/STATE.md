# Durum — 2026-09-11

## Veri sınırı
Codex: izinli (kişisel proje, kurumsal işaret yok — repo HazarAliyazicioglu/GurmeGo)
GLM: izinli
Kaynak: daha önce (2026-09-08, worktree-mobile-theme dalının STATE.md'sinde) kullanıcıya
sorulup yanıtlanmış, buraya taşındı — tekrar sorulmayacak.

## Kod `master`'da, tam ürün review'ı tamamlandı (2026-09-09/10)
Web/mobile MVP merge edildi (git log `31284f8`). Sonrasında ilerletme değil, A'dan Z'ye envanter +
1→1.1→...→5 sırayla teknik+vizyon taraması yapıldı, **Bölüm 1-5 hepsi bitti**. Tam kayıt:
docs/REVIEW-PLAN.md (sentez: §5).

## Ürün vizyonu (2026-09-09)
Hedef kitle: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Marka: sıcak/editöryel
kimlik korunup güçlendirilecek. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md "Ürün vizyonu" bölümü.

## Şu an neredeyiz
Review bitti, §5.5'te önemli bir DÜZELTME yapıldı: önceki "CI sağlam" notu yanlıştı (sadece
ci.yml okunarak varılmış, doğrulanmamıştı). Gerçek Postgres kurup denendi: CI **hiç çalışmamış**
(branch uyuşmazlığı: main yok, GitHub default branch'i stray worktree) ve tetiklense bile 3 e2e
testi seed fixture'ı olmadığı için kırmızı çıkar. §5.1'de artık 6 kritik bulgu var (User tablosu,
web cache, CSV injection, mobile sign-out, mobile error boundary, CI hiç çalışmamış). Kullanıcı
"kritik bulguları sırayla düzelt" dedi — CI bulgusu son eklendi, sıralama netleşmeli.

## Test altyapısı (bu oturumda kuruldu)
`apps/api` için gerçek Postgres+PostGIS test DB'si: docker container `gurmego-test-db`
(postgis/postgis:15-3.4, port 5434). `apps/api/.env` oluşturuldu (gitignore'lu) — e2e testler artık
bu makinede gerçekten çalıştırılabiliyor.

## Sıradaki adım
Kullanıcıyla önceliklendirme: 6 kritik bulgudan hangisi/hangileri önce ele alınacak.

## Bloke olanlar
- Yok.

## Yakın kararlar
- ADR 005: native mobile pivot — bkz. docs/adr/005.
- Plan 4d/4e: taslak hazır, review bitene kadar ertelendi — sıradaki adıma dahil değil henüz.
- Round 1-3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5.
- Plan 1 mimari kararları: docs/adr/001-004.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2'ye. Gurme Puanı/geniş katkı da Faz 2'de ama artık
  markanın uzun vadeli kimliği sayılıyor — öncelik yeniden bakılabilir.
- Review/red-team'i tek turda bitirmeyi ummak: ELENDİ.
- Cross-session/cross-user guard'larda TEK sinyal kullanmak: ELENDİ — monotonic counter pattern
  proje genelinde tutarlı (tek istisna: mobile auth akışı, REVIEW-PLAN.md §5.2).
- Expo `EXPO_PUBLIC_*` env'lerini dinamik erişimle okumak: ELENDİ.
- Mobile gerçek Expo dev server'da hiç elle denenmemiş (sadece jest).
- CI'nın "yazıldı = çalışıyor" varsayımı: ELENDİ — gerçekten tetiklenip tetiklenmediği (branch adı,
  default branch) ayrıca doğrulanmalı, dosya okumak yetmez.
