# Durum — 2026-09-23

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje). Kaynak: 2026-09-08.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23, kullanıcı beyanı, pekiştirildi):** A-Z yetki verildi, kapanış sorusu bile sormadan sıradaki işe geç. Yalnız gerçek Supabase/production erişimi gerektiren geri dönüşsüz adımlarda durulur. 4 alt proje + AK-02 + Dependabot majör bump triyajı (7/7) tamam. **Şu an: "projeyi tamamlama" değerlendirmesinden çıkan iki agent-yapabilir eksik de kapatıldı** (aşağı bkz.) — kalan tek gerçek blocker altyapı/hesap tarafında (kullanıcıya ait).

## Şu an ne yapıyoruz
**Proje tamamlama değerlendirmesi (2026-09-23, fork araştırması) + iki eksik kapatıldı:**
- **Structured logging (pino) — MERGE (PR #31, 03166d0).** `nestjs-pino` bağlandı, NFR-04 (`x-user-location` redact) + Codex review'ın bulduğu **gerçek MAJOR güvenlik açığı**: `Authorization` bearer token'ları da loglara sızıyordu (pino-http varsayılan olarak tüm header'ları logluyor) — redact listesine eklendi, gerçek istekle doğrulandı. İkinci bulgu: `logger.error(message, err)` çağrı sırası ters — nestjs-pino sadece Error İLK argümansa `err` alanını (stack dahil) ekliyor, tersi sessizce siliniyordu — izole script ile doğrulanıp 3 çağrı yeri düzeltildi.
- **Mobile React Error Boundary — MERGE (PR #32, b85220b).** REVIEW-PLAN'ın "en yüksek riskli bulgu"su kapandı. TDD ile yazıldı, Codex review 2 MINOR buldu (tek kök boundary = bir sekme hatası tüm app'i unmount eder — bilinçli tradeoff, koda not düşüldü; retry testi "hata devam ediyor" senaryosunu kapsamıyordu — test eklendi).
- **Kalan gerçek "tamamlanma" blocker'ı tamamen kullanıcıya ait:** gerçek Supabase projesi + DB rol script'inin uygulanması (kod hazır), Railway/Vercel hesapları + deploy pipeline kurulumu (`infrastructure.md`'nin "bilinçli MVP kararı: henüz kurulmadı" dediği tek gerçek production blocker), domain seçimi. Agent bunları yapamaz.
- **Haftalık bulut rutini kuruldu** (Pazartesi 09:02 TR saati, trig_01EmTq2Gm49KADsXUcLM6zGC): PR #18 (fastify plugin uyumluluğu) ve #24 (zod v4 NO-GO) durumunu otonom tekrar kontrol eder, gerekirse merge eder, her durumda STATE.md günceller.

**Dependabot 7 majör bump triyajı (2026-09-23) — TAMAMLANDI:** #21 Tailwind4 MERGE (Codex erişilebilirlik regresyonu buldu/düzeltti), #25 Prisma7+#27 TS6 bundled MERGE (Codex gerçek prod bug'ı buldu), #20/#22/#26 NestJS12 koordineli MERGE (PR #30 — Codex `trustProxy` fail-closed güvenlik regresyonunu buldu, kodda işaretlendi), #18 upstream'de bloklu, #24 zod4 NO-GO. Detay: git log.

## Sıradaki adım
Agent-yapılabilir iş kalemi kalmadı. Kullanıcı: gerçek Supabase/Railway/Vercel/domain kurulumu. Haftalık rutin #18/#24'ü otonom izliyor. AK-03 (gelir modeli) Faz 2'ye açık bırakıldı, zorlanmadı.

## Bloke olanlar
- Yok (agent tarafı). Kullanıcıya ait: gerçek Supabase/Railway/Vercel hesapları + domain — bunlar olmadan "production'a çıkış" tamamlanamaz, kod/script tarafı hazır.

## Yakın kararlar
- ADR 006: DB-trigger'lı append-only audit log → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU.
- Review/red-team'i tek turda bitirmeyi ummak · CI "yazıldı=çalışıyor" varsayımı · Codex çıktısını görmeden "çalışıyor" saymak: ELENDİ, KALICI. `codex exec … - < dosya` (stdin), bitiş = `tokens used`.
- Codex kotası dolduğunda SABİT bir saatte yenileniyor (mesajdaki saat = gerçek reset zamanı), "birazdan tekrar dene" değil: ELENDİ, KALICI.
- Majör bağımlılık yükseltmesini "testler yeşil" ile kapatmak: ELENDİ, KALICI — canlı `tsc`/worktree probe + gerçek DB/boot testi şart, mock yetmez.
- Dependabot bir paket ailesinden sadece BİR üyeyi yükseltebiliyor, kırık kombinasyon oluşturuyor: ELENDİ, KALICI — merge etmeden önce ailenin diğer üyelerinin durumunu kontrol et.
- `console.error(msg, err)`'ü blind bir şekilde `logger.error(msg, err)`'e çevirmek: ELENDİ, KALICI — nestjs-pino'da argüman sırası TERS (`err` ilk argüman olmalı), aksi halde hata detayı sessizce kayboluyor; her logging kütüphanesi geçişinde gerçek log çıktısını ampirik doğrula.
- pino-http gibi bir HTTP logger eklerken "sadece bildiğim hassas alanı redact ederim" varsayımı: ELENDİ, KALICI — varsayılan olarak TÜM request header'ları loglanır (Authorization dahil), redact listesini bilinen tüm hassas header'lar için kur, tek bir alanla sınırlama.
- Prisma7 driver adapter'da `$connect()` lazy: ELENDİ, KALICI — boot-time kanıt için gerçek sorgu şart.
- Worktree'de `apps/api` typecheck'i bazen master'dan FARKLI (yanlış) hata verebiliyor: ELENDİ, KALICI — gerçek CI'da doğrula.
- `prisma migrate dev` çıktısını olduğu gibi uygulamak: ELENDİ, KALICI.
- Workspace'te birden çok `@types/react` sürümü: ELENDİ, KALICI — `scripts/check-single-types-react.mjs` korur.
- Paylaşılan zod şemasına zorunlu alan eklemek, tek app'in testine bakıp "yeşil" saymak: ELENDİ, KALICI.
- JS regex `/i` ile Türkçe büyük "İ" eşleştirmek: ELENDİ, KALICI.
- Seçili öğe değişirken önceki async yanıtları guard'lamamak: ELENDİ, KALICI.
- `gh pr merge --squash` sonrası yerel `master` "fast-forward yapılamıyor" hatası: ELENDİ, KALICI — `git reset --hard origin/master`.
- `next.config.js`'de `images.remotePatterns: [{hostname:"**"}]`: ELENDİ, KALICI.
- zod v4 `.partial()` default alanları sessizce output'a enjekte ediyor: ELENDİ, KALICI.
