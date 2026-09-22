# ADR 006: Hesap verebilirlik kaydı — aynı DB'de DB-seviyesinde append-only `AuditLog`
Tarih: 2026-09-21 · Sürüm: v2 (aynı gün, `plan-red-team` sonrası revize)

## Bağlam
`docs/DENETIM-RAPORU.md` §1.2 Orta: rol atama ve toplu CSV yükleme "kim, ne zaman, ne yaptı" bilgisini hiçbir yerde
bırakmıyor. `VenueVersion` mekan düzenlemeleri için snapshot tutuyor ama `createdBy` her yerde `null`. Rol/yetki değişikliği
büyük ölçekli üründe standart denetim beklentisi; ele geçirilmiş bir admin hesabının geriye dönük izi yok.

## Seçenekler
1. **Aynı Postgres'te `AuditLog`, işlemle aynı transaction'da, DB trigger'ı ile append-only.** artı: atomik (tek-kayıtlı işlemlerde),
   yeni altyapı yok (ADR 001 ruhu), sorgulanabilir, append-only uygulama rolüne rağmen DB tarafından zorlanır. eksi: DB süper-kullanıcısı
   trigger'ı kaldırabilir (tamper-evident değil).
2. **Yapısal log (pino) → log servisi.** artı: DB'den bağımsız. eksi: atomik değil, log servisi yok (Plan 4e), sorgulanabilirlik zayıf.
3. **Yalnız `VenueVersion.createdBy`.** artı: en ucuz. eksi: rol atama ve CSV import'u kapsamaz.

## Karar
Seçenek 1, şu sözleşmeyle:
- **Atomiklik yalnız tek-kayıtlı işlemler için** (rol atama, mekan create/update/revert, kuyruk approve/reject): kayıt aynı `$transaction`'da; audit
  INSERT'i başarısızsa ana işlem de geri alınır (**fail-closed**). `AuditService.record` parametresi `Prisma.TransactionClient`'tır ve tüm çağıranlar eylemi yapan `tx`'i geçirir (tip düzeyinde *zorunlu* değil: `TransactionClient` yapısal olarak düz istemcinin alt kümesidir; atomikliği e2e testleri kanıtlar).
- **CSV import atomik DEĞİL** (satır-bazlı kısmi başarı mevcut ürün davranışı): *niyet-önce-etki* — işlemden önce `CSV_IMPORT_STARTED` (yazılamazsa import
  başlamaz), sonra `CSV_IMPORTED` özeti (yazılamazsa loglanır, girişim STARTED ile kanıtlı).
