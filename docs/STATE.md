# Durum — 2026-09-21

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje — repo HazarAliyazicioglu/GurmeGo). Kaynak: 2026-09-08.

## Ürün vizyonu (2026-09-09)
Hedef kitle: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Marka: sıcak/editöryel kimlik. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Şu an neredeyiz
`docs/DENETIM-RAPORU.md` (53 bulgu: 11 Kritik/28 Orta/14 Düşük) uygulanıyor. Kullanıcı 2026-09-21'de
tüm yetkiyi devretti ("planlama, programlama, araştırma sende; vizyona uygun en üst seviye").
**Kritik 11/11 KAPANDI**: son ikisi PR #1 (web+admin Next 16.3.5/React 19.3) ve PR #2 (API
NestJS 11.2.5 + Fastify 5) ile `master`'da; ikisi de Codex ile çapraz-model review'lı, CI yeşil.
Prod `pnpm audit`: 3 critical/50 high → 0 critical/0 high. Yükseltmeler: fastify exact-pin
(5.11.3, platform-fastify ile aynı), `pnpm.overrides` transitive yamalar (kök package.json),
SSR okumalarına bilinçli data-cache TTL (Next 15+ bare fetch'i cache'lemiyor), CORS methods açık.

## Sıradaki adım
Orta bulgular (28): paket paket — API sertleştirme (admin rate-limit, helmet, compress, CSV satır
sınırı, indeksler, audit log) → web → admin → mobil → altyapı. Her paket: TDD → Codex review → PR → CI → merge.

## Test altyapısı
`apps/api` e2e'leri Postgres+PostGIS docker'a (`gurmego-test-db`, port 5434) karşı, `.env` gitignore'lu. Docker Desktop kapalıysa önce aç.

## Bloke olanlar: Yok.
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
- Codex review'ı "çalışıyor" saymak (çıktıyı görmeden): ELENDİ — model/CLI uyumsuzluğu (`gpt-6-astra` vs
  codex 0.144) `ERROR` ile sessizce biter. Çıktıda `^ERROR` yok + gerçek bulgu bloğu var mı bak. CLI 0.155.1'e güncellendi.
- Majör bağımlılık yükseltmesini "testler yeşil" ile kapatmak: ELENDİ — Fastify 5 cors preflight
  methods regresyonunu yalnızca canlı boot + curl yakaladı. Yükseltmede derlenmiş uygulamayı ayağa kaldırıp probe et.
- Framework'ün kendi bağımlılığı olan paketi (fastify) `^` ile pinlemek: ELENDİ — çift tip evreni. Exact pin.
