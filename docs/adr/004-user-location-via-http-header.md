# ADR 004: Kullanıcı konumu query param yerine X-User-Location header'ında taşınır

Tarih: 2026-07-26

## Bağlam

`docs/AUDIT-2026-07-26.md` bulgusu A2: `GET /v1/venues?lat=...&lng=...` ve
`GET /v1/districts/nearest?lat=...&lng=...` uçları kullanıcı konumunu URL query string'inde
taşıyor. NFR-04 ("kullanıcı koordinatı hiçbir log/analytics çağrısına yazılmaz") bunu ihlal ediyor
— URL'ler reverse proxy/CDN/load balancer access log'larına, tarayıcı geçmişine ve varsayılan
olarak birçok APM/analytics aracına (ör. otomatik "page view URL" yakalayan araçlar) tam haliyle
yazılır. Query param olduğu sürece "bunu loglama" kuralını her ara katmanda ayrı ayrı uygulamak
gerekir — kırılgan ve denetlenemez.

Gerçek REST tasarımı değişikliğine gitmeden (ör. `POST` ile body'de konum, ki bu GET semantiğini
bozar ve keyset pagination/caching'i karmaşıklaştırır) MVP kapsamında çözülmesi gerekiyordu.

## Seçenekler

1. **Query param olarak bırak, her ara katmanda log filtreleme ekle** — artı: kod değişikliği
   minimal. eksi: Nginx/Vercel/Supabase edge log'larının her birinde ayrı filtre kuralı yazmak
   gerekir, üçüncü parti bir katman eklenirse (ör. yeni bir CDN) kural yeniden kurulmalı — NFR-04
   ihlali riski her yeni ara katmanda sıfırdan doğar.
2. **`X-User-Location: lat,lng` custom header'ına taşı** — artı: reverse proxy'lerin varsayılan
   access log formatı (Nginx `combined`, Vercel edge logs) header içeriğini değil sadece
   path+query'yi loglar, yani header'a taşımak varsayılan davranışla NFR-04'ü sağlar; GET semantiği
   korunur, keyset pagination etkilenmez. eksi: tarayıcıdan doğrudan URL çubuğuyla test edilemez
   (curl/Postman/fetch ile header eklemek gerekir), bazı CDN'lerin cache key'i header'ı görmezden
   gelebilir (bu MVP'de public venue listesi zaten kullanıcıya özel olduğu için cache'lenmiyor,
   sorun değil).
3. **`POST /v1/venues/search` body'de konum** — artı: en esnek. eksi: GET'in idempotent/cacheable
   doğasından vazgeçilir, `packages/api-client`'ın tip üretimi ve mevcut `VenueListQuerySchema`
   sözleşmesi baştan yazılır, MVP zaman bütçesine göre orantısız.

## Karar

Seçenek 2 — `X-User-Location: lat,lng` header'ı, `@UserLocationParam()` custom decorator ile
okunur. `VenueListQuerySchema`'dan `lat`/`lng` tamamen kaldırılır; sort-default mantığı
(konum varsa `distance`, yoksa `newest`) Zod şemasından `VenuesService.list()`'e taşınır çünkü
header Zod query-parse aşamasında görünmez.

## Kabul edilen bedel

- `packages/api-client` ve her istemci (`apps/web`, ileride `apps/mobile`) artık konum için ayrı
  bir header-inject adımına ihtiyaç duyuyor — düz `fetch(url)` yeterli değil, `fetchValidated()`'a
  4. bir `headers` parametresi eklendi (Plan 4c, Adım 2).
- Header formatı (`"lat,lng"` düz string) kendi ad-hoc parse mantığımızı gerektiriyor — dış bir
  standart (ör. `Geolocation-Position` gibi resmi bir header) yok, format sözleşmesi bu ADR'dir.
- Swagger/OpenAPI dokümantasyonunda custom header parametreleri query param kadar keşfedilebilir
  değildir — API tüketicileri (ileride üçüncü parti varsa) header'ı query param kadar kolay
  bulamaz. MVP'de tek istemci ekibi olduğu için düşük risk.

## Erken uyarı sinyalleri

- Üçüncü bir CDN/edge katmanı eklendiğinde (ör. Cloudflare) varsayılan access log formatının
  header içeriğini gerçekten loglamadığını **doğrulamadan** production'a almak — her yeni ara
  katmanda bu varsayım tekrar test edilmeli.
- `apps/mobile` (Faz 2, React Native) eklendiğinde native HTTP client'ların header enjeksiyonu
  `fetch`'ten farklı çalışıyorsa (ör. bir kütüphane header'ı sessizce düşürüyorsa) konum filtreleme
  sessizce bozulur — entegrasyon testi olmadan fark edilmez.
- Herhangi bir noktada gerçek log/analytics taramasında (ör. Sentry breadcrumb'ları, Vercel
  fonksiyon logları) `X-User-Location` header değerinin göründüğü tespit edilirse, bu karar
  YANLIŞ demektir — NFR-04 hâlâ ihlal ediliyor, sadece taşınmış.

## Sonuç (sonradan doldurulur)

Tarih: —
Tuttu mu: —
Ne öğrendik: —
