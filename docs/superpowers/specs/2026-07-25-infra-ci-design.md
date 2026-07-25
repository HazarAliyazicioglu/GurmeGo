# GurmeGo — Plan 4a: Infra/CI Hazırlığı — Design Doc

**Tarih:** 2026-07-25 · **Durum:** Onaylandı (brainstorming), plan yazımına hazır

İlgili: [infrastructure.md](../../infrastructure.md), [development-guidelines.md](../../development-guidelines.md), [STATE.md](../../STATE.md)

## 1. Kapsam ve hedef

Roadmap'in 4. planı ("Infra/CI/deployment + KVKK texts + pilot launch checklist") ikiye bölündü:
bu doküman yalnızca **4a (Infra/CI)**'yı kapsıyor — mühendislik tarafı. 4b (KVKK metinleri + pilot
launch checklist), hukuki/operasyonel nitelikte olduğu için ayrı bir brainstorming turunda ele
alınacak.

4a şunu üretir:
1. `packages/shared`'ın prod build'i kırık olma sorununu (`docs/STATE.md`'nin işaretlediği acil
   madde) `tsup` ile çözer.
2. Mevcut PR-gate CI'ının (Plan 1 Task 23'te kurulan `.github/workflows/ci.yml`) `apps/web` ve
   `apps/admin`'i de gerçekten kapsadığını doğrular, kapsamıyorsa tamamlar.
3. `infrastructure.md §4`'teki tam CI/CD akışını (main'e merge → staging deploy + smoke test →
   manuel onaylı prod deploy) GitHub Actions'a **secret'sız çalışamayacak ama syntax olarak hazır**
   halde ekler.
4. Railway (API) için bir `Dockerfile`, Vercel (web/admin) için `vercel.json` dosyalarını hazırlar.
5. Sentry (hata takibi) ve pino (yapılandırılmış log) entegrasyonunu, gerçek DSN yokken sessizce
   no-op kalacak şekilde koda ekler.
6. Sonunda ayrı bir provisioning runbook'u (`docs/PROVISIONING.md`) bırakır — gerçek hesap
   açma/harcama kararı ve uygulaması tamamen kullanıcıya ait, bu planın yürütülmesi sırasında hiçbir
   gerçek hesap açılmaz veya harcama yapılmaz.

**Kapsam dışı (bilinçli):** Gerçek Supabase projesi/Railway servisi/Vercel projesi/uptime servisi
oluşturma; ilk gerçek prod deploy'un fiilen yapılması; mobil (Expo EAS, zaten Faz 2); KVKK
metinleri ve pilot launch checklist'i (4b'ye ait).

## 2. `packages/shared` build düzeltmesi

**Sorun:** `apps/api`nin `package.json`'ı `@gurmego/shared`'ı `main: "src/index.ts"` üzerinden,
derlenmemiş kaynak olarak import ediyor. Jest/ts-node test ortamı bunu sorunsuz çalıştırıyor (kendi
TS transform katmanları var), ama gerçek `node dist/main.js` (Railway'in çalıştıracağı prod modu)
Node'un native TS type-stripping'i altında uzantısız `export * from "./enums/price-range"` gibi
import'ları çözemiyor ve çöküyor. Bu, üç ayrı planda (1, 2, 3) fark edilmeden kaldı çünkü hiçbiri
gerçek `node dist/main.js`'i çalıştırmadı — yalnızca `ts-node`/Jest üzerinden test etti.

**Çözüm:**
- `packages/shared`'a `tsup` devDependency olarak eklenir; `tsup.config.ts` CJS çıktısı üretecek
  şekilde yapılandırılır (apps/api Node/CommonJS tabanlı; ESM'e geçiş bu planın kapsamı dışında).
- `packages/shared/package.json`: `main`/`types` alanları `dist/index.js`/`dist/index.d.ts`'e
  çevrilir; `"build": "tsup src/index.ts --format cjs --dts"` script'i eklenir.
- `packages/shared`'ı tüketen her paket (`apps/api`, `apps/web`, `apps/admin`) değişmeden kalır —
  hâlâ `@gurmego/shared`'ı import ediyorlar, yalnızca artık pnpm workspace linkinin gösterdiği yer
  derlenmiş `dist/` oluyor.
- Turborepo'nun `turbo.json`'ındaki `build: { dependsOn: ["^build"] }` zaten Task 0'dan beri var —
  yani `apps/api`'yi build etmeden önce `packages/shared`'ın build'i otomatik tetiklenir, elle
  sıralama gerekmez.

**Doğrulama (bu maddenin "çözüldü" sayılması için tek geçerli kanıt):**
Yeni bir CI adımı / script: `pnpm run build` sonrası `node apps/api/dist/main.js` gerçekten
başlatılır (arka planda, kısa ömürlü), `/health`'e gerçek bir HTTP isteği atılır, 200 dönmesi
beklenir. Bu adım pre-fix haliyle **kırmızı düşmeli** (kanıt: fix olmadan gerçekten çöktüğünü
göster), fix sonrası yeşile dönmeli. Yalnızca `tsc --noEmit` temiz demek yeterli **değildir** — tam
olarak bu yanılgı sorunun üç kez fark edilmeden kalmasına neden oldu.

## 3. CI/CD akışı

**Mevcut durum (Plan 1 Task 23):** `.github/workflows/ci.yml`, `pull_request` ve `push: main`
tetikleyicileriyle `pnpm run lint`/`typecheck`/`test`'i tek bir `quality` job'ında çalıştırıyor
(PostGIS servis konteynerli). Bu script'ler root'tan Turbo üzerinden fan-out ediyor — teoride
`apps/web`/`apps/admin`'i de kapsamalı. Bu plan bunu **doğrulayacak** (CI'da gerçekten üç paketin de
lint/test/typecheck çıktısı görünüyor mu, sessizce atlanan var mı) ve varsa eksikleri tamamlayacak.

**Yeni: `deploy` job'u (aynı workflow dosyasına, `quality` job'undan sonra, yalnızca `push: main`
tetiklendiğinde çalışır):**

