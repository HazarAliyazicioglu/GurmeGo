# Durum — 2026-09-22

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje — repo HazarAliyazicioglu/GurmeGo). Kaynak: 2026-09-08.

## Ürün vizyonu (2026-09-09)
Hedef kitle: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Marka: sıcak/editöryel kimlik. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
`docs/DENETIM-RAPORU.md` (53 bulgu) uygulanıyor. Kritik 11/11 + Orta paket A (backend hardening, PR #4-#7) + venue-card kapak fotoğrafı (PR #8) + admin paketi 3/3 (PR #9-#11, veri kalitesi/rol atama/mekan geçmişi) hepsi `master`'da. Yeni plan dosyası yazılmadı — kullanıcı 2026-09-21'de tüm yetkiyi devretti, PR akışı/CI/Codex review kuralları aynen geçerli.

## Şu an ne yapıyoruz
Admin paketi TAMAMLANDI (2026-09-22). API 54 suite / 366 test, admin 10 suite / 106 test, web 26 suite / 155 test, shared 9 suite / 75 test — hepsi yeşil.

## Sıradaki adım
Kullanıcıdan yeni yön bekleniyor. Adaylar: (a) mobil `DiscoveryScreen`'e aynı venue-card fotoğraf eksikliğini taşımak (bounded görev), (b) `docs/DENETIM-RAPORU.md`'deki kalan Orta/Düşük bulgular, (c) Plan 4e canlıya çıkış hazırlığı (aşağıya bkz).

## Bloke olanlar
- Yok. Plan 4e (canlıya çıkış) eylem maddeleri hâlâ açık: uygulamanın DB rolü `audit_log` sahibi olmayacak/yalnız INSERT+SELECT (ADR 006); SUPABASE_JWT_ISSUER/AUDIENCE set edilecek.

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
