# API Sertleştirme (DENETIM-RAPORU Orta paketi A) — Uygulama Planı (v2, red-team sonrası yeniden bölündü)

**Kaynak:** `docs/DENETIM-RAPORU.md` §1.2 (Orta) + §1.3 (Düşük) + REVIEW-PLAN §1.5/§1.6. **ADR:** `docs/adr/006`.
**Süreç:** her task TDD (test → kırmızı → kod) → Codex review → PR → CI → merge. **Ardışık, paralel değil** (tek uygulayıcı);
her adım kendi başına yeşil bırakılır. v1 `plan-red-team`'den **YENİDEN BÖL** aldı (bkz. en alttaki bölüm).

## Global Constraints
- TS strict, `any` yasak (kaçınılmazsa gerekçeli disable). Servis katmanında raw SQL yok (ADR 002).
- **Kullanıcı-ayarlı limitler** (rate limit, CSV satır sınırı) env'den okunur ve boot'ta doğrulanır (`parsePositiveIntEnv`).
  Rule-engine eşikleri (CLAUDE.md) koda gömülmez. Teknik sabitler (örn. compress eşiği) adlandırılmış `const` olabilir.
- Kullanıcı konumu / e-posta / ad / serbest metin PII hiçbir log ve audit kaydına yazılmaz (NFR-04). `actorId` (uuid) izinlidir.
- Yanıt gövdesi sözleşmesi `{ error: { code, message } }` (docs/api-spec.md) her hata yolunda korunur.
- Yalnız `prisma migrate`; şema değişikliği yalnız ekleme, mevcut veriyi bozmaz.
- `fastify` exact-pin 5.11.3 (platform-fastify ile aynı); eklenen `@fastify/*` bununla uyumlu olmalı.

## Bağımlılık grafiği (döngüsüz)
`A1 → {A2, A3}` · `A4 → A5` · `A6`, `A7`, `A8` bağımsız (A1'den sonra) · **PR A tamam & merge → PR B**: `B1 → B2 → B3`.
Dosya-dokunuş matrisi (çakışma = sıralı): `main.ts`: A1,A2,A3 · `rate-limit.guard.ts`/`rate-limit.config.ts`: A4,A5 ·
admin controller'lar: A5,A8,B2,B3 · admin service'ler + spec'leri: B2,B3 · `schema.prisma`: A7,B1.

---
# PR A — `feat/api-hardening-core`

### A1 — `configureApp` / `createAdapter` (kurulumu tek noktaya çek)
**Produces:** `createAdapter(): FastifyAdapter` (`trustProxy: resolveTrustProxy(env)`);
`configureApp(app: NestFastifyApplication): Promise<void>` sırasıyla: `AllExceptionsFilter` (`app.get(HttpAdapterHost)`),
multipart (10 MB limit), helmet (A2), compress (A3), `setGlobalPrefix("v1",{exclude:["health"]})`, `enableCors(buildCorsOptions)`, swagger.
`bootstrap()` = `NestFactory.create(AppModule, createAdapter())` → `configureApp` → `listen`. **Consumes:** `resolveTrustProxy`, `buildCorsOptions`, `AllExceptionsFilter`.
**Geçiş sözleşmesi:** yalnız `test/app.e2e-spec.ts` (+ yeni `test/bootstrap.e2e-spec.ts`) `createAdapter()+configureApp()` kullanır.
Diğer tüm controller/service/e2e spec'leri kendi modül-bazlı kurulumunda **dokunulmadan** kalır (elle multipart kaydedenler dahil) — bilinçli:
gerçek-kurulum güvencesi tek yerde toplanır, birim seviyesi testler hızlı ve izole kalır.
**Kabul:** (1) tüm mevcut testler yeşil; (2) `bootstrap.e2e-spec` gerçek kurulumla: `GET /v1/venues` 200, `GET /health` 200 (prefix dışı),
bilinmeyen rota ⇒ 404 ve gövde `{ error: { code, message } }` (filtre korunmuş), `X-Forwarded-For` `TRUST_PROXY_HOPS` yokken IP'yi değiştirmez.

### A2 — `@fastify/helmet`
`configureApp` içinde; `contentSecurityPolicy` yalnız production'da açık (Swagger UI dev'de inline script ister),
`crossOriginResourcePolicy: { policy: "cross-origin" }`. **Kabul (gerçek kurulumla):** `x-content-type-options: nosniff`,
`x-frame-options`, `referrer-policy`, `strict-transport-security` var; CORS preflight testleri (mevcut `buildCorsOptions`) hâlâ yeşil.

