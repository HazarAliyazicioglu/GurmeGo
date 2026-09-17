# Durum — 2026-09-17

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje — repo HazarAliyazicioglu/GurmeGo). Kaynak: 2026-09-08.

## Kod `master`'da, tam ürün review'ı tamamlandı (2026-09-09/10)
Web/mobile MVP merge edildi (`31284f8`). A'dan Z'ye envanter+vizyon taraması bitti (§1-5, docs/REVIEW-PLAN.md).

## Ürün vizyonu (2026-09-09)
Hedef kitle: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Marka: sıcak/editöryel kimlik. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Şu an neredeyiz
REVIEW-PLAN.md Adım 1-3 bitti (CI, User tablosu, CSV injection). **Yeni faz:**
`docs/DENETIM-RAPORU.md` — 4 uygulama+altyapının denetimi (53 bulgu: 11 Kritik/28 Orta/14
Düşük), artifact olarak yayınlandı (her bulguda önerilen VE alternatif çözüm var). Kullanıcı:
"önerilen çözümleri uygula, maliyet 0 olursa iyi olur" — sıra Kritik→Orta→Düşük, gruplar
halinde onay. **Kritik'ten TAMAMLANAN, CI yeşil (9/11):** CLAUDE.md yanlış beyan düzeltildi;
CI web+admin'i de derliyor; web'e generateMetadata+sitemap.ts/robots.ts eklendi; backend
favoriler yazma uçlarına rate-limit+üst sınır eklendi; mobilin 4 Kritik'i bitti (safe-area,
sayfalama, mekan detay loading/error, mağaza config). Commit'ler: `ff0c504`,`8ddf525`,
`139eaf5`,`508887e` (bu sonuncunun CI'sı push anında henüz kontrol edilmemişti — önce bak).

## Kullanıcıya SORULACAK açık soru (PC kapatılmadan önce kaydedildi)
Son kalan Kritik bulgu: **Next.js + Fastify güvenlik yükseltmesi** (majör sürüm atlaması,
büyük/riskli). Henüz cevaplanmadı: "Şimdi dikkatli/izole denensin mi (önerilen), yoksa
şimdilik atlanıp Orta bulgulara (28 madde) mi geçilsin?" Cevap gelince sonuç ne olursa olsun
Orta bulgulara aynı akışla devam. Kaynak: docs/DENETIM-RAPORU.md (53 bulgunun tam listesi).

## Test altyapısı
`apps/api` e2e'leri Postgres+PostGIS docker'a (`gurmego-test-db`, port 5434) karşı, `.env` gitignore'lu.

## Bloke olanlar: Yok — sadece yukarıdaki açık soru bekleniyor.

## Yakın kararlar
- ADR 005: native mobile pivot (docs/adr/005). Plan 4d/4e ertelendi. Plan 1 kararları: docs/adr/001-004.
- Round 1-3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2'ye. Gurme Puanı/geniş katkı da Faz 2'de ama artık
  markanın uzun vadeli kimliği sayılıyor — öncelik yeniden bakılabilir.
- Review/red-team'i tek turda bitirmeyi ummak: ELENDİ.
- Cross-session/cross-user guard'larda TEK sinyal kullanmak: ELENDİ — monotonic counter pattern
  proje genelinde tutarlı (tek istisna: mobile auth akışı, REVIEW-PLAN.md §5.2).
- Expo `EXPO_PUBLIC_*` env'lerini dinamik erişimle okumak: ELENDİ. Mobile gerçek Expo dev
  server'da hiç elle denenmemiş (sadece jest).
- CI'nın "yazıldı = çalışıyor" varsayımı: ELENDİ — gerçekten tetiklenip tetiklenmediği ayrıca doğrulanmalı.
- Test'te tarih/gün hesaplarken `new Date().getDay()`: ELENDİ — CI UTC, İstanbul'la (UTC+3)
  günde ayrışabiliyor; zaman dilimine bağlı hesap açıkça dönüştürülmüş Date'ten türetilmeli.
- react-native-safe-area-context'in kendi jest mock'unu (`jest/mock.js`) kullanmak: ELENDİ —
  sadece `default` export set ediyor, named export tüketen kodları (örn. react-navigation) kırıyor.
