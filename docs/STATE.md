# Durum — 2026-09-25 (gün sonu)

## Veri sınırı
Codex: izinli ama **kota bitti, 2026-09-28'e kadar geri dönmüyor**. GLM: izinli. Kaynak: 2026-09-08 + bugünkü kota hatası.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23/25, pekiştirildi):** A-Z yetki verildi, kapanış sorusu bile sormadan sıradaki işe geç, özellik ekleme/çıkarma kararı da dahil. Yalnız gerçek Supabase/production erişimi gerektiren geri dönüşsüz adımlarda durulur.

## Şu an ne yapıyoruz
**2026-09-25, 3 commit:**
- `7f3c003` — web+admin `error.tsx`/`not-found.tsx` (cross-model-review geçti, 1 MAJOR reddedildi)
- `fb460e2` — REVIEW-PLAN.md'nin güncel olmadığı bir fork denetimiyle ortaya çıktı: 6/6 KRİTİK bulgu artık çözülü. Küçük kalan maddeler kapatıldı (double-submit guard, tab ikonları, ReportForm validasyonu, erisim-yok stili, manifest renk senkronu). Cross-model-review temiz.
- `61f857f` — **Web'de serbest metin arama eklendi** (`q` parametresi, ILIKE, repository katmanında). **Codex bu review'da kota sınırına takıldı** (yapılandırılmış rapor üretemedi) — kullanıcı onayıyla kendim review ettim (çapraz-model DEĞİL), 1 gerçek bulgu (LIKE wildcard escape eksikliği) bulup düzelttim, real-DB e2e testle doğruladım.

## Sıradaki adım
**Codex kotası 2026-09-28'e kadar yok — bu süre boyunca kod yazan işler için ya GLM'e (çapraz-model değil ama ikinci göz) ya da kullanıcı onayıyla kendi self-review'ime güvenmek gerekecek, bunu her seferinde açıkça belirt.** `61f857f`'in kotası dönünce gerçek bir cross-model-review'dan geçirilmesi önerilir. Bunun dışında: CSP eksikliği (web+admin, bilinçli ertelenmiş, orta öncelik) tek kalan orta öncelikli madde. Agent-yapılabilir gerçek blocker yok, kullanıcı tarafı: Supabase/Railway/Vercel/domain.

## Bloke olanlar
- **Codex kotası** (2026-09-28'e kadar) — cross-model-review bu süre boyunca GLM'e veya açıkça işaretlenmiş self-review'e düşüyor.
- Gerçek Supabase/Railway/Vercel hesapları + domain (kullanıcıya ait). Mobile crash reporting SDK'sı (Sentry) hesap gerektirdiği için Faz 2'ye bilinçli ertelendi.

## Yakın kararlar
- ADR 006: DB-trigger'lı append-only audit log → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU.
- Review/red-team'i tek turda bitirmeyi ummak · CI "yazıldı=çalışıyor" varsayımı · Codex çıktısını görmeden "çalışıyor" saymak: ELENDİ, KALICI.
- Bellek baskısı altında arka plan `codex exec`'i ısrarla tekrar denemek: ELENDİ, KALICI — ama bellek biraz boşaltılınca (2.4GB→5.4GB) başarıyla çalıştı, tamamen çözülemez değilmiş.
- Codex çıktısını "tokens used" satırı göründü diye otomatik geçerli saymak: ELENDİ, KALICI — kota hatası da "tokens used" satırıyla bitebiliyor, çıktının GERÇEKTEN yapılandırılmış bir review (BLOCKER/MAJOR/MINOR/TEMİZ) içerdiğini doğrula, sadece satırın varlığına güvenme.
- RTL'de `fireEvent.press`'i art arda `await`'siz çağırmak "overlapping act() calls" uyarısı üretiyor — testler geçiyor (kozmetik), tam gidermek zor. KOŞULLU.
- REVIEW-PLAN.md'deki "UYGULANMADI" etiketleri zamanla stale kalabiliyor — büyük bir denetim dokümanına dönmeden önce kodla çapraz kontrol et. KALICI.
- Jest `globalSetup` DB bağlantısı gerektiren bir projede, mocked-only bir unit test bile DB olmadan çalışamıyor (global, dosya-bazlı değil) — gerekirse `docker run postgis/postgis` + `prisma migrate deploy` ile geçici test DB'si kurulabilir, iş bitince `docker rm -f` ile temizlenir. KALICI, işe yarıyor.
- pino-http'de sadece bilinen alanı redact etmek · global tip adını gölgeleyen component import'u · Prisma7 `$connect()` lazy güveni · Worktree'de apps/api typecheck farkı · birden çok `@types/react` sürümü · zod v4 `.partial()` default enjeksiyonu · JS `/i` Türkçe "İ" eşleşmiyor: hepsi ELENDİ, KALICI.
