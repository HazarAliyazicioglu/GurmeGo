# GurmeGo — Mimari Karar İndeksi (ADR)

- [ADR 001](adr/001-no-redis-postgres-cache-store.md) — Redis yok, rate limit/cache Postgres unlogged tabloda `CacheStore` interface arkasında (2026-07-24)
- [ADR 002](adr/002-postgis-raw-sql-repository-isolation.md) — PostGIS `$queryRaw` yalnızca `*.repository.ts` dosyalarında (2026-07-24)
- [ADR 003](adr/003-single-nestjs-monolith-public-and-admin.md) — Public + admin API tek NestJS monolitinde, ayrı servis değil (2026-07-24)
- [ADR 004](adr/004-user-location-via-http-header.md) — Kullanıcı konumu query param yerine `X-User-Location` header'ında (NFR-04) (2026-07-26)
