# GurmeGo — Plan 4a: `packages/shared` Build Düzeltmesi — Design Doc

**Tarih:** 2026-07-25 · **Durum:** Onaylandı (brainstorming + idea-red-team, 5 tur sonrası), plan yazımına hazır

İlgili: [STATE.md](../../STATE.md), [CHANGELOG.md](../../CHANGELOG.md) (2026-07-25 girdisi — küçültme geçmişi)

## 1. Kapsam ve hedef

Bu doküman iki idea-red-team turundan NO-GO aldıktan sonra minimuma indirildi (bkz. "Red-team
bulguları"). Roadmap'in 4. planındaki ("Infra/CI/deployment") gerçek deploy hazırlığı (Railway/
Vercel yapılandırması, provisioning runbook) **hesap açılmadan yazılamayacağı** için tamamen
çıkarıldı — hesaplar açıldığında, platformla gerçekten etkileşim halindeyken, ayrı bir oturumda
yazılacak.

**4a artık yalnızca şunu üretir:** `docs/STATE.md`'nin işaretlediği acil production build hatasını
çözer — `packages/shared`'ın derlenmemiş kaynak olarak import edilmesi, `apps/api`'nin gerçek
`node dist/main.js` modunda çökmesine neden oluyor.

**Kapsam dışı:** Railway/Vercel/Supabase provisioning ve ilgili her şey (ayrı, ileride); Sentry/
pino (ayrı, ilgisiz); CORS/migration-lifecycle/Supabase-Auth↔User-senkronizasyon bulguları (aşağıya
bakın — bunlar gerçek ve önemli, ama bu planın "build hatası" gerekçesiyle ilgisi yok, ayrı takip
maddeleri olarak kaydedildi).

## 2. `packages/shared` build düzeltmesi

**Sorun:** `apps/api`'nin `package.json`'ı `@gurmego/shared`'ı `main: "src/index.ts"` üzerinden,
derlenmemiş kaynak olarak import ediyor. Jest/ts-node test ortamı bunu sorunsuz çalıştırıyor, ama
gerçek `node dist/main.js` (prod modu) Node'un native TS type-stripping'i altında uzantısız
`export * from "./enums/price-range"` gibi import'ları çözemiyor ve çöküyor.

**Çözüm (red-team'in doğruladığı en basit yol — bkz. Bölüm "Red-team bulguları"):**
- `packages/shared/package.json`'a `"build": "tsc -p tsconfig.json"` script'i eklenir. Ekstra bir
  bundler (`tsup` vb.) **gerekmez** — `packages/shared/tsconfig.json` zaten kök `tsconfig.base.json`'dan
  `module: commonjs` ve `declaration: true` miras alıyor; düz `tsc` çağrısı `dist/index.js` +
  `.d.ts` dosyalarını doğru üretiyor (red-team bunu bizzat çalıştırıp doğruladı).
- `main`/`types` alanları `dist/index.js`/`dist/index.d.ts`'e çevrilir.
- Tüketen paketler (`apps/api`, `apps/web`, `apps/admin`) değişmeden kalır.
- `turbo.json`'ın `build: { dependsOn: ["^build"] }` ayarı (Task 0'dan beri var) sıralamayı
  otomatik yapar — **ama yalnızca `turbo run` üzerinden çalıştırılan komutlar için.**
- **Kritik ek adım (round 4 red-team bulgusu):** `dist/` `.gitignore`'da, yani temiz bir
  `pnpm install` sonrası henüz yok. `packages/shared/package.json`'a **`"prepare": "tsc -p
  tsconfig.json"`** script'i de eklenir — pnpm, workspace paketlerinde `prepare` lifecycle
  script'ini `install` sonrası otomatik çalıştırır (kök `pnpm-lock.yaml`'da zaten pnpm 9
  kullanılıyor, bu davranışı destekler). Bu, turbo'nun dışından çalıştırılan herhangi bir komutun
  (`cd apps/api && pnpm run start:dev` gibi, doğrudan, `turbo run` olmadan) veya "temiz checkout,
  ilk komut" senaryosunun `dist/index.js` bulunamadı hatasıyla kırılmasını önler — `dist/` her
  zaman `pnpm install`'dan hemen sonra var olur.

