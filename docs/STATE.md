# Durum — 2026-09-22

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje — repo HazarAliyazicioglu/GurmeGo). Kaynak: 2026-09-08.

## Ürün vizyonu (2026-09-09)
Hedef kitle: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Marka: sıcak/editöryel kimlik. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22, kullanıcı beyanı, hâlâ geçerli):** "a'dan z'ye ... yetki sende, durmana gerek yok ... tüm yetki sende artık" — planlama, tasarım, kod, PR, merge dahil A-Z yetki verildi; yalnız çok kritik noktalarda durulabilir (örn. gerçek Supabase/production erişimi gerektiren geri dönüşsüz adımlar). Soru sormadan ilerle. Kapsam 4 alt projeye bölündü: **1) tasarım sistemi** (PR #12 ✓) → **2) mobil dayanıklılık** (PR #13 ✓) → **3) altyapı/borç temizliği** (PR #14 ✓, kalanı bilinçli ertelendi) → **4) canlıya çıkış hazırlığı** (PR #28 ✓ + PR #29 ✓, DB rol script'i 3 cross-model-review turundan geçti, TEMİZ). 5) Açık ürün kararları (AK-02/AK-03) ayrı, kullanıcıya soru olarak duruyor.

Önceki tamamlananlar: Kritik 11/11 + Orta paket A (PR #4-#7) + venue-card kapak fotoğrafı (PR #8) + admin paketi 3/3 (PR #9-#11) — hepsi `master`'da.

## Şu an ne yapıyoruz
**Alt proje 4/4 (canlıya çıkış hazırlığı) TAMAMLANDI (PR #28 + PR #29, 2026-09-22).** `scripts/production-db-role-setup.sql` 3 cross-model-review turundan geçti: (1) atomiklik/session_replication_role/extensions şeması, (2) search_path eksikliği (MAJOR) + extension adı + yanlış doğrulama kataloğu, (3) TEMİZ verdikt. Yerel Docker test DB'de uçtan uca doğrulandı: search_path role'e yazıldı, audit_log INSERT+SELECT çalıştı, UPDATE+DELETE reddedildi, rolsuper/createdb/createrole false. HENÜZ gerçek Supabase'e uygulanmadı (erişim yok, ADR 006'da eylem maddesi olarak duruyor). Not: PR #28'de Codex kotası bir kez doldu, o tur kendi (tek-model) review'ımla ilerlendi (kullanıcı onayıyla); PR #29'un review'ı gerçek çapraz-model (Codex, yüksek efor) oldu.

Dependabot (PR #14'ün eklediği config) 13 PR açtı (#15-27) — çoğu majör versiyon atlaması, henüz TRİYAJ EDİLMEDİ, hiçbiri merge edilmedi (STATE.md'nin "majör yükseltmeyi testler yeşil ile kapatma" dersi geçerli).

## Sıradaki adım
Kullanıcıdan yön bekleniyor: (a) Dependabot PR'larını (#15-27) tek tek triyaj et, (b) AK-02/AK-03 açık ürün kararlarını netleştir, (c) gerçek Supabase projesi kurulduğunda `scripts/production-db-role-setup.sql`'i uygula.

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