### A3 — `@fastify/compress`
`threshold` adlandırılmış sabit (1024), gzip+br. **Kabul:** `accept-encoding: gzip` + büyük liste ⇒ `content-encoding: gzip`,
açılan gövde ham JSON ile birebir; küçük yanıt sıkıştırılmaz; `vary: accept-encoding`; CORS + helmet başlıkları yanıtta korunur.

### A4 — Rate-limit anahtarı yalnız `req.ip`
`rate-limit.guard.ts`: `req.ip ?? xff ?? "unknown"` ⇒ `req.ip ?? "unknown"`. **Kabul (gerçek `createAdapter()` ile, inject + `remoteAddress`):**
`TRUST_PROXY_HOPS` yokken sahte XFF `req.ip`'yi DEĞİŞTİRMEZ; `=1` iken `req.ip` proxy'nin eklediği en sağ girdi olur ve
istemcinin soldan eklediği sahte girdi (`9.9.9.9, 1.2.3.4` ⇒ `1.2.3.4`) yok sayılır — güvenilmeyen istemci kendi bucket'ını seçemez.

### A5 — Admin rate limit (ortak kota)
**Produces:** `RateLimit(limit, windowSeconds, opts?: { bucket?: string })` **sınıf VE metod** üzerinde kullanılabilir; guard metadata'yı
`getAllAndOverride([handler, class])` ile okur (metod sınıfı ezer); `opts.bucket` verilirse anahtar `${bucket}:${ip}`, verilmezse mevcut
`${Class}:${handler}:${ip}` (geriye uyumlu). `RATE_LIMITS.admin` (`RATE_LIMIT_ADMIN_PER_MINUTE`, 60) ve `RATE_LIMITS.adminImport`
(`RATE_LIMIT_ADMIN_IMPORT_PER_HOUR`, 5, pencere 3600).
**Uygulanacak yerler (tam liste):** 4 admin controller'ın **sınıf** seviyesi: `@UseGuards(RolesGuard, RateLimitGuard)` + `@RateLimit(admin, {bucket:"admin"})`
(queue: list/approve/reject · venues: create/update/revert/import · reports · export · users: assignRole). `POST admin/import` metod-seviyesi
`@RateLimit(adminImport, {bucket:"admin-import"})` (metod sınıfı ezdiği için import yalnız kendi kovasını harcar — bilinçli).
**Consumes:** A4. **Kabul:** aynı IP'den farklı admin uçlarına toplam 61. istek ⇒ 429 + `Retry-After` (ortak kova kanıtı);
import 6. istek/saat ⇒ 429 ve admin kovasını harcamaz; `bucket` yokken favori/rapor uçlarının mevcut testleri değişmeden yeşil.

### A6 — CSV satır sınırı
**Produces:** `CSV_IMPORT_MAX_ROWS` (varsayılan 2000, `parsePositiveIntEnv`). `csv-parse` `to: max+1` ile erken durur; `max+1` kayıt okunursa
`parseRows` `BadRequestException({ error: { code: "CSV_TOO_MANY_ROWS", message } })` fırlatır (imza değişmez). **Kabul:** 2000 satır geçer, 2001 ret;
ret durumunda `venuesRepository.createWithLocation` ve tüm `importRows` yazmaları **hiç çağrılmaz** (mock sayaç = 0).