**Doğrulama (tek geçerli kanıt — `tsc --noEmit` temiz demek YETERLİ DEĞİL):**
Build komutu **`pnpm exec turbo run build --filter=@gurmego/api...`** olmalı (`pnpm exec`
zorunlu — düz `turbo run`, temiz bir CI shell'inde yerel `devDependency` olarak kurulu turbo
binary'sini `PATH`'te bulamayabilir; `pnpm exec` bunu garantiler, round 5 red-team bulgusu) — kök
`pnpm run build` de DEĞİL,
çünkü kök build `apps/web`/`apps/admin`'i de derler ve onlar modül yüklenirken
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` okur; temiz bir CI ortamında bu
değişkenler yoksa build gereksiz yere kırılabilir. `--filter=@gurmego/api...` yalnızca API'yi ve
bağımlılığı olan `packages/shared`'ı build eder (Bölüm 2'nin gerçek amacı budur zaten).

Smoke test **deterministik bir sözleşme** olarak tanımlanır (round 3 red-team'in "yarış durumu"
bulgusuna yanıt):
1. `DATABASE_URL` ve `SUPABASE_JWKS_URL` bu adıma **açıkça** verilir (önceki adımların env'ine
   örtük olarak güvenilmez — CI'da her step'in kendi `env:` bloğu vardır, otomatik miras kalmaz).
2. `node apps/api/dist/main.js` arka planda başlatılır, PID yakalanır.
3. En fazla 10 saniye boyunca, 500ms aralıklarla `/health`'e istek atılır (readiness polling) —
   ilk denemede bağlantı reddi normal kabul edilir, timeout'a kadar tekrar dener.
4. Polling sırasında process'in erken sonlandığı (`kill -0 $PID` başarısız) tespit edilirse hata
   loglanıp adım başarısız sayılır — sonsuz beklemeye düşülmez.
5. 200 alındığında veya timeout dolduğunda, `trap`/`finally` ile PID'e **her koşulda** `kill`
   gönderilir (test başarılı da olsa başarısız da olsa süreç arkada kalmaz).

Bu adım pre-fix haliyle (packages/shared build script'i yokken) **kırmızı düşmeli** — process
muhtemelen hiç ayağa kalkmadan erken çıkacağı için 3. adımın "erken çıkış" kontrolü bunu yakalar.

## 3. Test/doğrulama planı

- [ ] Pre-fix: yukarıdaki smoke sözleşmesi **başarısız** olduğu gösterilir (erken process-exit
      veya timeout — mevcut hatanın gerçekliğinin kanıtı).
- [ ] Post-fix: aynı sözleşme **başarılı** (200, temiz cleanup).
- [ ] `pnpm exec turbo run build --filter=@gurmego/api...` hem `packages/shared` hem `apps/api`'yi doğru
      sırada build ediyor; `apps/web`/`apps/admin`'e dokunmuyor (Next env gereksinimi yok).
- [ ] Temiz bir `pnpm install` sonrası (hiçbir `turbo run` komutu çalıştırılmadan)
      `packages/shared/dist/index.js` dosyasının var olduğu doğrulanır (prepare script kanıtı).

## Global Constraints (writing-plans için taşınacak)

- Node sürümü `.nvmrc`'nin gerçek içeriğine göre kullanılır (sabit sürüm numarası yazılmaz).
- Bu plan gerçek hesap açma/harcama içermez.

## Red-team bulguları (Codex, idea-red-team, 2026-07-25 — 2 tur)

**Tur 1 (NO-GO):** Orijinal tasarım (staging + GitHub Environments manuel onay gate'i + otomatik
migration→deploy sıralaması + Sentry/pino aynı planda) 150 kullanıcılık/6 haftalık bir pilotun
önüne gereksiz kurumsal CI/CD koreografisi koyuyordu. Kabul edildi, kapsam Railway/Vercel deploy
hazırlığı + provisioning runbook'a küçültüldü.

**Tur 2 (NO-GO):** Küçültülmüş tasarımın deploy-hazırlık kısmı hâlâ hatalıydı:
- Railway "Root Directory: apps/api" ayarı monorepo kökünü (packages/shared dahil) build
  context'inden dışlar — fiilen çalışmaz. Güncel varsayılan builder da "Nixpacks" değil
  "Railpack" — doküman güncel platform davranışını yanlış tarif ediyordu.
- Runbook'ta `CORS_ORIGIN` env'i yoktu — prod'da web/admin API'ye erişemezdi.
- CI smoke test'i env/readiness bağımlılıklarını tanımlamadan yarış durumu yaratıyordu.
- Migration'ın git-push otomatik deploy ile nasıl sıralanacağı (ilk deploy sonrası, ikinci şema
  değişikliğinde) tanımsız bırakılmıştı.
- Provisioning runbook'u, custom access token hook (zaten bilinen ertelenmiş madde) olmadan
  admin'in çalışmayacağı gerçeğini görmezden geliyordu.
- **`tsup` gereksizdi** — red-team `tsc -p packages/shared/tsconfig.json`'ı bizzat çalıştırıp düz
  `tsc`'nin yeterli olduğunu kanıtladı. Bu plana işlendi (Bölüm 2).
- **Yeni, infra'yla ilgisiz gerçek bulgu:** Supabase Auth kullanıcısı (`auth.users`) ile Prisma
  `User` tablosu arasında hiçbir senkronizasyon (trigger) yok — bir kullanıcı kayıt olup favori
  eklemeye çalıştığında FK hatası alabilir. Bu plana dahil edilmedi (infra değil, backend/auth
  bug'ı), `docs/STATE.md`'ye öncelikli takip maddesi olarak düşüldü.

**Kabul edilen nihai karar:** Railway/Vercel/provisioning içeriğinin tamamı bu plandan çıkarıldı —
gerçek platform davranışı (Root Directory semantiği, güncel builder adı, CORS/migration
sözleşmeleri) hesap açılmadan, platformla fiilen etkileşime girmeden doğru yazılamıyor. Bu içerik,
hesaplar açıldığında ayrı bir oturumda, gerçek platform geri bildirimiyle yazılacak.

**Tur 3 (NO-GO):** Çekirdek çözüm (düz `tsc`) doğrulandı ve kabul edildi — Node 22.19.0'da mevcut
giriş noktasının gerçekten `ERR_MODULE_NOT_FOUND` verdiği, `tsc -p tsconfig.json`'ın doğru
CommonJS çıktısı ürettiği bizzat teyit edildi. Kalan iki bulgu doğrulama adımının belirsizliğiyle
ilgiliydi:
- Smoke test "arka planda başlat, `/health` isteği at" olarak tarif edilmişti — deterministik bir
  readiness/timeout/cleanup sözleşmesi yoktu, flaky olabilirdi.
- Kök `pnpm run build`, ilgisiz `apps/web`/`apps/admin`'i de build ediyordu; bunlar `NEXT_PUBLIC_*`
  env'leri olmadan temiz CI'da gereksiz yere kırılabilirdi.

**Kabul edildi, plana işlendi (Bölüm 2/3):** Smoke test artık PID yakalama + zaman sınırlı
readiness polling + erken-exit kontrolü + garantili `trap` cleanup ile tanımlı; build komutu
`turbo run build --filter=@gurmego/api...`'ye daraltıldı (web/admin'e dokunmuyor).

**Tur 4 (NO-GO):** `main`/`types`'ı `dist/index.js`'e çevirmek, `dist/` `.gitignore`'da olduğu
için temiz bir `pnpm install` sonrası (hiçbir `turbo run` komutu çalışmadan) `@gurmego/shared`'ı
çözülemez hale getiriyordu — turbo'nun `^build` bağımlılığı yalnızca `turbo run` üzerinden
çalıştırılan komutları kapsar, doğrudan çalıştırılan paket script'lerini (`cd apps/api && pnpm run
start:dev` gibi) değil. **Kabul edildi, plana işlendi (Bölüm 2):** `packages/shared/package.json`'a
`"prepare": "tsc -p tsconfig.json"` eklendi — pnpm bunu `install` sonrası otomatik çalıştırır,
`dist/` her zaman var olur.

**Tur 5 (NO-GO):** Tasarımın mantığı doğrulandı ("tasarım doğru" ifadesiyle), tek engelleyici bulgu
mekanikti: `turbo run build ...` komutu temiz bir CI shell'inde yerel `devDependency` olarak kurulu
`turbo` binary'sini `PATH`'te bulamayabilir — `pnpm exec turbo run ...` gerekir. **Kabul edildi,
plana işlendi** (Bölüm 2/3, tüm `turbo run` komut örnekleri `pnpm exec turbo run`'a çevrildi).
Red-team'in kendi ifadesiyle: "düzeltme sonrası GO."

**Reddedilenler:** Yok — beş turun bulguları da kabul edildi.
