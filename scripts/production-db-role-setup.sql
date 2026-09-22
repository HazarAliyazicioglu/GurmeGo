-- ADR 006 (docs/adr/006-audit-log-append-only-table.md) eylem maddesi: "prod DB rolü audit_log'un
-- sahibi olmaz, yalnız INSERT+SELECT yetkisi taşır ve session_replication_role ayarlama yetkisi
-- verilmez". Bu yapılmadan canlıya çıkılamaz (append-only trigger, tablo sahibi/superuser
-- tarafından ALTER TABLE ... DISABLE TRIGGER ile bypass edilebilir).
--
-- NASIL ÇALIŞTIRILIR (bir kere, gerçek Supabase projesi kurulduğunda):
--   1. Supabase SQL Editor'da (ya da migration'ları çalıştıran ayrıcalıklı rolle, ör. `postgres`)
--      bu dosyayı ÇALIŞTIRMADAN ÖNCE <APP_ROLE_PASSWORD> yerine gerçek, güçlü bir parola yaz.
--      Bu dosyayı DOLU parolayla asla commit etme -- yalnız placeholder'la commit'te kalır.
--   2. Script'i çalıştır.
--   3. `apps/api`'nin PRODUCTION DATABASE_URL'ini bu yeni role (gurmego_app) işaret edecek
--      şekilde güncelle. `prisma migrate deploy` (CI/CD) AYRI, ayrıcalıklı bir bağlantı
--      (`postgres` rolü / Supabase'in migration bağlantısı) kullanmaya devam eder -- bu iki
--      bağlantı kasıtlı olarak farklıdır, aynı DATABASE_URL'i paylaşmazlar.
--   4. `DATABASE_URL`'i değiştirdikten sonra API'yi yeniden başlat/deploy et -- var olan
--      bağlantı havuzu URL değişikliğini kendiliğinden almaz (cross-model-review bulgusu:
--      "kesintisiz geçiş" bu script tarafından garanti edilmiyor, bir deploy adımı gerektirir).
--   5. Yerelde/CI'da (tek rolün -- `postgres` -- hem migration hem runtime için kullanıldığı
--      ortamlarda) bu script'i çalıştırmaya gerek yok; bu sadece production'a özel bir sıkılaştırma.
--   6. DİKKAT (3. cross-model-review turunun bulgusu): production `DATABASE_URL`'de Prisma
--      bağlantı string'ine `?schema=public` gibi bir parametre EKLENİRSE, bu aşağıdaki
--      `ALTER ROLE ... SET search_path`'i ezip yalnızca `public`'i kullanabilir -- PostGIS
--      fonksiyonları yine "does not exist" hatası verir. `DATABASE_URL`'i güncellerken bu
--      parametrenin OLMADIĞINI doğrula (ya da varsa `public,extensions` olarak ayarla).
--
-- ATOMİKLİK (cross-model-review MAJOR bulgusu, düzeltildi): tüm CREATE ROLE + GRANT'lar TEK
-- transaction'da. Postgres'te DDL transactional'dır (MySQL'in aksine) -- bir GRANT ortada
-- başarısız olursa TÜMÜ geri alınır, yarım yetkilendirilmiş bir rol KALMAZ. İkinci kez
-- çalıştırma (rol zaten varsa) transaction'ın en başında, hiçbir GRANT uygulanmadan hata verir.

BEGIN;

CREATE ROLE gurmego_app WITH LOGIN PASSWORD '<APP_ROLE_PASSWORD>';

GRANT USAGE ON SCHEMA public TO gurmego_app;

