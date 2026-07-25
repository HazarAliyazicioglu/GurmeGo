# GurmeGo — Plan 4a: `packages/shared` Build Düzeltmesi — Design Doc

**Tarih:** 2026-07-25 · **Durum:** Onaylandı (brainstorming + idea-red-team, 3 tur sonrası), plan yazımına hazır

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
  otomatik yapar.

**Doğrulama (tek geçerli kanıt — `tsc --noEmit` temiz demek YETERLİ DEĞİL):**
Build komutu **`turbo run build --filter=@gurmego/api...`** olmalı — kök `pnpm run build` DEĞİL,
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
- [ ] `turbo run build --filter=@gurmego/api...` hem `packages/shared` hem `apps/api`'yi doğru
      sırada build ediyor; `apps/web`/`apps/admin`'e dokunmuyor (Next env gereksinimi yok).

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

**Reddedilenler:** Yok — üç turun bulguları da kabul edildi.
