# ADR 003: Public API ve admin API tek NestJS monolitinde, ayrı servis değil
Tarih: 2026-07-24

## Bağlam
Kürasyon ekibi (2-3 kişi) admin uçlarını (`/admin/*`) kullanacak, genel kullanıcılar public uçları
(`/venues`, `/districts`, `/me/lists`) kullanacak. İkisi de aynı veri modelini (Venue, ContributionQueue)
paylaşıyor.

## Seçenekler
1. **Ayrı admin servisi** (ayrı NestJS app, ayrı deploy) — artı: blast radius izolasyonu (admin'de hata
   public'i etkilemez), bağımsız ölçekleme. Eksi: iki deploy pipeline, iki servis arası veri tutarlılığı
   sorunu (aynı Prisma şemasını iki yerden migrate etmek riski), MVP ölçeğinde (6 haftalık pilot, 2-3
   kişilik kürasyon ekibi) gereksiz operasyonel karmaşıklık.
2. **Tek NestJS app, `RolesGuard` ile ayrım** (seçilen) — artı: tek deploy, tek şema kaynağı, MVP
   ölçeğinde admin trafiği ihmal edilebilir (haftada birkaç yüz istek). Eksi: admin ve public kod aynı
   process'te — admin tarafında bir bellek sızıntısı/sonsuz döngü teorik olarak public trafiği de
   etkileyebilir; admin'e özel bir güvenlik açığı tüm API'yi etkiler (blast radius public'e sızar).

## Karar
Seçenek 2. `docs/superpowers/plans/2026-07-24-mvp-backend-foundation.md` Task 14-19 admin modüllerini
aynı `apps/api` içinde `AdminModule` altında topluyor, `RolesGuard` + `@Roles("curator","admin")` ile
korunuyor (`architecture.md §7`, `api-spec.md §5`de zaten "ayrı servis yok (MVP kararı)" olarak belirtilmişti
— bu ADR o kararı resmileştiriyor).

## Kabul edilen bedel
- Admin uçlarındaki bir performans sorunu (ör. CSV import büyük dosya, `data-quality` raporu ağır sorgu)
  public trafiği de yavaşlatabilir — process paylaşımlı (aynı Node event loop, aynı Prisma connection pool).
- Admin'e özel bir güvenlik zafiyeti (ör. `RolesGuard` bypass, JWT rol claim sahteciliği) teorik olarak
  tüm API'ye erişim açar. **Not:** ayrı bir servis olsaydı bile aynı Postgres veritabanını/aynı DB
  kimlik bilgilerini paylaşacağı için blast radius otomatik olarak daralmazdı — gerçek izolasyon için
  ayrı DB kullanıcısı/şeması da gerekirdi, bu ADR'nin kapsamı bunu içermiyor; "ayrı servis" tek başına
  varsayıldığı kadar güçlü bir izolasyon garantisi değil, bunu abartmayalım.
- Bağımsız ölçekleme yok — admin trafiği artsa da (olası değil, 2-3 kişilik ekip) public ile birlikte
  ölçeklenir.

## Erken uyarı sinyalleri
- Admin uçlarının (özellikle CSV import, `/admin/export`) p95 gecikmesi 1 saniyeyi geçip aynı zaman
  aralığında public uçların p95'i de NFR-02 hedefinin (300ms) üzerine çıkarsa (Sentry/Railway log
  korelasyonuyla ölçülür, ikisi birlikte gözlenmeli — sadece admin yavaşlaması tek başına yeterli sinyal
  değil) → ayrı servise böl.
- Kürasyon ekibi 2-3 kişiden büyüyüp admin trafiği günlük 1.000+ isteğe çıkarsa (mekan sayısı Faz 2'de
  30-45'ten büyürse) → ayrı servis değerlendirilmeli.
- `security-review`de `RolesGuard`'ın bypass edilebildiği somut bir senaryo (ör. eksik guard, yanlış
  decorator sırası) bulunursa → izolasyon değil, önce guard'ı düzelt; izolasyon yalnızca "guard doğru ama
  yine de admin süreç çökerse public'i de düşürür" tipi bir olay yaşanırsa önceliklenir.

## Sonuç (sonradan doldurulur)
Tarih: —
Tuttu mu: —
Ne öğrendik: —
