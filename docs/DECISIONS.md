# GurmeGo — Mimari Karar İndeksi (ADR)

- [ADR 001](adr/001-no-redis-postgres-cache-store.md) — Redis yok, rate limit/cache Postgres unlogged tabloda `CacheStore` interface arkasında (2026-07-24)
- [ADR 002](adr/002-postgis-raw-sql-repository-isolation.md) — PostGIS `$queryRaw` yalnızca `*.repository.ts` dosyalarında (2026-07-24)
- [ADR 003](adr/003-single-nestjs-monolith-public-and-admin.md) — Public + admin API tek NestJS monolitinde, ayrı servis değil (2026-07-24)
- [ADR 004](adr/004-user-location-via-http-header.md) — Kullanıcı konumu query param yerine `X-User-Location` header'ında (NFR-04) (2026-07-26)
- [ADR 005](adr/005-native-mobile-app-for-mvp.md) — MVP tüketici deneyimi native app (React Native/Expo), web/PWA değil — `idea-red-team` NO-GO dedi, kullanıcı bilerek reddetti (2026-09-07)
- [ADR 006](adr/006-audit-log-append-only-table.md) — Rol/CSV/mekan işlemleri için aynı DB'de append-only `AuditLog`, aynı transaction'da (2026-09-21)