- **Append-only DB'de zorlanır**: migration'daki `BEFORE UPDATE OR DELETE` + `BEFORE TRUNCATE` trigger'ı `RAISE EXCEPTION`. Uygulama koduna güvenilmez.
- `actorId` **FK'sız** düz uuid: kullanıcı silinse de kayıt ne silinir ne güncellenir (`SET NULL` bir UPDATE olurdu ve append-only'yi delerdi).
- **PII sınırı (net):** yazılabilir = `actorId` (uuid), hedef id'ler, rol adı, alan-düzeyi minimal değişiklik (`before`/`after`), sayaçlar. Yazılamaz = e-posta, ad,
  kullanıcı konumu/koordinatı, mekan serbest metin içeriği, CSV satır içeriği. (`actorId` yönetici personelin sözde-kimliğidir; hesap verebilirlik amacıyla
  saklanır, KVKK silme talebinde gerekçeli istisna olarak belgelenir — Plan 4d'de netleştirilir.)

## Kabul edilen bedel
- **Tamper-evident değil:** trigger'ı kapatabilenler kaydı değiştirebilir: süper-kullanıcı, **tablo sahibi** (`ALTER TABLE … DISABLE TRIGGER`, `DROP TRIGGER`) ve `session_replication_role = replica` ayarlayabilen roller. İmza/hash zinciri yok. Bu yüzden Plan 4e'de uygulamanın DB rolü tablonun sahibi OLMAMALI ve `audit_log` üzerinde yalnız INSERT+SELECT yetkisi taşımalı (bkz. sinyaller).
- **Fail-closed:** audit yazılamıyorsa admin işlemi de başarısız olur (kullanılabilirlik pahasına hesap verebilirlik). Admin trafiği düşük olduğundan kabul.
- Her tek-kayıtlı admin yazması +1 INSERT (aynı transaction; kilit süresi marjinal artar).
- CSV audit'i atomik değil: STARTED var/IMPORTED yok durumu "yarım import"u temsil eder ve elle incelenmesi gerekir.
- Tablo sınırsız büyür; retention politikası şimdi yok.

## Erken uyarı sinyalleri (ölçüm kaynağı ve sıklığı dahil)
- **Boyut:** ayda bir `SELECT reltuples::bigint FROM pg_class WHERE relname='audit_log'` > 1.000.000 ⇒ partition/arşiv kararı aç.
- **Gecikme:** baseline (2026-09-21, B2 PR'ında ölçüldü, gerçek Postgres, `AdminVenuesService.update()` 200 çalıştırma): audit'siz p50 3.88 ms / p95 6.08 ms,
  audit'li p50 4.59 ms / p95 10.32 ms (fark p95 +4.2 ms, gürültülü). Her çeyrekte aynı ölçüm tekrarlanır; audit'li p95 baseline'ın (10.32 ms) +25 ms üstüne (≈35 ms) çıkarsa ⇒ yazım yolunu gözden geçir.
- **Yarım import:** haftalık `SELECT s.meta->>'importId' FROM audit_log s WHERE s.action='CSV_IMPORT_STARTED' AND s."createdAt" < now() - interval '1 hour' AND NOT EXISTS (SELECT 1 FROM audit_log f WHERE f.action='CSV_IMPORTED' AND f.meta->>'importId' = s.meta->>'importId')` sonucu boş değilse incele. STARTED ve IMPORTED kayıtları ortak `importId` (uuid) taşır; eşleşme oranı < %100 ⇒ import sessizce yarım kalmış.
- **Rol/yetki (Plan 4e):** prod DB rolü `audit_log`'un **sahibi olmaz**, yalnız INSERT+SELECT yetkisi taşır ve `session_replication_role` ayarlama yetkisi verilmez (trigger'a ek katman; sahip/superuser bypass'ını kapatır). Bu bir *eylem maddesi*, ADR varsayımı ihlali değildir;
  yapılmadan canlıya çıkılmaz. **Kurulum script'i hazır** (2026-09-22, cross-model-review sonrası v3):
  `scripts/production-db-role-setup.sql` — kısıtlı `gurmego_app` rolünü TEK transaction'da (BEGIN/COMMIT,
  yarım kalmış yetkilendirme riski yok) oluşturur, Supabase'in PostGIS/pgvector'ü genelde kurduğu
  `extensions` şemasına koşullu USAGE verir (şema yoksa sessizce atlar) VE rol seviyesinde
  `search_path`'i `public, extensions` yapar (2. review turunun MAJOR bulgusu: yalnız USAGE vermek
  `search_path`'i güncellemiyor, şema öneki olmadan çağrılan PostGIS fonksiyonları/`geography` tipi
  runtime'da "does not exist" hatası verirdi). Extension-adı kontrolü `vector` (proje adı `pgvector`
  olsa da gerçek extension adı bu) ve `session_replication_role` doğrulaması doğru katalog
  (`pg_parameter_acl`, PG15+) üzerinden yapılıyor. Yerel test DB'de (PostgreSQL 15.8, tüm düzeltmeler
  birlikte) gerçekten çalıştırılıp doğrulandı: `search_path` role'e doğru yazıldı, audit_log'a INSERT
  başarıyla yazıldı ve SELECT ile okundu, aynı satıra UPDATE **ve** DELETE "permission denied for table
  audit_log" ile reddedildi (trigger'a hiç ulaşmadan — GRANT seviyesinde durduruldu), normal bir tabloda
  (`City`) beklendiği gibi DELETE çalıştı (CRUD yetkisi var, bu tabloda kısıtlama yok), `rolsuper`/
  `rolcreatedb`/`rolcreaterole` hepsi false. Gerçek Supabase projesi kurulduğunda bir kez çalıştırılıp
  `DATABASE_URL` bu role yönlendirilecek — bu adım Supabase erişimi gerektirdiği için henüz UYGULANMADI,
  sadece hazırlandı.
- **Tetik (post-hoc):** ilk gerçek güvenlik soruşturmasında kaydın cevaplayamadığı bir soru çıkarsa (örn. "kim sildi") ⇒ imzalı/harici (append-only obje deposu)
  sürüme geçiş ADR'si açılır. Bu erken uyarı değil, gerçekleşmiş başarısızlığın işaretidir; bilerek ayrı tutuldu.

## Sonuç (sonradan doldurulur)
Tarih: — · Tuttu mu: — · Ne öğrendik: —
