# GurmeGo — Plan 4b: Backend Kritik Düzeltmeler — Design Doc

**Tarih:** 2026-07-26 · **Durum:** Onaylandı (brainstorming), idea-red-team'e hazır

İlgili: [docs/AUDIT-2026-07-26.md](../../AUDIT-2026-07-26.md) (tüm bulguların kaynağı),
[docs/superpowers/specs/2026-07-26-frontend-fixes-design.md](2026-07-26-frontend-fixes-design.md) (kardeş plan — Bölüm 3'teki header sözleşmesi ortak)

## 1. Kapsam ve hedef

`docs/AUDIT-2026-07-26.md`'nin backend bulgularının (1 CRITICAL + 16 HIGH/MEDIUM) tamamını çözer.
Amaç: pilotun gerçekten çalışabilmesi için gereken minimum düzeltme seti — yeni özellik yok, yalnızca
mevcut MVP spec'inin (prd.md, api-spec.md, rule-engine.md) zaten vaat ettiği davranışı gerçekten
uygulamak.

**Kapsam dışı:** Frontend değişiklikleri (Plan 4c'de), Faz 2 özellikleri, gerçek Railway/Vercel/
Supabase provisioning.

## 2. Yayınlama akışı (A1 — en kritik bulgu)

**Sorun:** `AdminVenueCreateSchema`/`AdminVenueUpdateSchema`'da `status` alanı yok; `admin-venues.service.ts`
her create'i zorunlu `DRAFT` yapıyor. API/admin üzerinden hiçbir mekan `PUBLISHED` olamıyor.

**Çözüm (kullanıcı kararı: şemaya alan ekle, ayrı endpoint değil):**
- `packages/shared/src/schemas/admin-venue.schema.ts`: hem `AdminVenueCreateSchema` hem
  `AdminVenueUpdateSchema`'ya `status: VenueStatusSchema.optional()` eklenir (create'te verilmezse
  varsayılan `DRAFT` kalır — mevcut davranış korunur, kırıcı değişiklik olmaz).
- `admin-venues.service.ts`'nin `create`/`update` metodları artık `input.status` verilmişse onu
  kullanır, verilmemişse (create'te) `DRAFT`'a düşer.
- CSV import (`csv-import.service.ts`) de aynı şemayı kullandığı için otomatik olarak `status`
  alanını destekler hale gelir — ayrıca bir değişiklik gerekmez.

## 3. Konum header'a taşınır (A2 backend tarafı)

**Sorun:** `lat`/`lng` GET query string'de — gerçek hosting'e çıkılınca platform access log'larına
yazılabilir (NFR-04).

**Çözüm (kullanıcı kararı: REST semantiğini bozmadan header'a taşı):**
- Yeni bir NestJS custom decorator: `@UserLocation()` — `X-User-Location: <lat>,<lng>` header'ını
  parse edip `{ lat: number, lng: number } | undefined` döner (format bozuksa `undefined`, hata
  fırlatmaz — konum opsiyonel bir iyileştirme, zorunlu değil).
- `VenuesController.list`/`mapView`, `DistrictsController.findNearest` artık `@Query()`'den
  `lat`/`lng` okumayı bırakıp `@UserLocation()` kullanır.
- **Geriye dönük uyumluluk yok gerekmiyor** — frontend (Plan 4c) aynı anda güncelleniyor, ayrı
  bir istemci yok. Query param desteği tamamen kaldırılır (iki yolu paralel desteklemek gereksiz
  karmaşıklık — YAGNI).
- `VenueListQuerySchema`'dan `lat`/`lng` alanları çıkarılır; `districts/nearest`'in query şeması
  da güncellenir.

## 4. Re-verify cron gerçekten bağlanır (B3)

**Sorun:** `ReVerifyService.enqueueStale()` yazılmış ama hiçbir scheduler'a bağlı değil.

**Çözüm:**
- `@nestjs/schedule` eklenir (`pnpm add @nestjs/schedule`).
- `RuleEngineModule`'e `ScheduleModule.forRoot()` import edilir.
- `ReVerifyService`'e `@Cron(CronExpression.EVERY_DAY_AT_3AM) async handleCron() { await this.enqueueStale(); }`
  eklenir.
- Test: `@nestjs/schedule`'ın `SchedulerRegistry`'sinde cron job'ın kayıtlı olduğu doğrulanır
  (gerçek 24 saat beklemeden — `SchedulerRegistry.getCronJob('re-verify-stale')` ile).

## 5. Kürasyon bütünlüğü: queue onayı + versioning (A3, A4, B8)

**A3 — REPORT onayının anlamı (kullanıcı kararı: "onay = rapor haklı, ekip dışarıda düzeltti"):**
- `AdminQueueService.approve()` artık REPORT tipi için `venue.update({ verifiedAt: new Date() })`
  çağrısını **yapmaz** — yalnızca `ContributionQueue.status = APPROVED` işaretler. `verifiedAt`
  güncellemesi, kürasyon ekibinin raporu okuyup gerekiyorsa yaptığı **ayrı bir admin-venues update**
  çağrısında zaten gerçekleşir (bkz. A4 altında `VenueVersion`+`verifiedAt` orada garantileniyor).
- `re_verify` (EDIT) tipi için davranış **değişmez** — bu tip zaten "bu mekanı kontrol et" anlamına
  geliyor, onaylanması "kontrol ettim, güncel" demek, `verifiedAt` güncellemesi burada doğru.
  Servis artık `item.type`'a göre dallanır: `REPORT` → yalnızca status güncelle; `EDIT` (re_verify)
  → mevcut davranış (snapshot + verifiedAt).

**A4 — Admin manuel update transaction'sız, VenueVersion oluşturmuyor:**
- `AdminVenuesService.update()` artık `prisma.$transaction()` içinde çalışır: (1) güncelleme
  öncesi mevcut venue state'i `VenueVersion` olarak kaydedilir, (2) `Venue.update()` çağrılır ve
  `verifiedAt: new Date()` her zaman set edilir (kürasyon ekibinin elle onayladığı her değişiklik
  "doğrulandı" sayılır — bu, A3'ün "asıl güncelleme burada olur" kararıyla tutarlı).
- Aynı transaction deseni `revert()` metoduna da uygulanır (idea-red-team'in daha önce Plan 1'de
  bıraktığı, `docs/STATE.md`'de kayıtlı "revert öncesi version oluşmuyor" notu da bu task'ta kapanır).

**B8 — Shared şema `type:"REPORT"` dışını reddediyor:**
- `packages/shared/src/schemas/admin-queue.schema.ts`: `AdminQueueItemSchema`'nın `type` alanı
  `z.literal("REPORT")` yerine `z.enum(["REPORT", "EDIT"])` olur. Admin panelin (Plan 4c) queue
  UI'ı zaten yalnızca REPORT'u render ediyordu (bilinçli MVP kararı) — bu şema değişikliği onu
  bozmaz, yalnızca EDIT tipi kayıtların API yanıtında reddedilmemesini sağlar.

## 6. Şema eksikleri: `address` alanı ve `open_now` filtresi (Plan 4c ile kesişim)

**`address` ve `photos` alanları hiç yok (audit'te ayrı madde değildi, doküman-karşılaştırmasında
bulundu):** FR-MV-01/FR-MD-01 "adres" ve "fotoğraflar" istiyor ama `Venue` modelinde ikisi de yok
(yalnızca PostGIS `location` var, insan okunur adres metni veya fotoğraf referansı yok). Tek bir
migration ile ikisi birden eklenir: `Venue.address String?`, `Venue.photos String[] @default([])`.
Admin create/update şemasına ve repository'nin `findBySlug` select listesine eklenir. Plan 4c'nin
mekan detay sayfası bu alanları gösterecek — bu yüzden bu task Plan 4c'den ÖNCE bitmiş olmalı.
(Fotoğrafların gerçek yüklenmesi/Supabase Storage entegrasyonu bu planın kapsamında değil — alan
şimdilik admin panelden elle URL girilerek doldurulur, gerçek upload akışı ayrı bir iş.)

**`open_now` filtresi (Plan 1'den beri bilinen eksik, `docs/STATE.md`'de kayıtlıydı, Plan 4c bunu
kullanacağı için burada da ele alınıyor):** `VenueListQuerySchema`'ya `openNow: z.coerce.boolean().optional()`
eklenir; `VenuesRepository.searchPublished`, `openingHours` JSON'ını mevcut gün/saate göre
karşılaştıran bir SQL koşuluyla filtreler (basit bir yaklaşım: `openingHours` her gün için
`"HH:MM-HH:MM"` string'i tutuyor — `to_char(now(), 'Dy')` ile günü bulup string aralığını
`now()::time` ile karşılaştırmak yeterli, saat dilimi İstanbul sabit kabul edilir, MVP'de
çoklu saat dilimi yok).

## 7. Veri doğruluğu düzeltmeleri (A5, B4, B5, B6, B9, B10, B11, B12, B13)

- **A5 — Cursor pagination:** `VenuesRepository.searchPublished`, `cursor` parametresi verildiğinde
  onu decode edip (`{ lastId }`) `WHERE v.id > lastId` benzeri bir keyset koşuluna çevirir (mevcut
  `ORDER BY` ile tutarlı yönde). Cursor yoksa mevcut davranış (ilk sayfa).
- **B4 — Google alanları yazılmıyor:** `admin-venues.service.ts`'nin create/update'i artık
  `googleRating`/`googleRatingCount`/`googlePlaceId`'yi de Prisma `data` objesine dahil eder.
- **B5 — Boutique kuralı PUBLISHED şartı içermiyor:** `BoutiqueService.evaluate()`'e `status`
  parametresi eklenir; `status !== "PUBLISHED"` ise sonuç her zaman `false`.
- **B6 — Boutique yalnızca branchCount+franchiseFlag birlikte gelirse yeniden hesaplanıyor:**
  `AdminVenuesService.update()` artık kısmi update'lerde eksik alanları **mevcut DB kaydından**
  okuyup tamamlar, sonra `BoutiqueService.evaluate()`'i her zaman tam bilgiyle çağırır.
- **B9 — Favoriye DRAFT/ARCHIVED eklenebiliyor:** `FavoritesService.addVenue()` önce venue'nün
  `status === "PUBLISHED"` olduğunu kontrol eder, değilse `404 VENUE_NOT_FOUND` döner.
- **B10 — En yakın ilçe sorgusu status filtrelemiyor:** `DistrictsRepository`'nin raw SQL'i
  `WHERE v.status = 'PUBLISHED'` koşulu alır.
- **B11 — `lat=0`/`lng=0` "yok" sayılıyor:** Boolean check'ler (`if (filters.lat && filters.lng)`)
  `!== undefined` kontrolüne çevrilir (İstanbul için pratik etkisi yok ama doğru davranış).
- **B12 — UUID/bbox/enum doğrulaması eksik:** `bbox` query'si için yeni bir Zod şeması
  (`BboxQuerySchema`: 4 finite sayı, min<max) eklenir; `venueId`/`districtId` gibi path param'lar
  `z.string().uuid()` ile doğrulanan bir pipe'tan geçer.
- **B13 — Auth yokken 401 yerine 403:** `RolesGuard`, `user` yoksa (`!user`) `UnauthorizedException`
  (401) fırlatır; `user` var ama rolü yetersizse `ForbiddenException` (403) fırlatır — spec'in
  ayrımını karşılar.

## 8. Güvenlik sertleştirme (B1, B2, B7, B14, B15, B16)

- **B1 — JWT issuer/audience yoksa sessizce atlanıyor:** Bu davranış **gerçek Supabase projesi
  kurulana kadar** (Plan 4a'nın provisioning kapsamı) bilinçli bir geçici durumdur — kod zaten
  bunu yorumla belirtiyor. Bu task'ta değiştirilmez (gerçek projeyle test edilemeyecek bir "fail-
  closed" davranışı şimdiden zorlamak, local dev/CI'ı kıracaktır); yalnızca yorum, bunun bir
  "TEMPORARY, provisioning'de kapatılacak" öğe olduğunu daha açık işaretleyecek şekilde güncellenir
  ve `docs/STATE.md`'nin ertelenen listesine (zaten orada) referans eklenir.
- **B2 — `trustProxy` yok:** `main.ts`'teki Fastify adapter'a `trustProxy: true` eklenir (Railway/
  Vercel gibi platformların arkasında `X-Forwarded-For`'u doğru okuması için — gerçek hosting
  olmadan da zararsız, local dev'de etkisi yok).
- **B7 — Rate limit değerleri hardcode:** `RateLimit(10, 86400)`, `RateLimit(100, 60)` gibi
  decorator çağrıları, `RATE_LIMIT_REPORT_PER_DAY`/`RATE_LIMIT_READ_PER_MINUTE` gibi env
  değişkenlerinden okunan sabitlere çevrilir (`common/rate-limit.config.ts` yeni dosya).
- **B14 — Admin `admin` rolü atayabiliyor:** `AdminUsersService.assignRole()`'daki
  `MVP_ASSIGNABLE_ROLES` listesi `["curator"]`'a indirilir (mevcut kod `["curator", "admin"]`).
- **B15 — `/docs` kimliksiz erişime açık:** `SwaggerModule.setup` çağrısı `RolesGuard`+`Roles("admin")`
  ile korunan bir route'a taşınır (basit yaklaşım: `/docs` prefix'ini `main.ts`'te manuel guard
  kontrolüyle sarmalamak yerine, Swagger UI'ı yalnızca `NODE_ENV !== "production"` iken monte
  etmek — pilot ölçeğinde production'da API dokümantasyonuna dışarıdan ihtiyaç yok).
- **B16 — Merkezi exception filter yok:** Yeni bir `AllExceptionsFilter` (`@Catch()`) eklenir;
  Prisma'nın `PrismaClientKnownRequestError`'ını (unique constraint, not found vb.) ve
  yakalanmamış diğer hataları `{error:{code,message,details}}` formatına çevirir, `main.ts`'te
  `app.useGlobalFilters(new AllExceptionsFilter())` ile bağlanır.

## 9. Test/doğrulama planı

Her düzeltme kendi TDD döngüsünden geçer (writing-plans'ta task bazlı). Planın genel kabul
kriteri:
- [ ] Gerçek bir smoke senaryosu: admin API'den bir mekan `PUBLISHED` olarak oluşturulur,
      `GET /venues` listesinde göründüğü doğrulanır (A1'in gerçek kanıtı).
  Bunun için de var olan `scripts/smoke-api.sh`'yi genişletmek yerine ayrı, odaklı bir entegrasyon
  testi yazılır (Jest, gerçek local Postgres'e karşı).
- [ ] Mevcut tüm testler (Plan 1-3'ten kalan) hâlâ geçiyor.
- [ ] `tsc --noEmit` ve `pnpm run lint` temiz.

## Global Constraints (writing-plans için taşınacak)

- Rule engine eşikleri asla kodda sabit değer olarak yazılmaz (mevcut proje kuralı, B7 bunu rate
  limit'e de genişletiyor).
- `ContributionQueue`'yu atlayıp kullanıcı katkısını doğrudan `Venue`'ye yazma yasak — bu planın
  hiçbir task'ı bu invariantı bozmaz (queue hâlâ tek giriş noktası, yalnızca approve'un DAVRANIŞI
  düzeliyor).
- PostGIS/pgvector raw SQL yalnızca repository katmanında.
- `X-User-Location` header formatı: `"<lat>,<lng>"` (virgülle ayrılmış iki ondalık sayı) — Plan 4c
  ile birebir aynı sözleşme, iki tarafta da bu formatta sabit.
