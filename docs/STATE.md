# Durum — 2026-07-25 (oturum limiti nedeniyle burada durduruldu)

## Aktif plan: Plan 3/4 (Admin Panel) — Task 7/7'nin ortasında, DEVAM ET
`docs/superpowers/plans/2026-07-25-admin-panel.md`. Plan 1 ✅ (24/24) ve Plan 2 ✅ (12/12) tamamen
bitti, ayrıntı için `.superpowers/sdd/progress.md`'ye bak (worktree-lokal, git-ignored).

Plan 3: idea-red-team (Codex) orijinal 6 sayfalı admin app'i NO-GO dedi → kullanıcı kararıyla 2
sayfaya daraltıldı (kürasyon kuyruğu + CSV import, gerisi Postman/Prisma Studio/Supabase
dashboard'a bırakıldı). plan-red-team YENİDEN BÖL dedi, tüm bulgular düzeltildi. **Task 0-6
TAMAMLANDI** (hepsi review'dan geçti, ilgili Codex görsel pass'leri dahil). **Task 7 (son task:
CORS + smoke test + zorunlu final review) YARIM KALDI:**

- Task 7 Step 1 (CORS'a localhost:3003 ekle): ✅ yapıldı, commit `4b0ebcb`.
- Task 7 Step 3 (gerçek stack'e karşı smoke test): subagent çalıştırıldı, **KRİTİK bir bug buldu**
  (aşağıya bak) — rapor: `.superpowers/sdd/task-7-smoke-report.md`.
- Bug'ın düzeltmesi: subagent dispatch edildi, **oturum limitine çarpıp yarıda kesildi**, ama
  düzeltmenin kendisi tamamlanmış ve commit edilmiş durumda (`a3e77b0`) — 90/90 test geçiyor, tsc
  temiz. **Eksik olan: gerçek HTTP ile (curl, gerçek Supabase JWT) doğrulama** — subagent bunu
  yapıyordu ama kesildi. STATE.md'ye "gerçek-HTTP doğrulaması bekliyor" olarak not düşüldü, kod
  fix'i commit mesajında da bunu açıkça söylüyor.
- **Task 7 Step 4 (zorunlu final whole-branch review + Codex cross-model-review) HİÇ
  BAŞLAMADI.**

## SIRADAKİ ADIM (yeni oturumda buradan devam et)
1. Gerçek stack'e karşı `a3e77b0`'ın gerçekten 403'ü kapattığını doğrula: Supabase'i ayağa kaldır
   (`cd apps/api && npx supabase status`, gerekirse `npx supabase start` — Docker açık olmalı),
   `apps/api`'yi gerçek çalıştır (`pnpm run start:dev` Node 22'de KIRIK, bkz. aşağıdaki "Acil"
   bölümü — bunun yerine `npx ts-node -T src/main.ts` kullan, `PORT=3001`), gerçek bir curator
   JWT al (`.superpowers/sdd/task-7-smoke-report.md`'de tam adımlar var: signup → DB'de role yaz →
   `supabase/config.toml`'daki `[auth.hook.custom_access_token]`'ı GEÇİCİ olarak aç, bir Postgres
   fonksiyonu yaz, `supabase stop && start`, token al, SONRA `git checkout -- supabase/config.toml`
   ile geri al — commit ETME). `curl -H "Authorization: Bearer <token>" http://localhost:3001/v1/admin/queue`
   artık 403 değil 200 dönmeli.
2. Doğrulandıktan sonra: `.superpowers/sdd/progress.md`'ye Task 7'nin tamamlandığını yaz.
3. Task 7 Step 4'ü çalıştır: `superpowers:subagent-driven-development`'ın final whole-branch review
   deseni (Plan 1 Task 24 / Plan 2'nin final review'ıyla AYNI) — `code-reviewer` agent'ını dispatch
   et (otomatik Codex'e delege ediyor), `scripts/review-package` ile diff paketi hazırla (base:
   Plan 3'ün başladığı commit, muhtemelen Plan 2'nin bittiği commit — `git log` ile bul), bulguları
   işle.
4. Plan 3 bitince: kullanıcıya sormadan Plan 4'e (Infra/CI/KVKK/pilot) geç — `superpowers:brainstorming`
   ile başla, `idea-red-team` çalıştırmayı unutma (Plan 3'te olduğu gibi zorunlu).
5. Hiçbir plan henüz master'a merge edilmedi — hepsi bittiğinde tek seferde review edilip
   merge edilecek (kullanıcı kararı, değişmedi).

## ACİL — KRİTİK, Plan 3 Task 7'de bulundu: RolesGuard/JwtAuthMiddleware Fastify uyumsuzluğu
**DÜZELTİLDİ (commit `a3e77b0`), ama gerçek-HTTP doğrulaması eksik (yukarıdaki adım 1'e bak).**
`@nestjs/platform-fastify` altında klasik `NestMiddleware` (eski `JwtAuthMiddleware`,
`MiddlewareConsumer.forRoutes("*")` ile kayıtlıydı) Fastify'ın ham Node `IncomingMessage`'ını
alıyordu, ama `RolesGuard`/her `@Req()` `ExecutionContext.switchToHttp().getRequest()` üzerinden
AYRI bir `FastifyRequest` nesnesi görüyordu. Middleware'in `req.user = ...` ataması hiçbir zaman
guard'a görünmüyordu — **her `@Roles(...)` korumalı route (tüm admin API'si: kuyruk, CSV import,
mekan CRUD, kullanıcı rolleri, raporlar, export) geçerli/geçersiz/hiç token olmadan HER ZAMAN 403
dönüyordu**, 89 mock testin hiçbiri bunu yakalamadı (TestingModule gerçek Fastify request/response
sarmalamasını hiç tetiklemiyor). Yalnızca gerçek sunucuya karşı gerçek HTTP isteğiyle bulundu.
Düzeltme: middleware → `JwtAuthGuard` (CanActivate), `APP_GUARD` ile global kayıt, `RolesGuard`'dan
önce çalışacak sırada. Detay: `.superpowers/sdd/task-7-smoke-report.md` (bulgu) ve commit `a3e77b0`
mesajı (düzeltme). Bilinen küçük artık: birkaç controller hâlâ yerel `@UseGuards(RolesGuard)`
taşıyor, artık global de var — iki kez çalışıyor, aynı sonuç, zararsız ama temizlenebilir.

## Acil: production build kırık (Plan 2 Task 11'de keşfedildi, hâlâ çözülmedi)
`packages/shared`'ın build adımı yok — `apps/api`'nin derlenmiş `dist/main.js`'i VE dokümante
edilmiş `pnpm run start:dev` komutu (Plan 3 Task 7'de AYRICA doğrulandı — `nest start --watch` da
aynı `dist/`+`require` yoluna çıkıyor) Node'un native TS type-stripping'i altında extensionless
import'lar yüzünden çöküyor. Jest bunu maskeler (gerçek process boot'u hiç tetiklemiyor). Plan
4'ten önce çözülmeli: `packages/shared`'a bir build adımı (tsc/tsup) eklenip `apps/api`'nin ona
derlenmiş çıktı üzerinden bağımlı olması gerekiyor. Geçici çözüm (yalnızca lokal test için):
`npx ts-node -T src/main.ts`.

## Yakın kararlar
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5
- Plan 1 mimari kararları: docs/adr/001-003
- Plan 3 kapsam daraltması + red-team kayıtları: docs/superpowers/specs/2026-07-24-admin-panel-design.md,
  docs/superpowers/plans/2026-07-25-admin-panel.md'nin sonundaki "Red-team bulguları" bölümü
- Yürütme kayıtları (task-by-task): `.superpowers/sdd/progress.md` (worktree-lokal, git log kalıcı)

## Ertelenen takip maddeleri (Plan 4 / gerçek Supabase projesi kurulunca)
- Rol kaynağı kopuk: DB'ye User.role yazılıyor ama JWT'nin user_role claim'i gerçek bir custom
  access token hook gerektiriyor — Plan 3 Task 7'de LOKAL olarak bunu geçici kurup doğruladık,
  gerçek projede kalıcı kurulması gerekiyor.
- RateLimitGuard req.ip kullanıyor, trustProxy yok. rate_limit_counters hiç temizlenmiyor.
- VenueVersion snapshot'ı yalnızca admin-queue approve() akışında oluşuyor.
- isBoutique DRAFT'ta true olabiliyor, kısmi update'lerde bayat kalabiliyor.
- REPORT onayı düzeltme uygulamadan verifiedAt'i yeniliyor — ürün semantiği sorusu (Plan 3'te
  QueueItem'ın buton metnine bunu netleştiren bir not eklendi, davranış değişmedi).
- eslint no-explicit-any/no-unused-vars "warn", "error"a sıkılaştırılmalı.
- Plan 1: açık/kapalı (open-now) filtresi hiç implemente edilmedi.
- Plan 2 final review Minor bulguları: E2E suite 2/4-5 senaryo, useGeolocation iki kez mount
  oluyor, setVenues'ta sıra koruması yok.
- Plan 2 Task 9: FavoriteButton'da double-click guard yok.
- Plan 3: birkaç admin controller'da artık gereksiz `@UseGuards(RolesGuard)` (global guard zaten var).

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü, semantic search/pgvector, geniş kullanıcı katkısı (MVP'de): ELENDİ → Faz 2. KALICI.
- React Native mobil (MVP'de): ELENDİ (round 3) → web/PWA. KOŞULLU — retention kanıtlanırsa aç.
- Gurme Puanı/yorum-puanlama (MVP'de): ELENDİ (round 3). KALICI, Faz 2'ye kadar.
- Landing page ön-testi: ELENDİ (kullanıcı kararı).
- Plan 3'ün orijinal 6 sayfalı admin app kapsamı: ELENDİ (idea-red-team NO-GO + kullanıcı kararı)
  → 2 sayfaya daraltıldı. KALICI, gerçek kullanım pilot sonrası genişletme ihtiyacı gösterirse
  yeniden değerlendirilebilir.