### A7 — Filtre indeksleri (kanıta bağlı)
Sorgu kalıbı: `status='PUBLISHED' [AND districtId] [AND category|priceRange|isBoutique] ORDER BY createdAt DESC, id DESC`.
**Aday:** `@@index([status, districtId, createdAt(sort: Desc), id(sort: Desc)])`, `@@index([status, category])`.
**Kabul (ölçülebilir):** 5.000 satırlık geçici seed; 3 temsili sorgu (yalnız ilçe · ilçe+category · ilçe+priceRange+isBoutique) için `EXPLAIN (ANALYZE, BUFFERS)`
önce/sonra. İndeks ancak (a) planı o indeksi seçiyorsa VE (b) 3 sorgunun hiçbirinde yürütme süresi baseline'dan kötü değilse eklenir; aksi hâlde eklenmez ve
gerekçe bu plana not düşülür. Sonuç tablosu PR açıklamasında.

### A8 — Küçük düzeltmeler
Rol atama ucu `ZodValidationPipe` kalıbına (`AssignRoleSchema` → `packages/shared`); `RateLimitGuard` ve `ZodValidationPipe` için izole birim testleri;
`app.e2e-spec.ts` eski yorumu güncellenir (A1 ile aynı dosya, A1'de zaten yeniden yazılır).

## PR A — uygulama notları (plandan sapmalar ve ölçümler)
- **A1 kapsam eklemesi (kanıtla):** gerçek-kurulum e2e, framework'ün ürettiği hataların (eşleşmeyen rota 404, oversized gövde, Fastify 4xx — multipart "file too large" **500'e düşüyordu**)
  `{ error: { code, message } }` zarfında olmadığını yakaladı. `AllExceptionsFilter` bunları sarar; bilerek fırlatılan zarflı hatalar dokunulmadan geçer. `docs/api-spec.md` güncellendi.
- **Test ortamı notu:** jest 29, `@fastify/static` zincirindeki ESM-only bir transitive'i ayrıştıramıyor (Nest `require` hatasını yutup "package is missing" diyor). Gerçek-kurulum e2e bu yüzden
  production konfigürasyonuyla (Swagger kapalı) koşar; dev Swagger yolu canlı boot probe'uyla kanıtlanır. **Nest 12 (ESM-only) kararı için kanıt:** test koşucusu göçü (Vitest) gerektirecek.
- **A5:** `RolesGuard` → `RateLimitGuard` sırası; yansıtma testi `AdminModule` grafiğini gezer (yeni admin controller limitsiz çıkamaz). Ortak `RateLimitModule` eklendi; `parsePositiveIntEnv` → `common/env.util.ts` (2 kopya kaldırıldı).
- **A7 ölçüm sonucu (rolled-back transaction, test DB):** 5k satır: Q1 0.605→0.036 ms, Q2 0.401→0.045 ms, Q3 0.244→0.302 ms (gürültü). **50k satır:** Q1 7.703→0.072 ms, Q2 4.548→0.046 ms, Q3 2.919→0.175 ms.
  **Eklendi:** `(status, districtId, createdAt DESC, id DESC)`. **Eklenmedi:** `(status, category)` — yalnız ilçesiz kategori sorgusunu iyileştiriyor (5.9→3.8 ms @50k), uygulama her zaman `districtId` gönderiyor.
  **Tuzak:** `prisma migrate dev` PostGIS GiST `Venue_location_idx`'i "drift" sanıp `DROP INDEX` önerdi; migration'dan elle çıkarıldı, test ile korunuyor. `migration_lock.toml` ilk kez izlendi (Prisma standardı).
  Kalan not: `Venue_status_idx`, bileşik indeksin öneki olduğundan artık gereksiz olabilir; kaldırma ayrı iş (yazma maliyeti/geri dönüş ölçülmeden dokunulmadı).
- **A8:** `AssignRoleSchema` `packages/shared`'da; hangi rolün atanabildiği kuralı serviste kaldı.

---
# PR B — `feat/api-audit-log` (PR A merge edildikten sonra; ADR 006 v2)

