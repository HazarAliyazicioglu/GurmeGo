# GurmeGo — Plan 4a: `packages/shared` Build Düzeltmesi — Design Doc

**Tarih:** 2026-07-25 · **Durum:** Onaylandı (brainstorming + idea-red-team, 2 tur küçültme sonrası), plan yazımına hazır

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
`pnpm run build` sonrası `node apps/api/dist/main.js` gerçekten başlatılır (arka planda, kısa
ömürlü), `/health`'e gerçek bir HTTP isteği atılır, 200 dönmesi beklenir. Bu adım pre-fix haliyle
**kırmızı düşmeli**, fix sonrası yeşile dönmeli. Smoke test'in çalışması için gerekli tüm env
değişkenleri (`DATABASE_URL`, `SUPABASE_JWKS_URL` vb. — mevcut `apps/api/.env.example`'daki
liste) test ortamında tanımlanır; guard'ın `SUPABASE_JWKS_URL`'i başlangıçta parse ettiği ve
`PrismaService`'in başlangıçta DB'ye bağlandığı göz önüne alınarak, smoke test bu bağımlılıkların
zaten CI'da var olan (Plan 1 Task 23'ten) PostGIS servis konteynerine ve mevcut env'lere karşı
çalıştırılır — yeni bir env kümesi icat edilmez.

## 3. Test/doğrulama planı

- [ ] Pre-fix: `node apps/api/dist/main.js` + `/health` isteği **başarısız** olduğu gösterilir
      (mevcut hatanın gerçekliğinin kanıtı).
- [ ] Post-fix: aynı adım **başarılı** (200).
- [ ] `pnpm run build` (root) hem `packages/shared` hem `apps/api`'yi doğru sırada build ediyor.

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

**Reddedilenler:** Yok — her iki turun bulguları da kabul edildi.
