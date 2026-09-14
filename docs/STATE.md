# Durum — 2026-09-14

## Veri sınırı
Codex: izinli (kişisel proje, kurumsal işaret yok — repo HazarAliyazicioglu/GurmeGo)
GLM: izinli
Kaynak: 2026-09-08 kullanıcı beyanı — tekrar sorulmayacak.

## Kod `master`'da, tam ürün review'ı tamamlandı (2026-09-09/10)
Web/mobile MVP merge edildi (git log `31284f8`). Sonrasında ilerletme değil, A'dan Z'ye envanter +
1→1.1→...→5 sırayla teknik+vizyon taraması yapıldı, **Bölüm 1-5 hepsi bitti**. Tam kayıt:
docs/REVIEW-PLAN.md (sentez: §5).

## Ürün vizyonu (2026-09-09)
Hedef kitle: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Marka: sıcak/editöryel
kimlik korunup güçlendirilecek. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md "Ürün vizyonu" bölümü.

## Şu an neredeyiz
**Adım 1, 2, 3 TAMAMLANDI — CI yeşil (`f1ac2fc`).** Adım 1: CI fix. Adım 2: `JwtAuthGuard`
artık her geçerli JWT'de `prisma.user.upsert` ile User row'unu lazy-provision ediyor. Adım 3:
`exportVenues('csv')`'daki CSV/Formula Injection açığı kapatıldı (=/+/-/@/tab/CR/LF ile
başlayan string alanlar tek tırnakla kaçırılıyor). Detay: REVIEW-PLAN.md "Aksiyon Günlüğü".

## Test altyapısı
`apps/api` e2e'leri gerçek Postgres+PostGIS docker container'a (`gurmego-test-db`, port 5434) karşı çalışıyor, `apps/api/.env` gitignore'lu.

## Sıradaki adım
Kalan 3 kritik bulgudan (web cache, mobile sign-out, mobile error boundary) hangisi Adım 4 olacak — kullanıcıyla önceliklendirilecek.

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
- Test'te tarih/gün hesaplarken `new Date().getDay()` (runner'ın yerel saatiyle): ELENDİ — CI UTC
  çalışıyor, İstanbul'la (UTC+3) günde ayrışabiliyor (21:00-23:59 UTC penceresi). Zaman dilimine
  bağlı her hesap açıkça dönüştürülmüş bir Date'ten türetilmeli.
