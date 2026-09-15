# Durum — 2026-09-15

## Veri sınırı
Codex: izinli (kişisel proje, kurumsal işaret yok — repo HazarAliyazicioglu/GurmeGo)
GLM: izinli
Kaynak: 2026-09-08 kullanıcı beyanı.

## Kod `master`'da, tam ürün review'ı tamamlandı (2026-09-09/10)
Web/mobile MVP merge edildi (`31284f8`). A'dan Z'ye envanter + vizyon taraması bitti (§1-5).
Tam kayıt: docs/REVIEW-PLAN.md (sentez: §5).

## Ürün vizyonu (2026-09-09)
Hedef kitle: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Marka: sıcak/editöryel
kimlik. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md "Ürün vizyonu" bölümü.

## Şu an neredeyiz
REVIEW-PLAN.md Adım 1-3 bitti (CI, User tablosu, CSV injection). **Yeni faz:**
`docs/DENETIM-RAPORU.md` — 4 uygulama + altyapının taze, ayrıntılı denetimi (53 bulgu:
11 Kritik/28 Orta/14 Düşük), artifact olarak da yayınlandı. Kullanıcı: "önerilen çözümleri
uygula, maliyet 0 olursa iyi olur" — sıra Kritik→Orta→Düşük, gruplar halinde onay.
**Kritik'ten TAMAMLANAN (CI yeşil, `8ddf525`):** CLAUDE.md yanlış beyan düzeltildi; CI artık
web+admin'i de derliyor (turbo.json outputs + CI'da dummy Supabase env'leri, üç app'e
.env.example); web'e generateMetadata (mekan/ilçe) + sitemap.ts/robots.ts eklendi.

## Test altyapısı
`apps/api` e2e'leri gerçek Postgres+PostGIS docker container'a (`gurmego-test-db`, port 5434) karşı çalışıyor, `apps/api/.env` gitignore'lu.

## Sıradaki adım
Kalan Kritik'ler: Backend favoriler rate-limit, Mobile (safe-area, sayfalama, mekan detay
loading/error, mağaza config), Genel Next.js+Fastify güvenlik yükseltmesi (büyük/riskli, ayrı).

## Bloke olanlar: Yok

## Yakın kararlar
- ADR 005: native mobile pivot — bkz. docs/adr/005. Plan 4d/4e: taslak hazır, ertelendi.
- Round 1-3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5.
- Plan 1 mimari kararları: docs/adr/001-004.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2'ye. Gurme Puanı/geniş katkı da Faz 2'de ama artık
  markanın uzun vadeli kimliği sayılıyor — öncelik yeniden bakılabilir.
- Review/red-team'i tek turda bitirmeyi ummak: ELENDİ.
- Cross-session/cross-user guard'larda TEK sinyal kullanmak: ELENDİ — monotonic counter pattern
  proje genelinde tutarlı (tek istisna: mobile auth akışı, REVIEW-PLAN.md §5.2).
- Expo `EXPO_PUBLIC_*` env'lerini dinamik erişimle okumak: ELENDİ. Mobile gerçek Expo dev
  server'da hiç elle denenmemiş (sadece jest).
- CI'nın "yazıldı = çalışıyor" varsayımı: ELENDİ — gerçekten tetiklenip tetiklenmediği ayrıca doğrulanmalı.
- Test'te tarih/gün hesaplarken `new Date().getDay()` (runner'ın yerel saatiyle): ELENDİ — CI UTC
  çalışıyor, İstanbul'la (UTC+3) günde ayrışabiliyor (21:00-23:59 UTC penceresi). Zaman dilimine
  bağlı her hesap açıkça dönüştürülmüş bir Date'ten türetilmeli.
