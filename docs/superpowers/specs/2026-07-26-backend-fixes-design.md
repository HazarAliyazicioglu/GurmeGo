# GurmeGo — Plan 4b: Backend Kritik Düzeltmeler — Design Doc

**Tarih:** 2026-07-26 · **Durum:** Onaylandı (brainstorming + idea-red-team PIVOT sonrası tam
revizyon), idea-red-team round 2'ye hazır

İlgili: [docs/AUDIT-2026-07-26.md](../../AUDIT-2026-07-26.md) (bulguların kaynağı),
[docs/superpowers/specs/2026-07-26-frontend-fixes-design.md](2026-07-26-frontend-fixes-design.md) (kardeş plan — Bölüm 3'teki header sözleşmesi ortak, Bölüm 6'daki `queue-item.tsx` metin güncellemesi bu planın A3 kararına bağımlı)

## 0. Round 1'den Round 2'ye — ne değişti ve neden

İlk tasarım idea-red-team'den **PIVOT** aldı. Codex, her biri gerçek koda karşı bizzat doğrulanmış
şu mimari kör noktaları buldu:

1. **CSV import ayrı bir şema kullanıyor.** `CsvVenueImportRowSchema` (packages/shared), `AdminVenueCreateSchema`'dan
   tamamen bağımsız. "Şemaya status ekle, CSV otomatik destekler" iddiası yanlıştı — CSV'nin
   kendi şemasına da eklemek gerekiyor. **Bu önemli çünkü pilotun 30-45 mekanının asıl giriş yolu
   CSV import** (Postman ile tek tek girmek değil).
2. **`AdminVenuesService.create`/`update`, raw SQL kullanan `VenuesRepository`'ye delege ediyor**
   (ADR 002 — PostGIS `location` kolonu Prisma Client API ile yazılamıyor). İlk tasarımın
   `prisma.$transaction()` + `tx.venue.update()` deseni bu mimariyle **uyumsuzdu** — transaction
   client repository'ye hiç geçmiyordu, snapshot ve gerçek yazma iki ayrı bağlantıda kalıyordu.
3. **`findBySlug` mekanın konumunu (`location`) hiç select etmiyor.** Frontend'in mekan detayında
   gerçek harita göstermesi (Plan 4c) için buna ihtiyaç var — bu, ilk denetimde hiç fark edilmemiş
   bağımsız bir bulgu.
4. **`open_now` tasarımı gerçek veri şekliyle uyuşmuyordu.** Seed/mevcut veri `mon_fri`/`sat_sun`
   gibi iki-kovalı (weekday/weekend) anahtarlar kullanıyor; ilk tasarım `to_char(now(),'Dy')` ile
   `Mon`/`Tue` gibi günlük anahtar arıyordu — hiçbir zaman eşleşmezdi.
5. **`z.coerce.boolean()` klasik tuzağı** — query string `"false"` truthy olduğu için `true`'ya
   coerce olur. Projede zaten bilinen bir çözüm var (CSV şemasındaki `franchiseFlag` deseni).
6. **Cron örneğinde iş adı yoktu** ama test `getCronJob("re-verify-stale")` arıyordu — kendi
   testiyle tutarsız.
7. **`trustProxy: true` "zararsız" değil** — gerçek bir proxy zinciri (Railway) olmadan bunu
   açmak, herkesin sahte `X-Forwarded-For` göndererek rate-limit'i bypass etmesine izin verir.

**Round 2'de kabul edilen kullanıcı kararları:** CSV satırına opsiyonel `status` kolonu eklenir
(varsayılan `PUBLISHED`); cursor pagination bu pilot ölçeğinde ertelenir (`limit` varsayılanı
yükseltilir), gerçek ihtiyaç doğunca ayrıca ele alınır.

## 1. Kapsam ve hedef

`docs/AUDIT-2026-07-26.md`'nin backend bulgularının tamamını, **gerçek mimariye uygun şekilde**
çözer. Amaç: pilotun gerçekten çalışabilmesi.

