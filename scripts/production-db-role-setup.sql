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
--   4. Yerelde/CI'da (tek rolün -- `postgres` -- hem migration hem runtime için kullanıldığı
--      ortamlarda) bu script'i çalıştırmaya gerek yok; bu sadece production'a özel bir sıkılaştırma.
--
-- Bu script idempotent DEĞİLDİR (CREATE ROLE ikinci çalıştırmada hata verir) -- production'da
-- bir kere çalıştırılacak bir kurulum adımıdır, tekrarlanan bir migration değildir.

CREATE ROLE gurmego_app WITH LOGIN PASSWORD '<APP_ROLE_PASSWORD>';

GRANT USAGE ON SCHEMA public TO gurmego_app;

-- Normal tablolar: tam CRUD. `audit_log` bilerek bu listede YOK -- aşağıda ayrı, dar bir GRANT alıyor.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "City", "District", "Venue", "VenueVersion", "ContributionQueue",
  "User", "FavoriteList", "Favorite", "rate_limit_counters"
TO gurmego_app;

-- ADR 006'nın istediği tam kısıtlama: yalnız INSERT + SELECT. UPDATE/DELETE/TRUNCATE bilerek
-- YOK -- append-only trigger zaten bunu engelliyor, ama bu ikinci bir katman: trigger'ı
-- (yanlışlıkla veya kötü niyetle) devre dışı bırakma yetkisi olmayan bir rol için trigger'a
-- ihtiyaç bile kalmıyor, çünkü UPDATE/DELETE zaten yetki hatasıyla en baştan reddediliyor.
GRANT SELECT, INSERT ON "audit_log" TO gurmego_app;

-- gurmego_app'in audit_log trigger'ını bypass edecek hiçbir yolu olmamalı:
-- - Tablo SAHİBİ değil (yukarıdaki GRANT bunu zaten sağlamıyor, sahiplik ayrı bir kavram --
--   CREATE TABLE'ı çalıştıran rol sahip olur, gurmego_app hiç CREATE TABLE çalıştırmıyor).
-- - `session_replication_role` ayarlamak SUPERUSER gerektirir -- gurmego_app zaten superuser değil.
-- - ALTER TABLE / DROP TRIGGER için sahiplik veya superuser gerekir -- ikisi de yok.
-- Bu satırlar bir GRANT değil, yukarıdaki tasarımın DOĞRULAMASI: gurmego_app hiçbir zaman
-- CREATEDB, CREATEROLE veya SUPERUSER ile oluşturulmamalı.
-- (Doğrulama sorgusu: SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = 'gurmego_app'; hepsi false dönmeli.)

-- Şu anki ve gelecekteki dizinler (id arama/sıralama) için gerekli -- CREATE INDEX değil, sadece
-- var olan indeksleri kullanma hakkı zaten SELECT/INSERT/UPDATE/DELETE'e dahil, ayrı bir GRANT
-- gerekmez (Postgres'te indeksler ayrı bir yetki nesnesi değildir).

-- PostGIS fonksiyonları (ST_DWithin vb.) için EK bir GRANT gerekmiyor -- Postgres'te fonksiyonlara
-- EXECUTE varsayılan olarak PUBLIC'e açıktır (tablolardan farklı), yerel test DB'sinde
-- `SELECT proacl FROM pg_proc WHERE proname = 'st_dwithin'` boş (= varsayılan) döndüğü doğrulandı.

-- BİLİNMEYEN/DOĞRULANAMADI (gerçek Supabase erişimi olmadan kontrol edilemedi): eğer gerçek
-- projede bu tablolarda Row Level Security (RLS) açıksa, gurmego_app bu GRANT'lara rağmen
-- satırlara erişemez -- ya RLS politikaları tanımlanmalı ya da (bu app zaten Supabase'in
-- PostgREST/RLS katmanını değil, doğrudan Prisma bağlantısını kullandığından) RLS bu tablolarda
-- hiç açılmamalı. Script'i gerçek projede çalıştırmadan önce `SELECT relrowsecurity FROM
-- pg_class WHERE relname IN (...)` ile kontrol et.
