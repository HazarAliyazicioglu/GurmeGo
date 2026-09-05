# Durum — 2026-09-05

## Tam ayrıntı
Bu dosya 50 satır tavanlı özet. Tam A-Z detay: `docs/SESSION-LOG-2026-07-26.md` +
bu oturumun 20 commit'lik geçmişi (`1ecbb2e..d71cd69`, hepsi `Task 27` etiketli).

## Aktif plan
Plan 1 ✅24/24, 2 ✅12/12, 3 ✅7/7, 4a ✅3/3, 4b ✅16/16, 4c ✅16/16 — final review'lar TEMİZ.
Task 26 (final whole-branch review'ın 1 BLOCKER+4 MAJOR+3 MINOR'unun düzeltmesi) artık
**gerçek Codex'le TEMİZ** (kota engeli geçmişte kaldı). Task 26'nın kendi review'ı 3 MAJOR+5
MINOR daha buldu → **Task 27** olarak düzeltildi: 11 art arda Codex turu (her turda önceki
turun fix'i kendi yeni bulgusunu doğurdu — token-vs-identity ayrımı, A→B→A round-trip, sayaç
"kirletme" gibi inceliklerin hepsi tek tek çözüldü), 11. turda **TEMİZ**. `master`'a hiçbir
plan merge edilmedi (kullanıcı kararı: hepsi bitince tek seferde).

## Şu an ne yapıyoruz
Task 27 bitti. Tüm testler yeşil (API 227/227, web 133/133, admin 68/68), build+typecheck+lint
temiz, gerçek smoke-api.sh PASS. admin-queue.service.ts'nin sınırsız fetch'i (cap yok) ve
favoriler.tsx'in GET-vs-create sıralama sınırı, kullanıcı onayıyla **bilinçli kabul edilmiş
MVP trade-off'ları** olarak koda yorumla belgelendi — düzeltilmedi.

## Sıradaki adım
Kullanıcıya sor: Plan 1-4c + Task 17-27'nin tamamı `master`'a merge edilsin mi (tek seferde,
daha önce kararlaştırıldığı gibi)? Sonra Plan 4d (KVKK+event-capture, 4 açık soru) ve Plan 4e
(provisioning runbook, 3 açık soru) kalan noktaları kullanıcıya sorulup `idea-red-team`'den
geçirilecek.

## Bloke olanlar
- Yok.

## Yakın kararlar
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5
- Plan 1 mimari kararları: docs/adr/001-003
- admin-queue.service.ts sınırsız fetch kararı + favoriler.tsx GET-vs-create sınırı: kod içi
  yorumlarla belgeli (bkz. ilgili dosyalar), ADR gerektirmeyecek kadar dar kapsamlı.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search/geniş kullanıcı katkısı/React Native/Gurme Puanı (MVP'de): Faz 2'ye.
- Review/red-team'i tek turda bitirmeyi ummak: ELENDİ — Codex TEMİZ diyene kadar kesme (Task 27
  bunu 11 turda kanıtladı: her tur bir öncekinin fix'ini kendi yeni bulgusuyla derinleştirdi).
- Cross-session guard'larda TEK bir sinyal (token VEYA identity) kullanmak: ELENDİ — "401 →
  signOut" kararı TOKEN eşleşmesiyle, "stale-ama-aynı-kullanıcı yanıtı uygula" kararı IDENTITY
  ile verilmeli; ikisini karıştırmak ya yanlış signOut ya da kalıcı UI kilitlenmesi üretiyor.
- Cross-session invalidation için plain identity STRING karşılaştırması: ELENDİ — A→B→A
  round-trip'te eski isteğin identity'si tekrar günceli eşleyebilir. Bunun yerine SADECE
  identity değişiminde ve o işlemin kendi başında bumplanan, o işleme ÖZEL ayrı bir sayaç kullan.
