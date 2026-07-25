# GurmeGo — Plan 4a: Infra/CI Hazırlığı — Design Doc

**Tarih:** 2026-07-25 · **Durum:** Onaylandı (brainstorming + idea-red-team round 2, küçültülmüş kapsam), plan yazımına hazır

İlgili: [infrastructure.md](../../infrastructure.md), [development-guidelines.md](../../development-guidelines.md), [STATE.md](../../STATE.md)

## 1. Kapsam ve hedef

Roadmap'in 4. planı ("Infra/CI/deployment + KVKK texts + pilot launch checklist") ikiye bölündü:
bu doküman yalnızca **4a (Infra/CI)**'yı kapsıyor. 4b (KVKK metinleri + pilot launch checklist)
ayrı bir brainstorming turunda ele alınacak.

**Bu doküman ilk turda idea-red-team'den NO-GO aldı** (bkz. "Red-team bulguları" bölümü) — orijinal
tasarım, 150 kullanıcılık/6 haftalık bir pilotun önüne henüz hiçbir hesabı olmayan bir kurumsal
staging→prod CI/CD koreografisi koyuyordu. Kapsam buna göre küçültüldü.

4a artık yalnızca şunu üretir:
1. `packages/shared`'ın prod build'i kırık olma sorununu (`docs/STATE.md`'nin işaretlediği acil
   madde) `tsup` ile çözer.
2. Railway (API) için Railway'in kendi native pnpm-monorepo desteğine (Nixpacks) güvenen basit bir
   deploy yapılandırması hazırlar — özel bir multi-stage Dockerfile'a **varsayılan olarak
   girmiyoruz**, yalnızca Nixpacks yetersiz kalırsa geri düşülecek bir seçenek olarak belgeleniyor.
3. Vercel (web/admin) için "Root Directory" + build komutunu tarif eden basit yapılandırma notları.
4. Sonunda bir provisioning runbook'u (`docs/PROVISIONING.md`) bırakır — Railway/Vercel/Supabase
   hesaplarını açtığında hangi ayarı nereye gireceğini ve **ilk deploy'u elle nasıl tetikleyeceğini**
   anlatan bir checklist. Otomasyon değil, elle takip edilecek adımlar.

**Kapsam dışı (bilinçli, red-team sonrası netleşti):**
- Staging ortamı, GitHub Environments manuel onay gate'i, otomatik migration→deploy sıralaması —
  bu ölçekte (150 kullanıcı, 6 hafta, küçük ekip) gereksiz karmaşıklık; Railway/Vercel'in kendi
  git-push deploy'una güveniliyor.
- Sentry (hata takibi) ve pino (yapılandırılmış log) entegrasyonu — ayrı, daha küçük bir işe
  bırakıldı, bu planın "acil" gerekçesiyle ilgisi yok.
- Gerçek Supabase projesi/Railway servisi/Vercel projesi/uptime servisi oluşturma; ilk gerçek
  deploy'un fiilen yapılması — hepsi kullanıcının kendi onayı ve zamanlamasıyla, runbook'u takip
  ederek yapılır.
- Mobil (Expo EAS, zaten Faz 2); KVKK metinleri ve pilot launch checklist'i (4b'ye ait).
- **Pilot karar metriklerinin (Maps'e gitme, kaydetme, paylaşma, 4. hafta geri dönüş —
  `prd.md §5`) ölçümü için analytics/event-capture** — red-team'in bulduğu gerçek ve ayrı bir
  boşluk, bu planın kapsamında değil, `docs/STATE.md`'ye ayrı takip maddesi olarak düşülüyor.

## 2. `packages/shared` build düzeltmesi

**Sorun:** `apps/api`'nin `package.json`'ı `@gurmego/shared`'ı `main: "src/index.ts"` üzerinden,
derlenmemiş kaynak olarak import ediyor. Jest/ts-node test ortamı bunu sorunsuz çalıştırıyor (kendi
TS transform katmanları var), ama gerçek `node dist/main.js` (prod modu) Node'un native TS
type-stripping'i altında uzantısız `export * from "./enums/price-range"` gibi import'ları
çözemiyor ve çöküyor. Bu, üç ayrı planda (1, 2, 3) fark edilmeden kaldı çünkü hiçbiri gerçek
`node dist/main.js`'i çalıştırmadı — yalnızca `ts-node`/Jest üzerinden test etti.