-- Supabase, PostGIS/pgvector gibi extension'ları VARSAYILAN OLARAK `public` DEĞİL, `extensions`
-- şemasına kurar (yerel Docker test DB'sindeki `postgis/postgis` imajından FARKLI bir kural).
-- Fonksiyonlara EXECUTE zaten varsayılan olarak PUBLIC'e açık (Postgres kuralı, doğrulandı) --
-- ama SADECE USAGE vermek YETMEZ (2. cross-model-review turunun bulduğu MAJOR): USAGE şemayı
-- `search_path`'e EKLEMEZ, sadece o şemadaki nesnelere erişime izin verir. Uygulama
-- (venues.repository.ts) PostGIS fonksiyonlarını/`geography` tipini şema öneki OLMADAN
-- kullanıyor -- bağlantının `search_path`'i bu şemayı içermezse, GRANT başarılı olsa bile
-- "function does not exist" hatası alınır. Bu yüzden ROL SEVİYESİNDE search_path ayarlanıyor
-- (aşağıda) -- var olmayan bir şema search_path'te sessizce atlanır (Postgres kuralı), o yüzden
-- bu satır `extensions` şeması yokken de (yerelde GERÇEKTEN denendi) hatasız çalışır.
--
-- Gerçek projede hangi şemaya kurulduğunu ayrıca doğrula: `SELECT nspname FROM pg_extension e
-- JOIN pg_namespace n ON e.extnamespace = n.oid WHERE extname IN ('postgis','vector');`
-- (extension adı `pgvector` DEĞİL `vector`dür -- Supabase belgeleri) -- `extensions` DIŞINDA bir
-- isim dönerse hem bu bloktaki hem ALTER ROLE'deki şema adını ona göre düzelt.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA extensions TO gurmego_app';
  END IF;
END $$;

ALTER ROLE gurmego_app SET search_path TO public, extensions;

-- Normal tablolar: tam CRUD. `audit_log` bilerek bu listede YOK -- aşağıda ayrı, dar bir GRANT alıyor.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "City", "District", "Venue", "VenueVersion", "ContributionQueue",
  "User", "FavoriteList", "Favorite", "rate_limit_counters"
TO gurmego_app;

-- ADR 006'nın istediği tam kısıtlama: yalnız INSERT + SELECT. UPDATE/DELETE/TRUNCATE bilerek
-- YOK -- append-only trigger zaten bunu engelliyor, ama bu ikinci bir katman: trigger'ı
-- (yanlışlıkla veya kötü niyetle) devre dışı bırakma yetkisi olmayan bir rol için trigger'a
-- ihtiyaç bile kalmıyor, çünkü UPDATE/DELETE zaten yetki hatasıyla en baştan reddediliyor.
--
-- GERÇEKTEN DOĞRULANDI (yerel test DB, docker, 2026-09-22): bu rolle DELETE denemesi
-- "permission denied for table audit_log" ile reddedildi (trigger'a hiç ulaşmadan); aynı rolle
-- INSERT çalıştı ve satır gerçekten yazıldı (SELECT ile doğrulandı, sonra owner rolüyle
-- trigger geçici DISABLE edilip temizlendi). UPDATE reddi de ayrıca doğrulanmıştı.
GRANT SELECT, INSERT ON "audit_log" TO gurmego_app;

COMMIT;

-- gurmego_app'in audit_log trigger'ını bypass edecek yolu, BU SCRIPT'İN VERDİĞİ yetkilerle YOK:
-- - Tablo SAHİBİ değil (CREATE TABLE'ı çalıştıran rol sahip olur, gurmego_app hiç çalıştırmıyor).
-- - ALTER TABLE / DROP TRIGGER için sahiplik veya superuser gerekir -- ikisi de yok
--   (`rolsuper`/`rolcreatedb`/`rolcreaterole` hepsi false, doğrulandı).
-- - `NOBYPASSRLS` varsayılan (RLS bu tabloda açıksa bile bypass edemez) -- ayrıca BYPASSRLS
--   trigger'ları veya tablo-seviyesi GRANT'ları bypass ETMEZ, sadece RLS politikalarını atlar.
-- CROSS-MODEL-REVIEW DÜZELTMESİ (2. tur): "session_replication_role ayarlamak HER ZAMAN
-- superuser gerektirir" iddiası fazla kesindi -- PostgreSQL 15+'ta `GRANT SET ON PARAMETER
-- session_replication_role` ile superuser olmayan bir role bu yetki AYRICA verilebilir. Bu
-- script öyle bir GRANT içermiyor, dolayısıyla gurmego_app bunu ayarlayamaz -- ama bu script'in
-- KENDİSİNİN garantisi bu kadar; production'da BAŞKA bir yerde (ör. bir önceki DBA tarafından)
-- böyle bir GRANT zaten verilmişse bu script onu geri almaz. Çalıştırmadan önce doğrula (ilk
-- verdiğim sorgu YANLIŞTI -- `information_schema.role_column_grants` sütun yetkileri içindir,
-- parametre yetkileri PG15+'ta AYRI bir katalogda, `pg_parameter_acl`'de tutulur):
-- `SELECT parname, paracl FROM pg_parameter_acl WHERE parname = 'session_replication_role';`
-- Boş/hiç satır dönmezse hiç kimseye özel bir GRANT verilmemiş demektir (varsayılan: sadece
-- superuser ayarlayabilir).
-- (Doğrulama sorgusu: SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = 'gurmego_app'; hepsi false dönmeli.)

-- Şu anki ve gelecekteki dizinler (id arama/sıralama) için gerekli -- CREATE INDEX değil, sadece
-- var olan indeksleri kullanma hakkı zaten SELECT/INSERT/UPDATE/DELETE'e dahil, ayrı bir GRANT
-- gerekmez (Postgres'te indeksler ayrı bir yetki nesnesi değildir).

-- PostGIS fonksiyonları (ST_DWithin vb.) için EK bir GRANT gerekmiyor -- Postgres'te fonksiyonlara
-- EXECUTE varsayılan olarak PUBLIC'e açıktır (tablolardan farklı), yerel test DB'sinde
-- `SELECT proacl FROM pg_proc WHERE proname = 'st_dwithin'` boş (= varsayılan) döndüğü doğrulandı.
-- pgvector şu an hiçbir migration/sorguda kullanılmıyor (semantic search Faz 2) -- bu satır ileride
-- pgvector devreye girdiğinde de aynı gerekçeyle (varsayılan PUBLIC EXECUTE) geçerli kalır.

-- BİLİNMEYEN/DOĞRULANAMADI (gerçek Supabase erişimi olmadan kontrol edilemedi): eğer gerçek
-- projede bu tablolarda Row Level Security (RLS) açıksa, gurmego_app bu GRANT'lara rağmen
-- satırlara erişemez -- ya RLS politikaları tanımlanmalı ya da (bu app zaten Supabase'in
-- PostgREST/RLS katmanını değil, doğrudan Prisma bağlantısını kullandığından) RLS bu tablolarda
-- hiç açılmamalı. Script'i gerçek projede çalıştırmadan önce `SELECT relrowsecurity FROM
-- pg_class WHERE relname IN (...)` ile kontrol et. Ayrıca `public` şeması dışında (ör. Supabase'in
-- kendi `auth`/`storage` şemaları) çağrılabilir SECURITY DEFINER fonksiyonlar varsa, bunların
-- trigger'ı bypass edip etmediği bu script'in kapsamı dışında -- ayrıca denetlenmeli.
