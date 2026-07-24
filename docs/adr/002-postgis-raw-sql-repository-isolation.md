# ADR 002: PostGIS sorguları Prisma `$queryRaw` ile yalnızca repository katmanında
Tarih: 2026-07-24

## Bağlam
Prisma ORM, PostGIS `geography`/`geometry` tiplerini ve `ST_DWithin`/`ST_Distance`/KNN (`<->`) operatörlerini
native desteklemiyor (yalnızca `Unsupported("geography(Point,4326)")` ile kolon tanımlanabilir, sorgu
yazılamaz). Yakınlık bazlı arama (FR-KA-02, NFR-02: <300ms) ürünün çekirdek işlevi.

## Seçenekler
1. **Prisma'yı tamamen bırak, ayrı bir SQL query builder (Kysely/Slonik) kullan** — artı: tüm sorgular
   tutarlı bir araçla. Eksi: iki farklı veri erişim katmanı (Prisma modelleri + ayrı builder), migration
   hâlâ Prisma'da kalırdı — tutarsız, öğrenme maliyeti yüksek.
2. **Prisma `$queryRaw`, servis katmanında serbestçe kullanılsın** — artı: hızlı yazılır. Eksi: raw SQL
   her yerde dağılır, test edilebilirlik ve okunabilirlik düşer, injection riski disiplin dışına çıkar.
3. **Prisma `$queryRaw`, yalnızca `*.repository.ts` dosyalarında** (seçilen) — artı: servis katmanı hiç
   SQL görmez (test edilebilir, okunabilir), raw SQL tek bir dosya türünde toplanır (code review'da
   arama kolay), `Prisma.sql`/`Prisma.join` template literal'leri parametre **değerlerini** otomatik
   escape eder (klasik string-concatenation injection riskini önemli ölçüde azaltır — ama mutlak güvenlik
   iddiası değil, bkz. kabul edilen bedel). Eksi: repository dosyaları büyüyebilir, PostGIS index kullanımı
   (GIST) manuel doğrulanmalı — Prisma bunu garanti etmez.

## Karar
Seçenek 3. `apps/api/src/venues/venues.repository.ts` PostGIS sorgularının tek adresi
(`docs/superpowers/plans/2026-07-24-mvp-backend-foundation.md` Task 6, 8, 9). `development-guidelines.md §2`
bu kuralı zaten "servis katmanı raw SQL görmez" olarak koymuştu — bu ADR bunu resmileştiriyor.

## Kabul edilen bedel
- `Prisma.sql` template'leri elle yazılan SQL — Prisma'nın tip güvenliği (`prisma.venue.findMany` gibi)
  bu sorgularda yok; satır tipleri (`VenueRow` interface) elle senkronize tutulmalı, şema değişince
  unutulma riski var.
- `Prisma.sql`/`Prisma.join` yalnızca **parametre değerlerini** güvenli hale getirir — sorgunun kendisine
  (kolon adı, tablo adı, `ORDER BY` yönü gibi) kullanıcı girdisinden gelen bir string'in doğrudan
  template'e enjekte edilmesi (`` Prisma.raw(userInput) `` veya string concatenation) bu korumayı bypass
  eder. Bu ADR bunu açıkça yasaklıyor: dinamik identifier/yön değeri gerekiyorsa (ör. `sort` parametresi)
  sabit bir whitelist'ten (`"distance" | "newest"`) seçilip kod içinde eşlenmeli, asla ham string
  interpolasyonuyla sorguya geçirilmemeli (bu zaten Task 6/8'in yaptığı şey — burada resmileştiriliyor).
- GIST index'in gerçekten kullanıldığını (`EXPLAIN ANALYZE`) doğrulamak geliştiricinin sorumluluğunda —
  Prisma bunu otomatik garanti etmiyor, code review checklist'ine eklenmeli (`development-guidelines.md §5`).
- Repository dosyası, standart bir Prisma repository'sinden daha karmaşık — yeni bir geliştirici PostGIS
  bilmeden bu dosyayı değiştiremez (bkz. `postgis` skill zorunluluğu, plan Task 6).

## Erken uyarı sinyalleri
- `venues.repository.ts` 400 satırı geçerse (birden fazla sorumluluk birikmiş demektir) → alt dosyalara
  böl (`venues-search.repository.ts`, `venues-map.repository.ts`).
- Bir PR'da servis katmanında (`venues.service.ts` veya başka bir `.service.ts`) `$queryRaw`/`$executeRaw`
  görülürse → code review'da blokla, bu ADR'yi ihlal ediyor.
- `/venues` p95 gecikmesi 300ms'i (NFR-02) geçerse ve `EXPLAIN ANALYZE` GIST index'in kullanılmadığını
  gösterirse → sorgu yeniden yazılmalı, index stratejisi gözden geçirilmeli.

## Sonuç (sonradan doldurulur)
Tarih: —
Tuttu mu: —
Ne öğrendik: —
