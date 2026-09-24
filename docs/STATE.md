# Durum — 2026-09-24 (gün sonu)

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje). Kaynak: 2026-09-08.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23, pekiştirildi):** A-Z yetki verildi, kapanış sorusu bile sormadan sıradaki işe geç. Yalnız gerçek Supabase/production erişimi gerektiren geri dönüşsüz adımlarda durulur.

## Şu an ne yapıyoruz
**Proje-geneli smoke test denetimi + REVIEW-PLAN.md'deki eski bulguların güncel kod üzerinde doğrulanması (2026-09-24).** Docker+gerçek Postgres/PostGIS ile tam denetim yapıldı (install→lint→typecheck→build→test→smoke-api→audit→mimari invariant taraması). Commit'lenen 5 fix:
- `62a3086` csv-parse güvenlik yaması (GHSA-8cw4-87c7-c6xx)
- `024896e` mobile/web/admin test flake fix'i (turbo paralellik → root script'te sıralı `--filter` zinciri; ilk deneme `dependsOn` kullanmıştı, cross-model-review MAJOR bulup düzeltti)
- `034c3bb`/`1a3968d` dokümantasyon + e2e paralellik-güvenliği araştırması (hipotez test edildi, doğrulanmadı, spekülatif fix yapılmadı)
- `ccca17f` **web+mobile'da eksik sign-out UI** (§4.1 KRİTİK — signOut() fonksiyonu vardı, hiçbir ekran çağırmıyordu), TDD + cross-model-review (3 MINOR, hepsi düzeltildi)
- `6adcd10` **web+admin'de eksik güvenlik header'ları** (§5.2 sistemik bulgu), cross-model-review TEMİZ

**YARIDA KALAN, COMMIT'LENMEMİŞ (disk'te hazır, çalışma dizininde):**
`apps/web/src/app/{error,not-found}.tsx` + spec'leri, `apps/admin/src/app/{error,not-found}.tsx` + spec'leri (§5.2/§3.1 "happy path only, error.tsx/not-found.tsx hiç yok" bulgusu). **Test/build/typecheck/lint hepsi yeşil, doğrulandı** — tek eksik cross-model-review. Codex review'ı 3 kez arka planda sistem bellek baskısı yüzünden `killed` oldu (sistemde 15.7GB'ın sadece 2.5GB'ı boştu, Firefox 10+ süreç ~4-5GB tüketiyordu) — kullanıcı "yarın gereksiz RAM yükü olmadan deneriz" dedi, bilerek durduruldu.

## Sıradaki adım
**Yarın ilk iş:** bellek uygunken `codex exec` ile yukarıdaki error/not-found diff'ini review'a gönder (prompt hazır, önceki mesajlarda var — diff scratchpad'de olmayabilir, `git diff HEAD -- apps/web/src/app/error.tsx apps/web/src/app/not-found.tsx apps/web/src/app/error.spec.tsx apps/web/src/app/not-found.spec.tsx apps/admin/src/app/error.tsx apps/admin/src/app/not-found.tsx apps/admin/src/app/error.spec.tsx apps/admin/src/app/not-found.spec.tsx` ile yeniden üret). Review TEMİZ/DÜZELTİLEBİLİR çıkarsa commit'le. Sonra REVIEW-PLAN.md §2.6/§3.2'deki kalan düşük öncelikli bulgulara (admin `erişim-yok` sayfası stilsiz, CSP eksikliği — ayrı, tarayıcı doğrulaması gerektiren iş) bakılabilir. Agent-yapılabilir gerçek blocker yok, kullanıcı tarafı: Supabase/Railway/Vercel/domain.

## Bloke olanlar
- Yok (agent tarafı, geçici bellek durumu hariç). Kullanıcıya ait: gerçek Supabase/Railway/Vercel hesapları + domain.

## Yakın kararlar
- ADR 006: DB-trigger'lı append-only audit log → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU.
- Review/red-team'i tek turda bitirmeyi ummak · CI "yazıldı=çalışıyor" varsayımı · Codex çıktısını görmeden "çalışıyor" saymak: ELENDİ, KALICI.
- Majör bağımlılık yükseltmesini "testler yeşil" ile kapatmak: ELENDİ, KALICI.
- `turbo.json`'da paket-özel `dependsOn` ile test task'larını zincirlemek: ELENDİ, KALICI — izole `--filter` çağrılarını kırıyor, sıralama root script'te yapılmalı.
- Global turbo `--concurrency=2` ile test flake'ini çözmeye çalışmak: ELENDİ, KALICI — `apps/api` e2e'lerinde 5 yeni başarısızlık açtı.
- Tek bir testin timeout'unu artırarak CPU-çekişmesi flake'ini "çözmek": ELENDİ, KALICI — kök neden çözülmediği için tekrarladı.
- Bellek baskısı altında arka plan `codex exec` komutunu ısrarla tekrar tekrar denemek: ELENDİ, KALICI — sistem otomatik `killed` ediyor, kullanıcı belleği boşaltana kadar beklemek gerekiyor, üç deneme yeterince kanıt.
- pino-http'de sadece bilinen alanı redact etmek: ELENDİ, KALICI.
- Test dosyasında `import Error from "./error"` gibi global tip/sınıf adını gölgeleyen bir isimle component import etmek: ELENDİ, KALICI — `new Error(...)` component'i çağırmaya çalışıp tsc hatası veriyor, `ErrorPage` gibi çakışmayan bir ad kullan.
- Prisma7 `$connect()` lazy güveni · Worktree'de apps/api typecheck farklı sonuç verebilir (`--force` ile bypass) · Workspace'te birden çok `@types/react` sürümü · zod v4 `.partial()` default enjeksiyonu · JS `/i` Türkçe "İ" eşleşmiyor: hepsi ELENDİ, KALICI.