```
main'e merge olunca (quality job'u geçtikten sonra):
  1. Prisma migration'larını staging Supabase DB'sine uygula (`prisma migrate deploy`)
  2. apps/api'yi Railway staging servisine deploy et (Railway CLI/GitHub Action)
  3. Smoke test: deploy edilen staging URL'ine gerçek HTTP isteği (/health) at, 200 bekle
  4. --- burada dur: GitHub Environments'ın "required reviewer" özelliğiyle manuel onay bekle ---
  5. Onaylanırsa: prod migration + apps/api prod deploy (Railway) + apps/web,apps/admin prod
     deploy tetikle (Vercel zaten git-push-tabanlı otomatik deploy yapar, bu adım yalnızca
     migration'ın prod deploy'dan ÖNCE bittiğinden emin olmak için bir sıralama gate'i)
```

Bu job'un adımları `RAILWAY_TOKEN`, `VERCEL_TOKEN`, `STAGING_DATABASE_URL`, `PROD_DATABASE_URL` gibi
GitHub Actions secret'larını referans alacak — bunlar **tanımlı değilken** iş akışı net bir "secret
eksik" hatasıyla durmalı (GitHub Actions'ın `${{ secrets.X }}` boşsa ilgili adımın başarısız olması
doğal davranışı budur), sessizce yanlış bir ortama deploy etmeye çalışmamalı. Gerçek hesaplar
açılıp secret'lar girildiğinde, bu workflow dosyasında hiçbir kod değişikliği gerekmeden çalışmaya
başlar.

