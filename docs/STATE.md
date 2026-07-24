# Durum — 2026-07-24

## Aktif plan
`docs/superpowers/plans/2026-07-24-mvp-backend-foundation.md` — Plan 1/4 (Backend + Data Foundation).
**TAMAMLANDI: 24/24 task.** `subagent-driven-development` ile yürütüldü (worktree:
`mvp-backend-foundation`, branch `worktree-mvp-backend-foundation`). Her task TDD + Claude task-reviewer
(spec+quality) geçti. Sonunda Task 24: Claude whole-branch review (4 Important bulgu, hepsi
düzeltildi) + zorunlu Codex cross-model-review (3 High/Critical bulgu — JWT alg/issuer/audience
eksikti, admin queue approve/reject atomik değildi, revert() venue/version eşleşmesi kontrol
etmiyordu — hepsi düzeltildi ve doğrulandı). Sonuç: 77/77 test geçiyor, tsc temiz, lint 0 hata.

`docs/superpowers/plans/2026-07-24-web-pwa-client.md` — Plan 2/4 (Web/PWA Client). **TAMAMLANDI:
12/12 task (0-11).** Plan-red-team (Codex, verdict YENIDEN BOL) fixleri implementasyondan önce
uygulandı. Her task subagent-driven-development ile (implementer + Claude task-reviewer + Codex
delegating-ui-work görsel pass, ilgili task'larda). Task 6'da gerçek bir SSR çökme hatası bulundu
(WhatsappShareButton render sırasında window'a erişiyordu) ve düzeltildi. Task 11'de apps/api'nin
gerçek process olarak hiç boot olamadığı keşfedildi (@fastify/static eksikti, jest'in in-process
TestingModule'ü bunu maskeliyordu) + packages/shared'ın build adımı olmadığı için compiled
dist/main.js'in production'da çökeceği tespit edildi (bkz. "Acil" bölümü). Sonunda: Claude
whole-branch review + zorunlu Codex cross-model-review (kod-reviewer agent'ı otomatik Codex'e
delege ediyor) — 0 Critical, 7 Important bulgu (favoriler ucdan uca kirikti: addFavoriteVenue
validasyonsuzdu, eklenen mekanlar hicbir zaman geri gosterilmiyordu, liste secimi
deterministik degildi, auth hatasi sonsuz loading'e dusuruyordu; kategori hizli-rota degerleri
gercek veriyle eslesmiyordu (tum sonuclar bos donuyordu); hizli-rota ve normal filtreler ayni
state'i coordinasyonsuz eziyordu; .nvmrc Node 20 diyordu ama bir bagimlilik Node >=22 gerektiriyordu)
— hepsi düzeltildi ve dogrulandi (apps/api 77/77, apps/web 52/52, packages/shared 3/3). Ayrica
design spec'in "service worker + temel onbellekleme" gereksinimi hicbir task'a donusturulmemis
bir plan bosluguydu — bulundu, minimal bir service worker eklendi. Henüz master'a merge
edilmedi — worktree'de duruyor, sıradaki plan(lar) da aynı worktree'de devam edecek, hepsi
bittiğinde tek seferde review edilip merge edilecek.

Yol haritası: 1) Backend+Data ✅ TAMAMLANDI → 2) Web/PWA client ✅ TAMAMLANDI → 3) Admin panel UI (sırada) → 4) Infra/CI/KVKK/pilot.

**Teknik notlar:**
- Codex CLI sandbox'ı proje dizini dışındaki dosyaları okuyamıyor — süresiz takılıyor, önce proje içine kopyala.
- Yerel Supabase stack bu worktree'de `npx supabase start` ile ayakta (portlar 54421-54429, `Gastrova`
  adlı başka bir projeyle çakışmayı önlemek için varsayılan 54321-54329'dan kaydırıldı — bkz.
  `supabase/config.toml`). DB: `postgresql://postgres:postgres@127.0.0.1:54422/postgres`.
- Docker Desktop'ın çalışır durumda olması gerekiyor (`npx supabase start` başlatamazsa önce Docker'ı aç).

## Şu an ne yapıyoruz
Kullanıcı Plan 1'i uçtan uca otonom yürütmemi istedi ("sormadan devam et, hata varsa düzelt, arayüzlü
neredeyse çalışan bir app olana kadar bu döngüde devam et"). Plan 1 bu şekilde tamamlandı — 24 task,
her biri gerçek DB'ye/gerçek HTTP isteğine karşı doğrulanarak. Süreçte bulunup düzeltilen önemli
hatalar: Task 6 GIST index kullanılmıyordu (~460x yavaş), Task 16 mekan oluşturma DB'de tamamen
çöküyordu + CSV import Fastify'da hiç çalışmıyordu (ikisi de gerçek DB/HTTP ile doğrulanarak
düzeltildi), Task 9/12/19'da NestJS exception wire-format hatası (3 kez, aynı hata sınıfı — üçüncüsünde
regresyon testiyle kapatıldı), Task 23'te eslint hiç kurulu değildi (CI hiç yeşile geçemezdi) +
turbo.json Turbo 2.x uyumsuzluğu (root-level pnpm run test/lint/typecheck Task 0'dan beri kırıktı).

## Sıradaki adım
Plan 2 (Web/PWA client) — `superpowers:writing-plans` ile yazılacak, sonra `plan-red-team`, sonra
aynı worktree'de `subagent-driven-development` ile yürütülecek. Kullanıcıya sormadan devam.

## Bloke olanlar
- Yok.

## Yakın kararlar
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5
- Plan 1 mimari kararları: docs/adr/001-003
- Plan 1 yürütme kaydı (task-by-task, bulgular, düzeltmeler): worktree'deki
  `.superpowers/sdd/progress.md` (worktree silinirse kaybolur — git log kalıcı kayıt)

## Acil: production build kırık (Plan 2 Task 11'de keşfedildi)
`packages/shared`'ın build adımı yok — `apps/api`'nin derlenmiş `dist/main.js`'i Node'un native
TS type-stripping'i altında extensionless import'lar yüzünden çöküyor. Jest'in in-process
`TestingModule`'ü bunu maskeler (gerçek process boot'u hiç tetiklemiyor), bu yüzden 77 testin
hiçbiri yakalamadı — yalnızca Task 11'in gerçek `apps/api` process'ini ayağa kaldırma denemesi
buldu. Herhangi bir gerçek Docker/production deploy `node dist/main.js` çalıştırırsa aynı anda
çöker. Plan 4'ten önce (herhangi bir gerçek deploy denemesinden önce) çözülmeli: `packages/shared`'a
bir build adımı (tsc/tsup) eklenip `apps/api`'nin ona derlenmiş çıktı üzerinden bağımlı olması
gerekiyor, extensionless import'lara güvenmeden.

