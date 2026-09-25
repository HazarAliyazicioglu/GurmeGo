# Durum — 2026-09-25 (gün sonu, 2. tur)

## Veri sınırı
Codex: izinli ama **kota bitti, 2026-09-28'e kadar geri dönmüyor**. GLM: izinli. Kaynak: 2026-09-08 + bugünkü kota hatası.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23/25, pekiştirildi):** A-Z yetki, kapanış sorusu bile sormadan sıradaki işe geç, özellik ekleme/çıkarma dahil. Yalnız gerçek Supabase/production erişimi gerektiren geri dönüşsüz adımlarda durulur.

## Şu an ne yapıyoruz
**2026-09-25, toplam 10 commit.** Sabah: error/not-found sayfaları + REVIEW-PLAN.md'nin stale olduğu keşfedildi (6/6 KRİTİK zaten çözülüymüş) + küçük backlog kapatıldı. Öğleden sonra: web'de serbest metin arama eklendi (`61f857f`) — Codex bu review'da **kota sınırına takıldı**, kullanıcı onayıyla self-review yapıldı (1 gerçek bulgu: LIKE wildcard escape eksikliği, düzeltildi). Kullanıcı "kota dönene kadar yapılabilecek her şeyi yap" dedi — REVIEW-PLAN.md'nin kalan tüm maddeleri tek tek elden geçirildi (çoğu zaten stale/çözülü bulundu), tarayıcı/hesap gerektirmeyen gerçek açıklar kapatıldı: JSON-LD structured data, Twitter card meta, ReportForm maxLength, venue-detail lazy loading, admin sign-out focus-visible. **REVIEW-PLAN.md'nin agent-yapılabilir backlog'u artık tükendi** — kalanlar ya tarayıcı doğrulaması (CSP, maskable icon) ya tasarım/hesap (OG görsel, Sentry) ya da Faz 2/büyük özellik (Gurme Puanı, semantic search, manuel mekan düzenleme UI).

## Sıradaki adım
**Codex kotası 2026-09-28'e kadar yok.** Bu süreçte yapılan TÜM kod değişiklikleri self-review ile geçti, çapraz-model DEĞİL — kota dönünce toplu bir cross-model-review yapılmalı (özellikle `61f857f` arama özelliği). Agent-yapılabilir güvenli/mekanik backlog bitti; sıradaki iş ya kullanıcının kendi hesap/tarayıcı erişimini gerektiriyor (Supabase/Railway/Vercel/domain, Sentry) ya da büyük bir yeni özellik/tasarım kararı (mode-based search, manuel mekan UI, Gurme Puanı) — bunlar için brainstorming'den geçmek gerekir.

## Bloke olanlar
- **Codex kotası** (2026-09-28'e kadar) — cross-model-review bu süre boyunca GLM'e veya açıkça işaretlenmiş self-review'e düşüyor.
- Gerçek Supabase/Railway/Vercel hesapları + domain (kullanıcıya ait).
- CSP header, maskable icon, root OG görseli — tarayıcı/tasarım doğrulaması gerektiriyor, bu ortamda güvenle yapılamaz.
- Mobile crash reporting SDK'sı (Sentry) — hesap gerektiriyor, Faz 2'ye bilinçli ertelendi.

## Yakın kararlar
- ADR 006: DB-trigger'lı append-only audit log → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU.
- Review/red-team'i tek turda bitirmeyi ummak · CI "yazıldı=çalışıyor" varsayımı · Codex çıktısını görmeden "çalışıyor" saymak: ELENDİ, KALICI.
- Bellek baskısı altında arka plan `codex exec`'i ısrarla tekrar denemek: ELENDİ, KALICI — ama bellek biraz boşaltılınca (2.4GB→5.4GB) başarıyla çalıştı.
- Codex çıktısını "tokens used" satırı göründü diye otomatik geçerli saymak: ELENDİ, KALICI — kota hatası da "tokens used" ile bitebiliyor, çıktının GERÇEKTEN yapılandırılmış bir review (BLOCKER/MAJOR/MINOR/TEMİZ) içerdiğini doğrula.
- RTL'de `fireEvent.press`'i art arda `await`'siz çağırmak "overlapping act() calls" uyarısı üretiyor — testler geçiyor (kozmetik). KOŞULLU.
- REVIEW-PLAN.md'deki "UYGULANMADI" etiketleri zamanla stale kalabiliyor — büyük bir denetim dokümanına dönmeden önce kodla çapraz kontrol et. KALICI, bugün 2. kez doğrulandı (çoğu madde stale çıktı).
- Jest `globalSetup` DB bağlantısı gerektiren bir projede, mocked-only bir unit test bile DB olmadan çalışamıyor — gerekirse `docker run postgis/postgis` + `prisma migrate deploy` ile geçici test DB'si kurulabilir, iş bitince `docker rm -f`. KALICI, işe yarıyor.
- CSP/maskable-icon/OG-görsel gibi tarayıcı veya tasarım doğrulaması gerektiren işleri "kota yenilenene kadar yapılabilecek her şeyi yap" talimatı kapsamında ATLAMAK doğru karar — yanlış doğrulanmış bir CSP kırık bir siteden daha kötü. KALICI.
- pino-http'de sadece bilinen alanı redact etmek · global tip adını gölgeleyen component import'u · Prisma7 `$connect()` lazy güveni · Worktree'de apps/api typecheck farkı · birden çok `@types/react` sürümü · zod v4 `.partial()` default enjeksiyonu · JS `/i` Türkçe "İ" eşleşmiyor: hepsi ELENDİ, KALICI.
