# Durum — 2026-09-22

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje — repo HazarAliyazicioglu/GurmeGo). Kaynak: 2026-09-08.

## Ürün vizyonu (2026-09-09)
Hedef kitle: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Marka: sıcak/editöryel kimlik. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22, kullanıcı beyanı, hâlâ geçerli):** "a'dan z'ye ... yetki sende, durmana gerek yok ... tüm yetki sende artık" — planlama, tasarım, kod, PR, merge dahil A-Z yetki verildi; yalnız çok kritik noktalarda durulabilir (örn. gerçek Supabase/production erişimi gerektiren geri dönüşsüz adımlar). Soru sormadan ilerle. Kapsam 4 alt projeye bölündü: **1) tasarım sistemi** (PR #12 ✓) → **2) mobil dayanıklılık** (PR #13 ✓) → **3) altyapı/borç temizliği** (PR #14 ✓, kalanı bilinçli ertelendi) → **4) canlıya çıkış hazırlığı** (PR #28 ✓ + PR #29 ✓, DB rol script'i 3 cross-model-review turundan geçti, TEMİZ). 5) Açık ürün kararları (AK-02/AK-03) ayrı, kullanıcıya soru olarak duruyor.

Önceki tamamlananlar: Kritik 11/11 + Orta paket A (PR #4-#7) + venue-card kapak fotoğrafı (PR #8) + admin paketi 3/3 (PR #9-#11) — hepsi `master`'da.

## Şu an ne yapıyoruz
**Alt proje 4/4 (canlıya çıkış hazırlığı) TAMAMLANDI (PR #28+#29).** `scripts/production-db-role-setup.sql` 3 cross-model-review turundan geçti (atomiklik → search_path MAJOR düzeltmesi → TEMİZ), yerel Docker DB'de uçtan uca doğrulandı. HENÜZ gerçek Supabase'e uygulanmadı (erişim yok, ADR 006 eylem maddesi).

**Dependabot 13 PR'ının (#15-27) triyajı yapıldı (2026-09-22):** #15 (pnpm/action-setup — CI'daki `version:` çakışmasını düzelttim), #19 (jsdom), #23 (@types/node, lockfile çakışması nedeniyle branch'i master'dan yeniden kurup pnpm install ile tazeledim) canlı doğrulama + CI yeşille MERGE EDİLDİ. #16, #17 (actions/checkout, setup-node) CI yeşil ama merge edilemedi — `gh` token'ında `workflow` scope yok (`.github/workflows/ci.yml` değiştiriyorlar), KULLANICI `gh auth refresh -s workflow` çalıştırmalı ya da GitHub'dan elle merge etmeli. #18 (minor-and-patch grubu, fastify 5.11.3→5.12.5 içeriyor) `apps/api` typecheck'i @fastify/{helmet,compress,multipart} ile kırıyor — ELENDİ (bu oturumda), ayrı incelenmeli. Kalan 7 majör bump (#20/22/26 NestJS trio birlikte gitmeli, #21 tailwind v4 config formatı kırar, #24 zod v4 packages/shared'ın her yerinde, #25 prisma v7 iki majör atlıyor, #27 typescript v6) bilinçli ERTELENDİ — "majör yükseltme = canlı probe" dersi gereği her biri kendi brainstorming/plan/red-team döngüsünü hak ediyor, tek oturumda toplu geçilmez.

## Sıradaki adım
(a) Kullanıcı `gh auth refresh -s workflow` çalıştırırsa #16/#17 merge edilir; (b) 7 ertelenen majör bump + #18 için ayrı ayrı brainstorming (her biri architectural sınıf) planlanacak; (c) AK-02/AK-03 açık ürün kararları; (d) gerçek Supabase projesi kurulduğunda DB rol script'i uygulanacak.

## Ertelenen/kapsam dışı bırakılan görevler (ayrı, gelecekte alınacak)
- `venues.repository.ts` dosya-boyutu bölme + backend test izolasyonu — bilinçli ertelendi (risk/getiri net değil).
- `next/image` gerçek optimizasyonu — admin'e dosya yükleme + bilinen tek domain'den (ör. Supabase Storage) SONRA.
- Fraunces'ın gerçek uzun Türkçe mekan adlarıyla Playwright doğrulaması; mobil fotoğraf önbellekleme (expo-image); mobilde filtre-değişimi titremesi/çift-tıklama yarışı — hepsi cihaz/tarayıcı doğrulaması gerektirir.
- `FavoriteList` aynı-isim yarış durumu (`@@unique([userId, name])`) — ürün kuralı değişikliği.

## Bloke olanlar
- Yok. Gerçek Supabase proje erişimi gerektiren adımlar (DB rolü script'ini uygulama, JWT env'lerini set etme) kod/doküman tarafında hazır, sadece uygulanmayı bekliyor.

## Yakın kararlar
- ADR 006: aynı DB'de DB-trigger'lı append-only audit log, aynı transaction'da → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU — öncelik yeniden bakılabilir.
- Review/red-team'i tek turda bitirmeyi ummak · CI'nın "yazıldı = çalışıyor" varsayımı · cross-session guard'larda TEK sinyal: ELENDİ, KALICI.
- Codex review çıktısını görmeden "çalışıyor" saymak: ELENDİ, KALICI. Kural: `codex exec … - < dosya` (stdin), bitiş = çıktıda `tokens used` var.
- Majör bağımlılık yükseltmesini "testler yeşil" ile kapatmak: ELENDİ, KALICI (canlı probe gerekir).
- `prisma migrate dev` çıktısını olduğu gibi uygulamak: ELENDİ, KALICI — PostGIS GiST index'ini "drift" sanıp DROP önerir, elle çıkar.
- Workspace'te birden çok `@types/react` sürümü: ELENDİ, KALICI — `scripts/check-single-types-react.mjs` korur.
- Paylaşılan (`packages/shared`) bir zod şemasına zorunlu alan eklemek, sadece değiştirdiğin app'in testine bakıp "yeşil" saymak: ELENDİ, KALICI — o şemayı runtime doğrulayan HER app'in fixture'ı kırılır (web+mobile+admin ayrı `lib/api.spec.ts`'leri var). Yeni alan eklerken tüm `apps/`'i grep'le.
- JS regex `/i` ile Türkçe büyük "İ" ile başlayan kelime eşleştirmek: ELENDİ, KALICI — `/işlem/i`, "İşlem..."e uymaz. Alt-dizeyi büyük harfsiz kur.
- Bir sayfada "seçili öğe" değişirken önceki seçimin async yanıtlarını guard'lamamak: ELENDİ, KALICI (mekan-geçmişi PR'ında 2 MAJOR bug) — arama/seçim değiştiğinde eski state'i hemen temizle + bir ref'te "hâlâ bu mu seçili" kontrolü yap, sadece request-id yetmez.
- Mobile gerçek Expo dev server'da hiç elle denenmemiş; safe-area-context jest mock, Expo `EXPO_PUBLIC_*` dinamik erişim: ELENDİ, KALICI.
- `apps/mobile`'da `VenueDetailScreen`'in İLK testi CI'da (meşgul paylaşımlı runner, jest-expo/react-native-maps soğuk-başlangıç maliyeti) global 15sn jest timeout'unu aşıyordu (2 ayrı PR'da görüldü): ELENDİ, KALICI — sadece o testin kendi timeout'u 20sn'ye çıkarıldı (`it(..., 20000)`), global'e dokunulmadı.
- `gh pr merge --squash` sonrası yerel `master`'ın squash-öncesi commit'leri varsa (ör. docs commit'leri feature branch'e alınmadan önce master'a doğrudan işlenmişse) yerel checkout "fast-forward yapılamıyor" hatası verir: ELENDİ, KALICI — PR GitHub'da yine de merge olmuş olur (`gh pr view --json state,mergedAt` ile doğrula), yerel `master`'ı `git reset --hard origin/master` ile hizala (içerik kaybı yok, squash zaten üstünde).
- `next.config.js`'de `images.remotePatterns: [{ hostname: "**" }]`: ELENDİ, KALICI — "sadece admin girdisi" savunması yanlış, `/_next/image?url=<keyfi>` endpoint'i herkese açık, bu bir açık proxy/kaynak-suistimali riski. Bilinen tek bir domain'e daraltılmadan next/image'a arbitrary-domain optimizasyonu ekleme.
- Dependabot'un fastify'ı `5.11.3`→`5.12.5` (patch!) bump'ı `@fastify/{helmet,compress,multipart}` ile typecheck'i kırdı: ELENDİ (PR #18), KOŞULLU — fastify'ın PATCH sürümleri bile plugin tipleriyle kırılabiliyor (önceki Fastify 5 cors regresyonuyla aynı aile), tek başına ayrı incelenmeli, grup PR içinde geçiştirilmemeli.