## Ertelenen takip maddeleri (Plan 4 / gerçek Supabase projesi kurulunca)
- Rol kaynağı kopuk: AdminUsersService DB'ye User.role yazıyor ama JwtAuthMiddleware rolü JWT'nin
  user_role claim'inden okuyor — gerçek senkron için Supabase custom access token hook gerekiyor.
- Rol string case'i (küçük harf decorator'lar vs. büyük harf Prisma enum) — gerçek JWT claim casing'i
  Supabase projesi kurulunca doğrulanmalı.
- RateLimitGuard req.ip kullanıyor, trustProxy yok — gerçek reverse proxy arkasında tüm kullanıcılar
  aynı IP'yi paylaşabilir. rate_limit_counters satırları hiç temizlenmiyor (yavaş büyüme).
- VenueVersion snapshot'ı yalnızca admin-queue approve() akışında oluşuyor, doğrudan admin CRUD'da değil.
- isBoutique DRAFT durumunda true olabiliyor (kural PUBLISHED gerektiriyor); kısmi update'lerde bayat kalabiliyor.
- REPORT onayı hiçbir düzeltme uygulamadan verifiedAt'i yeniliyor — ürün semantiği sorusu, kullanıcıya sorulmalı.
- eslint no-explicit-any/no-unused-vars "warn" (74 önceden var olan kullanım), "error"a sıkılaştırılmalı.
- Plan 2 Task 4: açık/kapalı (open-now) filtresi api-spec.md'de var ama Plan 1 hiç implemente etmedi
  (`VenueListQuerySchema`'da `openNow` yok, repository'de opening-hours karşılaştırması yok) — web UI'da
  da bilerek eklenmedi (var olmayan filtreyi UI'da göstermek çalışıyormuş gibi görünüp hiçbir şey yapmazdı).
  Küçük, sınırlı iş: `openNow: z.coerce.boolean().optional()` şemaya + Europe/Istanbul saat dilimi
  duyarlı SQL karşılaştırması repository'ye.
- Plan 2 final whole-branch review'dan Minor bulgular (bloke etmiyor, backlog):
  - E2E smoke suite 2 senaryo kapsıyor (keşif→detay→bildir, favori-gating→giriş); development-guidelines.md
    §4'ün hedefi 4-5 senaryo (harita, WhatsApp paylaşım, giriş yapmış favori akışı eksik) — Task 11'in
    brief'i yalnızca 2 senaryo istemişti, plan metninin kendisi dar kapsamlıydı.
  - `useGeolocation` hook'u aynı ağaçta iki kez mount ediliyor (`district-picker.tsx` ve
    `discovery-client.tsx`), bu yüzden `getCurrentPosition` iki kez tetikleniyor — plan tek izin
    promptu varsaymıştı ama hook paylaşılan state/provider değil, her mount kendi isteğini yapıyor.
  - `discovery-client.tsx`/`category-quick-route.tsx`'te `setVenues` çağrılarında sıra koruması yok —
    yavaş/gecikmeli bir yanıt daha yeni bir seçimi ezebilir (haritanın bbox loader'ındaki
    request-sequence guard pattern'i burada uygulanmadı).

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü, semantic search/pgvector, geniş kullanıcı katkısı (MVP'de): ELENDİ → Faz 2. KALICI.
- "Butik" tanımı salt DB kuralı: ELENDİ, hâlâ tam ölçülebilir değil — kaynak-linki önerildi (Sorun 3).
- React Native mobil (MVP'de): ELENDİ (round 3) → web/PWA ile pilot. KOŞULLU — retention kanıtlanırsa aç.
- Gurme Puanı/yorum-puanlama (MVP'de): ELENDİ (round 3, 4 ajan+Codex mutabakatı). KALICI, Faz 2'ye kadar.
- Landing page ön-testi: ELENDİ (kullanıcı kararı). KOŞULLU — pilot sonrası Codex'in eşikleri uygulanacak.
- Plan 2 Task 9: FavoriteButton'da double-click guard yok — hizli art arda tiklama
  getFavoriteLists/createFavoriteList'i eszamanli iki kez tetikleyip iki "Favorilerim" listesi
  olusturabilir. Kucuk iş: handleClick'e bir pending/disabled state eklemek.
