# Durum — 2026-09-24

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje). Kaynak: 2026-09-08.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23, pekiştirildi):** A-Z yetki verildi, kapanış sorusu bile sormadan sıradaki işe geç. Yalnız gerçek Supabase/production erişimi gerektiren geri dönüşsüz adımlarda durulur. Kod tarafı tamamlandı (bkz. önceki günlük), kalan tek gerçek blocker altyapı/hesap tarafında (kullanıcıya ait).

## Şu an ne yapıyoruz
**Proje-geneli smoke test denetimi (2026-09-24, kullanıcı isteğiyle) — 2 gerçek bulgu kapatıldı:**
- **Docker+gerçek Postgres/PostGIS ile tam denetim:** install→lint→typecheck(force)→build(4 app)→**tüm test suite'i gerçek DB'ye karşı**→smoke-api.sh→pnpm audit→mimari invariant taraması (ContributionQueue bypass, konum loglama, raw SQL sızıntısı — hepsi temiz).
- **fix (62a3086):** `csv-parse` 7.0.1→7.0.2, GHSA-8cw4-87c7-c6xx (moderate prototype-pollution) kapatıldı. cross-model-review bir MINOR buldu (lockfile'da csv-parse dışı webpack-zinciri paketleri de güncellenmiş) — build/typecheck/lint ile zararsız olduğu doğrulandı.
- **fix (024896e):** Mobile test flake'i (`docs/REVIEW-PLAN.md` Adım 1'de 2 kez CI'da görülmüş, bugün 3. kez tekrarladı, bu sefer web+admin'de de aynı semptom) — kök neden turbo'nun 4 paketin test suite'lerini tam paralel çalıştırması (CPU çekişmesi). Root `pnpm test` artık `turbo run test --filter=...` çağrılarını ardışık zincirliyor. İlk deneme `turbo.json`'da `dependsOn` kullanmıştı — cross-model-review bunun izole `turbo run test --filter=X` çağrılarını kırdığını buldu (MAJOR), root script'e taşınarak düzeltildi. 3 ayrı cache-bypass koşumda sıfır flake.
- **Diğer bulgular (aksiyon gerektirmedi/düşük öncelik):** Yetim worktree klasörü (`gurmego-nestjs12`, boştu) silindi. `pnpm audit`'teki kalan 2 high+5 moderate hepsi Prisma CLI'nin mysql2/deepmerge-ts zincirinde — bu proje sadece Postgres kullanıyor, runtime'da hiç yüklenmiyor, upstream bekleniyor.

## Sıradaki adım
Agent-yapılabilir iş kalemi kalmadı. Kullanıcıya sorulup kapatılmayan tek gerçek backlog: `apps/api`'nin e2e testleri paralel/sıra-bağımlı çalışmaya güvenli değil (aynı gerçek DB'yi transaction-izolasyonu olmadan paylaşıyorlar) — bugünkü fix bunu ele almadı, sadece CI test-flake'ini kapattı. CI paralelleştirilirse veya suite büyürse gündeme gelecek. Kullanıcı: gerçek Supabase/Railway/Vercel/domain kurulumu.

## Bloke olanlar
- Yok (agent tarafı). Kullanıcıya ait: gerçek Supabase/Railway/Vercel hesapları + domain.

## Yakın kararlar
- ADR 006: DB-trigger'lı append-only audit log → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU.
- Review/red-team'i tek turda bitirmeyi ummak · CI "yazıldı=çalışıyor" varsayımı · Codex çıktısını görmeden "çalışıyor" saymak: ELENDİ, KALICI.
- Majör bağımlılık yükseltmesini "testler yeşil" ile kapatmak: ELENDİ, KALICI — canlı `tsc`/worktree probe + gerçek DB/boot testi şart.
- `turbo.json`'da paket-özel `dependsOn` ile test task'larını zincirlemek: ELENDİ, KALICI — `turbo run test --filter=X` gibi izole çağrıları da task graph'a bağlayıp kırıyor; sıralama root script'te (`&&` ile ayrı `--filter` çağrıları) yapılmalı, task graph'a değil.
- Global turbo `--concurrency=2` ile test flake'ini çözmeye çalışmak: ELENDİ, KALICI — `apps/api`'nin e2e testlerinde 5 yeni, sıra-bağımlı başarısızlık açtı (paylaşılan gerçek DB, transaction-izolasyonu yok).
- Tek bir testin timeout'unu artırarak CPU-çekişmesi kaynaklı flake'i "çözmek": ELENDİ, KALICI — kök neden çözülmediği için 3. kez farklı paketlerde tekrarladı.
- pino-http'de sadece bilinen alanı redact etmek: ELENDİ, KALICI — varsayılan TÜM header'lar loglanır.
- Prisma7 `$connect()` lazy güveni · `prisma migrate dev` çıktısını olduğu gibi uygulamak · Worktree'de apps/api typecheck'i farklı sonuç verebilir (turbo cache eski worktree yolundan "cache hit" döndürebilir — `--force` ile bypass et) · Workspace'te birden çok `@types/react` sürümü · zod v4 `.partial()` default enjeksiyonu · JS `/i` Türkçe "İ" eşleşmiyor: hepsi ELENDİ, KALICI.