**Çözüm:**
- `packages/shared`'a `tsup` devDependency olarak eklenir; CJS çıktısı üretir (apps/api
  Node/CommonJS tabanlı; ESM'e geçiş bu planın kapsamı dışında).
- `packages/shared/package.json`: `main`/`types` alanları `dist/index.js`/`dist/index.d.ts`'e
  çevrilir; `"build": "tsup src/index.ts --format cjs --dts"` script'i eklenir.
- Tüketen paketler (`apps/api`, `apps/web`, `apps/admin`) değişmeden kalır — hâlâ
  `@gurmego/shared`'ı import ediyorlar, yalnızca pnpm workspace linkinin gösterdiği yer artık
  derlenmiş `dist/` oluyor.
- Turborepo'nun `turbo.json`'ındaki `build: { dependsOn: ["^build"] }` (Task 0'dan beri var) bunu
  otomatik sıralar — elle sıralama gerekmez.

**Doğrulama (tek geçerli kanıt — `tsc --noEmit` temiz demek YETERLİ DEĞİL):**
Yeni bir CI adımı: `pnpm run build` sonrası `node apps/api/dist/main.js` gerçekten başlatılır
(arka planda, kısa ömürlü), `/health`'e gerçek bir HTTP isteği atılır, 200 dönmesi beklenir. Bu
adım pre-fix haliyle **kırmızı düşmeli** (fix olmadan gerçekten çöktüğünü kanıtla), fix sonrası
yeşile dönmeli.

**Node sürüm notu (red-team düzeltmesi):** `.nvmrc` içeriği **20.11.1 DEĞİL, gerçekte hangi sürüm
yazıyorsa o** — yürütme sırasında dosyanın güncel içeriği okunup ona göre işlem yapılacak, bu
tasarım dokümanına sabit bir sürüm numarası yazılmayacak (önceki taslakta bu tutarsızlık vardı).

## 3. Deploy yapılandırması (basitleştirilmiş)

**Railway (API):** Railway, `apps/api`'yi Nixpacks buildpack'iyle otomatik algılamayı dener.
Bu planın adımı: Railway proje ayarlarında "Root Directory: apps/api", "Build Command: `cd ../.. &&
pnpm install --frozen-lockfile && pnpm run build`", "Start Command: `node dist/main.js`" değerlerini
**belgelemek** (runbook'a yazmak) — hesap açılmadan test edilemez, bu yüzden kod değişikliği değil,
runbook maddesi. Nixpacks pnpm workspace'i düzgün handle edemezse (bilinen bir risk, red-team'in
"pnpm pruning kırık olabilir" uyarısı), geri düşülecek seçenek: tek-aşamalı, basit bir Dockerfile
(multi-stage/pruning YOK — bu ölçekte final image boyutu önemli değil, doğruluk önemli).

**Vercel (web/admin):** Ayrı bir `vercel.json` dosyası yazmak yerine (red-team: "dashboard Root
Directory ayarını dosyanın yönettiği yanılsaması" uyarısı doğru), bu da runbook'a yazılan bir
**proje ayarı**: her iki app için Vercel dashboard'unda "Root Directory: apps/web" /
"apps/admin", "Build Command: `cd ../.. && pnpm run build --filter=@gurmego/web`" (Vercel'in kendi
monorepo desteği bu deseni native olarak biliyor).

**Doğrulama:** Bu bölümün kod tarafı yok — yalnızca runbook maddesi. Kod tarafında doğrulanacak tek
şey Bölüm 2'nin `node dist/main.js` smoke test'i (Railway'in çalıştıracağı komutun ta kendisi).

## 4. Provisioning runbook

`docs/PROVISIONING.md`: Supabase projesi oluşturma → Railway servisini Bölüm 3'teki ayarlarla
bağlama → Vercel'e iki proje (web, admin) Bölüm 3'teki ayarlarla bağlama → hangi env değişkeninin
(DATABASE_URL, SUPABASE_JWKS_URL, RULES_*, NEXT_PUBLIC_*) nereye (Railway env, Vercel env)
gireceği → ilk gerçek migration'ın nasıl uygulanacağı (`prisma migrate deploy`, **asla** Supabase
dashboard'undan elle şema değişikliği). Bu bir **checklist**'tir, otomasyon değildir — sırayla,
istediğin zaman, kendi onayınla uygularsın. Bu planın yürütülmesi sırasında bu adımların hiçbiri
fiilen atılmaz, hiçbir hesap açılmaz, hiçbir harcama yapılmaz.

## 5. Test/doğrulama planı (bu planın kabul kriterleri)

- [ ] `packages/shared` build fix'i: pre-fix'te kırmızı düşen, post-fix'te yeşile dönen gerçek
      `node dist/main.js` + HTTP smoke test'i (Bölüm 2).
- [ ] `docs/PROVISIONING.md` yazılmış, Bölüm 3'teki ayarlarla ve `infrastructure.md`'deki hosting
      topolojisiyle tutarlı.
- [ ] Hiçbir gerçek hesap açılmadı, hiçbir harcama yapılmadı.

## Global Constraints (writing-plans için taşınacak)

- Migration: yalnızca `prisma migrate` — Supabase dashboard'dan elle şema değişikliği yasak.
- Node sürümü `.nvmrc` ile sabit — tasarım dokümanına veya runbook'a sabit bir sürüm numarası
  yazılmaz, dosyanın gerçek içeriğine referans verilir.
- Redis yok (MVP kararı) — bu plan rate-limit/cache mimarisine dokunmuyor.
- Gerçek hesap açma/harcama gerektiren hiçbir adım bu planın yürütülmesi sırasında fiilen
  uygulanmaz — yalnızca belgelenir (runbook).

## Red-team bulguları (Codex, idea-red-team, 2026-07-25)

İlk tasarım (staging ortamı + GitHub Environments manuel onay gate'i + otomatik migration→deploy
sıralaması + Sentry/pino aynı planda) **NO-GO** aldı. Ham rapor: bu doküman revize edilmeden önceki
sürümde tartışıldı, kullanıcıyla birlikte gözden geçirildi.

**Kabul edilenler (plana işlendi):**
- Deploy job'unun tamamı (staging, manuel gate, sıralama) → çıkarıldı, Bölüm 3'e basitleştirildi.
- GitHub Environments'ın "job ortasında bekler" varsayımı yanlış (job-seviyesinde çalışır) → bu
  mimari zaten kaldırıldığı için madde düştü.
- Vercel'in git-push'ta otomatik deploy edip GitHub gate'ini beklemeyeceği, iki otomasyonun
  yarışacağı → kabul edildi, Vercel'in kendi otomasyonuna güvenme kararına dönüştü.
- Tanımsız secret'ın "temiz hata" değil boş string ürettiği → artık bu planda secret referans eden
  bir CI job'u olmadığı için madde düştü.
- Multi-stage Dockerfile'ın pnpm monorepo pruning'inin muhtemelen kırık olacağı → Dockerfile
  varsayılan yaklaşım olmaktan çıkarıldı, Railway'in native Nixpacks desteğine öncelik verildi.
- `.nvmrc` sürüm numarasının tasarım dokümanına yanlış (Node 20) yazılmış olması → dokümana sabit
  sürüm numarası yazılmaması kuralına çevrildi (Bölüm 2 notu).
- Sentry+pino'nun bu planla ilgisiz olduğu → çıkarıldı.
- Analytics/event-capture eksikliği (pilot karar metrikleri hiçbir yerde ölçülmüyor) → bu planın
  kapsamına alınmadı (infra planı değil), `docs/STATE.md`'ye ayrı takip maddesi olarak düşüldü.

**Reddedilenler:** Yok — rapor bu turda tamamen kabul edildi, tartışmalı/reddedilen madde yok.