### B1 — Şema + `AuditService` (henüz çağıran yok)
**Produces (şema):** `model AuditLog { id, actorId String? (FK YOK), action AuditAction, targetType String, targetId String?, before Json?, after Json?, meta Json?, createdAt }`;
`enum AuditAction { ROLE_ASSIGNED, VENUE_CREATED, VENUE_UPDATED, VENUE_REVERTED, QUEUE_APPROVED, QUEUE_REJECTED, CSV_IMPORT_STARTED, CSV_IMPORTED }`;
indeksler `(actorId, createdAt)`, `(targetType, targetId)`, `(createdAt)`. **Migration ayrıca** `BEFORE UPDATE OR DELETE` ve `BEFORE TRUNCATE` trigger'ı
(`RAISE EXCEPTION 'audit_log is append-only'`) — uygulama rolü dahil her yol için DB-seviyesi append-only.
**Produces (kod):** `AuditService.record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void>` — **yalnız TransactionClient** kabul eder
(tip seviyesinde transaction dışı yazımı engeller). `AuditModule` `@Global()`. **Kabul:** `UPDATE`/`DELETE`/`TRUNCATE` denemesi Postgres hatası verir (e2e);
`record` bir tx içinde kalıcı, tx rollback'inde yok.

### B2 — Tek-kayıtlı işlemlere bağla (atomik)
Kapsam: `assignRole`, venue `create/update/revert`, queue `approve/reject`. Aynı `$transaction` içinde `record`; audit INSERT'i başarısız olursa
**ana işlem de geri alınır (fail-closed, kabul edilen bedel)**. **Değişen imzalar:** `AdminUsersService.assignRole(userId, role, actorId)`,
`AdminVenuesService.create/update/revert(..., actorId)`; `AdminQueueService.approve/reject(id, actorId)` zaten alıyor. `VenueVersion.createdBy = actorId`.
`before`/`after` = alan-düzeyi minimal diff (`{ role }`, değişen alanlar); tam snapshot `VenueVersion`'da.
**Spec geçiş listesi (tam):** `admin-{queue,users,venues}.{controller,service}.spec.ts` (6) + `admin-queue-jwt-guard`, `admin-queue-race`, `admin-venues-rollback`,
`admin-venues-update-race`, `csv-import-visibility` e2e'leri (5). Modül-bazlı kurulumlara `{ provide: AuditService, useValue: { record: jest.fn() } }` eklenir
(`@Global()` yalnız gerçek `AppModule` grafiğini çözer, tekil `createTestingModule`'ları değil). **Kabul:** her aksiyon için tek kayıt; hata ⇒ ne işlem ne kayıt;
`req.user.id` aktör olarak yazılır.

### B3 — CSV: niyet-önce-etki (intent-before-effect)
`importRows` satır-bazlı **kısmi başarı** davranışı KORUNUR (satır atomikliği rapor kapsamı dışı, mevcut ürün kararı). Bu yüzden CSV audit'i tek-transaction değil:
1. **İşlemden önce** `CSV_IMPORT_STARTED` (`meta: { rowCount }`) — kendi tek-ifadelik tx'inde. Başarısız ⇒ import HİÇ başlamaz (fail-closed).
2. `importRows` çalışır (mevcut davranış).
3. **Sonra** `CSV_IMPORTED` (`meta: { created, skipped, errorCount, createdVenueIds (≤ CSV_IMPORT_MAX_ROWS uuid) }` — satır içeriği YOK). Başarısız ⇒
   hata loglanır, yanıt yine döner (etki gerçekleşti; STARTED kaydı girişimi kanıtlar).
**Kabul:** STARTED yazılamıyorsa venue create çağrısı 0; import ortasında hata ⇒ STARTED var, IMPORTED yok (kısmi durumun kalıcı hâli tanımlı ve testli).

---
## Reddedilenler / kapsam dışı (gerekçeli)
- Rate-limit anahtarını kullanıcı-bazlı yapmak: admin trafiği bir-iki kişi; fayda düşük. Yanılırsak: ortak NAT arkasında adminler kotayı paylaşır (60/dk pratikte tetiklenmez).
- Audit'i harici log servisine yazmak: altyapı yok (Plan 4e). Geçiş koşulu ADR 006 sinyallerinde.
- CSV'yi arka plan işine çevirmek: MVP için gereksiz (raporun kendi "diğer seçenek"i).
- Pino/observability: ayrı paket (B'), bu planın dışı. Web/admin güvenlik başlıkları: web ve admin paketlerinde.
- `@fastify/static` kaldırma: **rapor yanlış** (swagger 11 peer'i), yapılmayacak. Dependabot: altyapı paketi. Paralel test güvenliği: raporun kendisi "şimdilik dokunma" diyor.
- Favori liste toplam sınırı: **zaten yapıldı** (`favorites.config.ts`, Kritik paketi) — red-team yalnız rapor metnini gördüğü için eksik saydı.

## Red-team bulguları — reddedilenler (Codex `plan-red-team`, 2026-09-21)
- "T3'ün sabit `threshold: 1024`'ü 'eşikler koda gömülmez' kuralıyla çelişir": **reddedildi.** Gerekçe: CLAUDE.md kuralı *rule-engine* eşikleri içindir; sıkıştırma
  eşiği teknik bir sabit. Global Constraint metnim fazla genişti, daraltıldı. Yanlışsa: 1024 bayt sabiti değiştirmek için kod değişikliği gerekir (düşük bedel).
- "Rol/CSV dışı admin yazmalarını audit'e almak raporun talebini genişletir": **kısmen kabul, bilinçli genişletme.** `VenueVersion.createdBy`'ın her yerde `null` olması
  aynı boşluk; aktör zaten controller'da var, marjinal maliyet düşük. Yanlışsa: gereksiz audit satırları (admin trafiği düşük, zarar sınırlı).
- "Compress'in dayandığı REVIEW-PLAN bölümü verilmediği için doğrulanamaz": **reddedildi**, bilgi eksikliği — REVIEW-PLAN §1 #2 gerekçeyi taşıyor.

## Red-team bulguları — kabul edilenler (özet)
`configureApp`'e `AllExceptionsFilter` eklendi (A1) · geçiş sözleşmesi ve spec listesi yazıldı (A1, B2) · CSV audit = niyet-önce-etki (B3) ·
`record` yalnız `TransactionClient` (B1) · `@RateLimit` sınıf düzeyi + `bucket` (A5) · bağımlılık döngüsü giderildi (grafik) ·
`actorId` FK'sız + DB trigger'ı ile gerçek append-only (B1, ADR 006 v2) · T8 ölçülebilir kabul kriteri (A7) · T2/T5 gerçek-kurulum testleri (A2, A4) · A6 sıfır-yazma testi.

## Interfaces özeti (Consumes/Produces)
| Task | Produces | Consumes |
|---|---|---|
| A1 | `createAdapter`, `configureApp` (filtre dahil) | `resolveTrustProxy`, `buildCorsOptions`, `AllExceptionsFilter` |
| A2, A3 | eklenti kayıtları | A1 |
| A4 | `req.ip`-only anahtar | — |
| A5 | `RateLimit(limit, win, {bucket?})` sınıf+metod, `RATE_LIMITS.admin/.adminImport` | A4 |
| A6 | `CSV_IMPORT_MAX_ROWS`, `CSV_TOO_MANY_ROWS` | `parsePositiveIntEnv` |
| A7 | kanıta bağlı 0–2 indeks | venue list sorgusu |
| A8 | `AssignRoleSchema`, izole testler | — |
| B1 | `AuditLog`, trigger, `AuditService.record(tx, entry)` | `PrismaService` |
| B2 | `actorId` parametreli servis imzaları, dolu `VenueVersion.createdBy` | B1, `AuthenticatedRequest` |
| B3 | `CSV_IMPORT_STARTED`/`CSV_IMPORTED` akışı | B1, B2, A6 |
