# Durum — 2026-09-22

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje — repo HazarAliyazicioglu/GurmeGo). Kaynak: 2026-09-08.

## Ürün vizyonu (2026-09-09)
Hedef kitle: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Marka: sıcak/editöryel kimlik. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
2026-09-22'de kullanıcı "projeyi a'dan z'ye, büyük şirket kalitesinde canlıya hazırla" dedi, tam yetki verdi. Kapsam 4 alt projeye bölündü: **1) tasarım sistemi** (PR #12 ✓) → **2) mobil dayanıklılık** (PR #13 ✓) → **3) altyapı/borç temizliği** (PR #14 ✓, kalanı bilinçli ertelendi) → 4) canlıya çıkış operasyonel hazırlığı (Plan 4e). 5) Açık ürün kararları (AK-02/AK-03) ayrı, kullanıcıya soru olarak duruyor.

Önceki tamamlananlar: Kritik 11/11 + Orta paket A (PR #4-#7) + venue-card kapak fotoğrafı (PR #8) + admin paketi 3/3 (PR #9-#11) — hepsi `master`'da.

## Şu an ne yapıyoruz
**Alt proje 3/4 (altyapı borcu) kısmen TAMAMLANDI (PR #14, 2026-09-22).** Dependabot eklendi, `packages/api-client`'ın yanıltıcı "tip güvenli istemci" iddiası düzeltildi. **Bilinçli ertelenenler** (aşağıya bkz): `venues.repository.ts`'in 487 satırlık dosya-boyutu bulgusu (bölmek risk/getiri dengesi net değil, kanıtlanmış bir bakım maliyeti gösterilmedi) ve test izolasyonu borcu (denetim raporunun kendisi "test sayısı önemli artmadıkça dokunmaya gerek yok" diyor).

## Sıradaki adım
Alt proje 4/4: **canlıya çıkış operasyonel hazırlığı (Plan 4e)** — uygulamanın DB rolünün `audit_log`'a yalnız INSERT+SELECT ile sınırlanması (ADR 006), `SUPABASE_JWT_ISSUER`/`AUDIENCE` env değişkenlerinin set edilmesi, dokümante edilen deploy hattının gerçekte kurulup kurulmadığının netleştirilmesi.

## Ertelenen/kapsam dışı bırakılan görevler (ayrı, gelecekte alınacak)
- `venues.repository.ts` dosya-boyutu bölme + backend test izolasyonu — bilinçli ertelendi, gerekçe yukarıda.
- `next/image` gerçek optimizasyonu — admin'e dosya yükleme + bilinen tek domain'den (ör. Supabase Storage) SONRA.
- Fraunces'ın gerçek uzun Türkçe mekan adlarıyla Playwright/tarayıcı doğrulaması (bu ortamda Playwright kurulu değil).
- Mobil fotoğraf önbellekleme (expo-image), harita yüklenemezse uyarı (düşük öncelik, adres zaten metin olarak gösteriliyor).
- Mobilde filtre değişiminde tek-kare "sonuç yok" mesajı titremesi, AuthScreen çift-tıklama yarışı — cihaz doğrulaması gerektirir.
- `FavoriteList` aynı-isim yarış durumu (`@@unique([userId, name])`) — ürün kuralı değişikliği.

## Bloke olanlar
- Yok. Supabase proje erişimi (env değişkenleri, DB rolü ayarı) gerekebilir — proje canlıya alınmadıysa bazı Plan 4e adımları sadece dokümantasyon/kod tarafında ilerletilebilir, gerçek Supabase panelinde uygulanması kullanıcı eylemi gerektirebilir.

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
- `apps/mobile` jest suite'inde ara sıra tek bir test 15sn timeout'la flake veriyor (`VenueDetailScreen`): KOŞULLU — CI'da görülürse önce yeniden çalıştır, PR diff'iyle ilgisizse gerçek regresyon değildir.
- `gh pr merge --squash` sonrası yerel `master`'ın squash-öncesi commit'leri varsa (ör. docs commit'leri feature branch'e alınmadan önce master'a doğrudan işlenmişse) yerel checkout "fast-forward yapılamıyor" hatası verir: ELENDİ, KALICI — PR GitHub'da yine de merge olmuş olur (`gh pr view --json state,mergedAt` ile doğrula), yerel `master`'ı `git reset --hard origin/master` ile hizala (içerik kaybı yok, squash zaten üstünde).
- `next.config.js`'de `images.remotePatterns: [{ hostname: "**" }]`: ELENDİ, KALICI — "sadece admin girdisi" savunması yanlış, `/_next/image?url=<keyfi>` endpoint'i herkese açık, bu bir açık proxy/kaynak-suistimali riski. Bilinen tek bir domain'e daraltılmadan next/image'a arbitrary-domain optimizasyonu ekleme.