**Doğrulama:** Workflow dosyasının YAML syntax'ı `actionlint` (veya GitHub'ın kendi workflow
validator'ı) ile doğrulanır. Secret'sız bir tetiklemede (örn. bir test branch'ine push) `deploy`
job'unun ilgili adımda net bir hata ile durduğu, `quality` job'unun etkilenmediği gösterilir.

## 4. Deploy dosyaları

**`apps/api/Dockerfile`** (multi-stage):
- Stage 1 (`builder`): Node 20 (`.nvmrc` ile aynı sürüm) + pnpm, tüm monorepo'yu kopyalar,
  `pnpm install --frozen-lockfile` + `pnpm run build` (bu, Bölüm 2'deki `packages/shared` build'ini
  de tetikler) çalıştırır.
- Stage 2 (`runner`): yalnızca `apps/api/dist/`, `apps/api/node_modules` (prod-only,
  `pnpm install --prod` ile ayrıca kurulur) ve `packages/shared/dist/` kopyalanır — builder
  stage'in devDependencies'i ve kaynak dosyaları final image'a taşınmaz.
- `CMD ["node", "dist/main.js"]`, `EXPOSE 3000`.

**`apps/web/vercel.json`, `apps/admin/vercel.json`:** Vercel'e bu projenin monorepo içindeki hangi
alt dizinde olduğunu ve hangi build komutuyla (`pnpm --filter @gurmego/web build` gibi, root'tan
çalıştırılacak şekilde) derleneceğini söyler. Vercel'in "Root Directory" proje ayarı ile birlikte
kullanılır (o ayar Vercel dashboard'unda, hesap açıldığında elle girilir — bu da provisioning
runbook'una düşecek bir adım).

**Doğrulama:** `docker build -t gurmego-api-test apps/api/Dockerfile` (repo kökünden, monorepo
context'iyle) lokal olarak çalıştırılır, `docker run` ile başlatılıp `/health`'e istek atılır. Bu,
Railway'e gitmeden önceki yerel kanıt — Bölüm 2'nin doğrulama adımının Docker içindeki hali.

## 5. İzleme altyapısı

**Sentry:** `@sentry/node` (apps/api) ve `@sentry/nextjs` (apps/web) eklenir. Başlatma kodu
`if (process.env.SENTRY_DSN) { Sentry.init(...) }` deseniyle korunur — DSN yoksa `Sentry.init`
hiç çağrılmaz, uygulama Sentry'siz normal çalışmaya devam eder. `apps/admin`'e eklenmez (iç araç,
düşük öncelik — istenirse Faz 2'de eklenir).

**Yapılandırılmış log (pino):** `apps/api`'nin mevcut Nest logger'ı pino tabanlı bir logger'a
(`nestjs-pino` veya benzeri) geçirilir. **Kritik proje kuralı (NFR-04):** kullanıcı konum
koordinatı (`lat`/`lng`) hiçbir log satırına yazılmaz. Bunu iki şekilde garanti ederiz:
1. Log serializer'ında `req.query`/`req.body`'nin ham halini değil, yalnızca beyaz-listeye alınmış
   alanları (method, path, statusCode, durationMs) loglayan bir redaction/serializer yapılandırması.
2. Otomatik bir test: `lat`/`lng` parametreli bir `/venues` isteği atılır, yakalanan log çıktısında
   bu değerlerin (veya ondalık sayı deseninin) geçmediği assert edilir.

**Uptime izleme:** Kod tarafında yapılacak bir şey yok — bu tamamen dışarıdan bir servis (Better
Stack/UptimeRobot) hesabı gerektiriyor. Provisioning runbook'una "bu servise git, `/health` URL'ini
gir" adımı olarak düşülür.

## 6. Provisioning runbook

`docs/PROVISIONING.md` olarak yeni bir dosya: Supabase projesi oluşturma → Railway servisi
bağlama → Vercel'e iki proje (web, admin) bağlama, her birine "Root Directory" ayarını girme →
hangi secret'ın (Bölüm 3) nereye (GitHub Actions secrets, Railway env, Vercel env) gireceği →
ilk gerçek migration'ın nasıl uygulanacağı (`prisma migrate deploy`, **asla** Supabase
dashboard'undan elle şema değişikliği — `CLAUDE.md`'nin yasakladığı şey) → uptime servisine
`/health` URL'ini girme. Bu bir **checklist**'tir, otomasyon değildir — sırayla, istediğin zaman,
kendi onayınla uygularsın. Bu planın yürütülmesi sırasında bu adımların hiçbiri fiilen atılmaz.

## 7. Test/doğrulama planı (bu planın kendi kabul kriterleri)

Plan 4a'nın tamamlanmış sayılması için:
- [ ] `packages/shared` build fix'i: pre-fix'te kırmızı düşen, post-fix'te yeşile dönen gerçek
      `node dist/main.js` + HTTP smoke test'i (Bölüm 2).
- [ ] Mevcut CI'ın `apps/web`/`apps/admin`'i gerçekten kapsadığı doğrulanmış veya tamamlanmış.
- [ ] `deploy` job'u YAML olarak geçerli, secret'sız çalıştırıldığında net ve öngörülebilir şekilde
      duruyor (sessizce yanlış bir şey yapmıyor).
- [ ] `apps/api/Dockerfile` lokal `docker build` + `docker run` + `/health` isteğiyle doğrulanmış.
- [ ] NFR-04 (konum loglanmama) için otomatik regresyon testi var ve geçiyor.
- [ ] `docs/PROVISIONING.md` yazılmış, `infrastructure.md`'deki hosting topolojisiyle tutarlı.
- [ ] Hiçbir gerçek hesap açılmadı, hiçbir harcama yapılmadı (bu planın bir kabul kriteri, ihlali
      plan hatası sayılır).

## Global Constraints (writing-plans için taşınacak)

- Migration: yalnızca `prisma migrate` — Supabase dashboard'dan elle şema değişikliği yasak.
- Kullanıcı konum koordinatı hiçbir log/analytics çağrısına yazılmaz (NFR-04) — bu planda ayrıca
  otomatik test gerektiren tek madde.
- Node sürümü `.nvmrc` ile sabit (Dockerfile de aynı sürümü kullanmalı).
- Redis yok (MVP kararı) — bu plan rate-limit/cache mimarisine dokunmuyor, mevcut `CacheStore`
  soyutlaması korunur.
- Gerçek hesap açma/harcama gerektiren hiçbir adım bu planın yürütülmesi sırasında fiilen
  uygulanmaz — yalnızca hazırlanır ve belgelenir.