**Kapsam dışı:** Frontend (Plan 4c), Faz 2, gerçek Railway/Vercel/Supabase provisioning, cursor
pagination (bu pilot ölçeğinde bilinçli ertelendi), `trustProxy` (gerçek proxy zinciri olmadan
güvenli yapılandırılamıyor — Plan 4a'nın provisioning kapsamına taşındı).

## 2. Yayınlama akışı (A1 — iki giriş noktası da düzeltilir)

**Postman/API yolu:** `AdminVenueCreateSchema`/`AdminVenueUpdateSchema`'ya
`status: VenueStatusSchema.optional()` eklenir; `AdminVenuesService.create`'in `status: "DRAFT"`
hardcode'u `input.status ?? "DRAFT"` olur; `update` zaten `...input`'u repository'ye geçtiği için
`status` verilirse otomatik akar.

**CSV import yolu (asıl pilot giriş noktası — kullanıcı kararı):**
- `CsvVenueImportRowSchema`'ya `status: z.enum(["DRAFT", "PUBLISHED"]).optional()` eklenir
  (CSV hücresi boşsa Zod `.optional()` alanı hiç göndermez).
- `AdminVenuesService.importRows()`'daki `this.create({...})` çağrısına `status: row.status ?? "PUBLISHED"`
  eklenir — **varsayılan artık `PUBLISHED`** (kullanıcı kararı: CSV'ye giren veri zaten kürasyon
  ekibi tarafından önceden doğrulanmış kabul edilir).
- `csv-import.service.ts`'nin CSV parse/validate testleri, `status` kolonu olmadan da (varsayılan
  davranış) ve `status=DRAFT` ile de (elle bastırma) test edilir.

## 3. Repository'nin transaction-farkındalığı (A4'ün gerçek ön-koşulu)

**Sorun (round 1 PIVOT bulgusu):** `VenuesRepository`'nin raw-SQL metodları (`createWithLocation`,
`updateWithLocation`) kendi `PrismaService` enjeksiyonunu kullanıyor. Bir `prisma.$transaction()`
bloğu içinde bu repository'yi çağırmak, transaction'ın DIŞINDA bir bağlantıda çalışmak demek —
snapshot transaction içinde, gerçek yazma dışında kalır, biri başarılı diğeri başarısız olabilir.

**Çözüm:** `VenuesRepository`'nin ilgili metodları artık ilk parametre olarak bir Prisma client
(`PrismaService` veya `Prisma.TransactionClient`) alır:

```typescript
// Once:  createWithLocation(input: ...)
// Sonra: createWithLocation(client: PrismaClientOrTx, input: ...)
```

`AdminVenuesService`, normal (transaction'sız) çağrılarda `this.prisma`'yı, A4'ün transaction'lı
akışında `tx`'i geçer. Bu, Prisma'nın "interactive transactions" (`prisma.$transaction(async (tx) => {...})`)
deseniyle raw-SQL repository'lerin birlikte kullanılmasının standart yoludur.

## 4. Kürasyon bütünlüğü: queue onayı + versioning (A3, A4, B8)

**A3 — REPORT onayının anlamı (değişmeyen karar: "onay = rapor haklı, ekip dışarıda düzeltti"):**
- `AdminQueueService.approve()` artık `item.type`'a göre dallanır: `REPORT` → yalnızca
  `ContributionQueue.status = APPROVED` (venue'ye dokunmaz); `EDIT` (re_verify) → mevcut davranış
  (snapshot + `verifiedAt`) korunur.
- **Not (Plan 4c'ye bağımlılık):** Admin panelinin `queue-item.tsx` bileşenindeki "Onayla (yalnızca
  incelendi olarak işaretler ve mekanın verified_at'ini yeniler)" açıklama metni artık **yanlış**
  olacak — Plan 4c bu metni güncellemeli (bkz. kardeş doküman Bölüm 6). Bu, iki planın senkron
  olması gereken tek UI-metni bağımlılığı.

**A4 — Admin manuel update artık gerçekten atomik (Bölüm 3'ün üzerine inşa edilir):**
- `AdminVenuesService.update()` artık `this.prisma.$transaction(async (tx) => { ... })` kullanır:
  (1) `tx.venueVersion.create()` ile güncelleme öncesi state kaydedilir, (2)
  `this.venuesRepository.updateWithLocation(tx, id, { ...input, isBoutique, verifiedAt: new Date() })`
  çağrılır — hem snapshot hem gerçek güncelleme **aynı transaction'da**.
- `revert()` de aynı deseni kullanır: mevcut state'i yeni bir `VenueVersion` olarak kaydedip
  SONRA eski snapshot'ı uygulamak, ikisi tek transaction'da.

**B8 — Shared şema `type:"REPORT"` dışını reddediyor:**
- `AdminQueueItemSchema`'nın `type` alanı `z.enum(["REPORT", "EDIT"])` olur.
- **Netleştirme (round 1'de belirsiz bırakılmıştı):** Admin panelinin `getQueue()` fonksiyonu
  bilinçli olarak yalnızca `type=REPORT` filtreli çalışıyor (Plan 3'ün 2 sayfalık daraltılmış
  kapsam kararı — "gerisi Postman/Prisma Studio'ya bırakıldı"). **Bu plan admin UI'ı EDIT/re_verify
  öğelerini göstermeye zorlamıyor** — küratörler bu öğeleri Postman/Prisma Studio ile görür, tıpkı
  admin panelin kapsamadığı diğer her şey gibi. B8'in tek amacı, şemanın API'nin ürettiği gerçek
  veriyi reddetmemesi (Postman/Prisma Studio kullanan biri için de response valid olmalı).

## 5. Mekan detay konumu (yeni bulgu, round 1 red-team'de keşfedildi)

**Sorun:** `VenuesRepository.findBySlug()`, `location` alanını hiç select etmiyor. Plan 4c'nin
mekan detayında gerçek harita göstermesi için `lat`/`lng` gerekiyor.

**Çözüm:** `findBySlug`, `findInBbox`'ın zaten kullandığı `ST_Y(location::geometry)`/
`ST_X(location::geometry)` desenini tekrar kullanacak şekilde `$queryRaw`'a çevrilir (bugün
`prisma.venue.findFirst` ile Prisma Client API kullanıyor — PostGIS kolonunu select edemediği
için zaten bir raw SQL sorgusuna dönüşmesi gerekiyordu, bu değişiklik hem A1/A4 gibi ADR 002'nin
gerektirdiği deseni hem de eksik alanı tek seferde çözer). Yanıta `lat: number`, `lng: number`
eklenir.

## 6. Şema eksikleri: `address`, `photos`, `open_now` (Plan 4c ile kesişim)

**`address` ve `photos` alanları hiç yok:** Tek migration: `Venue.address String?`,
`Venue.photos String[] @default([])`. Admin create/update şemasına (Postman VE CSV — CSV'de
opsiyonel `address` kolonu, `photos` CSV'de desteklenmez, yalnızca Postman/Prisma Studio'dan
girilir, MVP'de fotoğraf yükleme akışı yok) ve `findBySlug`'ın select listesine eklenir.

**`open_now` (round 2'de gerçek veri şekline göre düzeltildi):**
- `VenueListQuerySchema`'ya `openNow` eklenir — `z.coerce.boolean()` DEĞİL, CSV şemasının
  `franchiseFlag`'inde zaten kullanılan güvenli desen: query string yoksa `undefined`, varsa
  yalnızca `"true"` kabul edilir (`z.literal("true").optional().transform(v => v === "true")`).
- `VenuesRepository.searchPublished`'a eklenen SQL koşulu, **gerçek veri şekliyle** çalışır: bugün
  Pazartesi-Cuma mı Cumartesi-Pazar mı olduğunu `EXTRACT(ISODOW FROM now())` ile bulur (1-5 →
  `mon_fri`, 6-7 → `sat_sun`), `openingHours->>o gün_anahtarı` ile `"HH:MM-HH:MM"` string'ini
  çeker, `now()::time`'ı bu aralıkla karşılaştırır. İstanbul saat dilimi sabit kabul edilir (proje
  genelinde tek şehir/tek dilim varsayımıyla tutarlı).
- **Not:** `openingHours`'un serbest-metin JSON olması (FR-MV-01) nedeniyle her mekan tam olarak
  `mon_fri`/`sat_sun` anahtarlarını kullanmayabilir (kürasyon ekibi elle giriyor) — SQL koşulu bu
  anahtarlar yoksa (`NULL` sonuç) o mekanı "açık/kapalı bilinmiyor" sayıp **filtreden hariç
  tutmaz, dahil eder** (fail-open — bir mekanı yanlışlıkla gizlemek, yanlışlıkla göstermekten
  daha kötü bir kullanıcı deneyimi).

## 7. Diğer veri doğruluğu düzeltmeleri (B4, B5, B6, B9, B10, B11, B12, B13)

- **B4 — Google alanları yazılmıyor:** `VenuesRepository.createWithLocation`/`updateWithLocation`'ın
  raw SQL `INSERT`/`UPDATE` sütun listesine `googleRating`, `googleRatingCount`, `googlePlaceId`
  eklenir (round 1'in "servise ekle" önerisi yanlış katmandaydı — asıl yazma repository'de).
- **B5 — Boutique kuralı PUBLISHED şartı içermiyor:** `BoutiqueService.evaluate()`'e `status`
  parametresi eklenir; `PUBLISHED` değilse sonuç her zaman `false`.
- **B6 — Boutique yalnızca iki alan birlikte gelirse yeniden hesaplanıyor:** `AdminVenuesService.update()`
  kısmi update'lerde eksik alanları güncelleme öncesi `venuesRepository`'den okuyup tamamlar.
- **B9 — Favoriye DRAFT/ARCHIVED eklenebiliyor:** `FavoritesService.addVenue()` önce
  `status === "PUBLISHED"` kontrolü yapar.
- **B10 — En yakın ilçe sorgusu status filtrelemiyor:** raw SQL'e `WHERE v.status = 'PUBLISHED'`.
- **B11 — `lat=0`/`lng=0` "yok" sayılıyor:** boolean check'ler `!== undefined`'a çevrilir.
- **B12 — UUID/bbox doğrulaması eksik:** `bbox` için `BboxQuerySchema` (4 finite sayı, min<max);
  path param UUID'leri için doğrulayan bir pipe.
- **B13 — 401/403 ayrımı:** `RolesGuard`, `user` yoksa `UnauthorizedException` (401), rol
  yetersizse `ForbiddenException` (403). **Round 1 red-team uyarısı dikkate alındı:** mevcut
  testlerde anonim erişim için 403 bekleniyorsa bu testler de güncellenir (bu, spec'e uyum için
  bilinçli bir sözleşme değişikliği, "mevcut testler değişmeden geçmeli" diye yanlış bir kabul
  kriteri konmayacak — writing-plans task'ı bunu açıkça hem kodu hem ilgili testleri güncelleyecek
  şekilde tanımlar).

## 8. Re-verify cron (B3, round 2'de iş adı tutarlılığı düzeltildi)

- `@nestjs/schedule` eklenir; `RuleEngineModule`'e `ScheduleModule.forRoot()`.
- `ReVerifyService`'e `@Cron(CronExpression.EVERY_DAY_AT_3AM, { name: "re-verify-stale" })` —
  isim **açıkça verilir** (round 1'de testin aradığı isim koddaki decorator'da yoktu).
- Test: `SchedulerRegistry.getCronJob("re-verify-stale")` gerçekten kayıtlı olduğunu doğrular.

## 9. Güvenlik sertleştirme (B1, B7, B14, B15, B16)

- **B1 — JWT issuer/audience:** Değiştirilmez (gerçek Supabase projesi kurulana kadar bilinçli
  geçici durum) — yorum netleştirilir, `docs/STATE.md`'nin ertelenen listesindeki referans korunur.
- **B7 — Rate limit hardcode:** Decorator çağrıları `RATE_LIMIT_REPORT_PER_DAY`/
  `RATE_LIMIT_READ_PER_MINUTE` env değişkenlerinden okunan sabitlere çevrilir
  (`common/rate-limit.config.ts`).
- **B14 — Admin `admin` rolü atayabiliyor:** `MVP_ASSIGNABLE_ROLES` → yalnızca `["curator"]`.
- **B15 — `/docs` kimliksiz açık:** Swagger UI yalnızca `NODE_ENV !== "production"` iken monte
  edilir.
- **B16 — Merkezi exception filter (round 1 uyarısı dikkate alındı — mevcut HttpException
  davranışını BOZMAMALI):** Yeni `AllExceptionsFilter`, yalnızca `err instanceof HttpException`
  **DEĞİLSE** devreye girer (Prisma hataları, beklenmeyen her şey) ve `{error:{code,message,details}}`
  formatına çevirir. Var olan `HttpException`'lar (401/403/404/409/429, `Retry-After` header'ı
  dahil) **dokunulmadan** Nest'in kendi mekanizmasına bırakılır — filter bunları hiç ele almaz.

## 10. Test/doğrulama planı

- [ ] Gerçek entegrasyon testi: CSV import ile (status kolonu olmadan) bir mekan yüklenir,
      `GET /venues` listesinde göründüğü doğrulanır (A1'in gerçek kanıtı, CSV yolu üzerinden).
- [ ] Aynı senaryo Postman/API yolu için de (status alanıyla doğrudan create).
- [ ] A4'ün transaction atomikliği: update sırasında repository çağrısı hata fırlatacak şekilde
      mock'lanıp, `VenueVersion`'ın da oluşmadığı (rollback) doğrulanır.
- [ ] `open_now` testi gerçek `mon_fri`/`sat_sun` veri şekliyle yazılır.
- [ ] Cron job kayıt testi (`SchedulerRegistry`).
- [ ] Mevcut tüm testler (401/403 ayrımı nedeniyle güncellenmesi gerekenler hariç, onlar da
      task'ın bir parçası) geçiyor. `tsc --noEmit` ve `pnpm run lint` temiz.

## Global Constraints (writing-plans için taşınacak)

- Rule engine eşikleri asla kodda sabit değer olarak yazılmaz.
- `ContributionQueue` tek giriş noktası olma invariantı bozulmaz.
- PostGIS/pgvector raw SQL yalnızca repository katmanında.
- `X-User-Location` header formatı: `"<lat>,<lng>"` — Plan 4c ile birebir aynı.
- Repository metodlarına transaction client geçirme deseni (Bölüm 3), bu plandan sonra eklenecek
  her yeni raw-SQL yazma işlemi için de emsal teşkil eder.
