# GurmeGo — Infrastructure

**Versiyon:** 1.0 · **Tarih:** 2026-07-06 · **Bütçe hedefi:** $0-50/ay (MVP dönemi)

İlgili: [architecture.md](architecture.md) · [development-guidelines.md](development-guidelines.md)

---

## 1. Hosting Topolojisi

| Bileşen | Platform | Plan (başlangıç) |
|---|---|---|
| PostgreSQL + PostGIS + pgvector + Auth + Storage | **Supabase** | Free → Pro ($25) gerektiğinde |
| NestJS API | **Railway** (container) | Hobby (~$5) |
| Next.js web (tüketici) | **Vercel** | Hobby (free) |
| Next.js admin | **Vercel** (ayrı proje, erişim korumalı) | Hobby (free) |
| Mobil dağıtım | **Expo EAS** | Free katman; build kotası aşılırsa ücretli |
| DNS/CDN | Cloudflare | Free |

- Fotoğraflar: Supabase Storage + Cloudflare CDN önü; istemciye imzalı URL.
- **Redis yok (MVP kararı):** AI cache + rate limit sayaçları Postgres `unlogged` tablolarda. Kodda `CacheStore` interface — trafik büyüyünce Redis'e geçiş yalnızca adapter değişikliği.

## 2. Ortamlar

| Ortam | Amaç | Kaynak |
|---|---|---|
| `dev` | lokal geliştirme | Supabase CLI lokal stack (Docker) — postgis+pgvector dahil |
| `staging` | PR sonrası entegrasyon doğrulama | Supabase branch/ikinci proje + Railway staging service + Vercel preview |
| `prod` | canlı | yukarıdaki tablo |

- Vercel PR başına otomatik preview URL (web+admin).
- Secrets: her platformun kendi env yönetimi; repo'da yalnızca `.env.example`. LLM/embedding API anahtarları sadece API servisinde — istemciye asla inmez.

## 3. Veritabanı Yönetimi

- **Migration:** kod tabanlı — **Prisma migrate** ([development-guidelines.md §2](development-guidelines.md)); Supabase dashboard'dan manuel şema değişikliği **yasak**.
- Extension'lar migration ile: `postgis`, `pgvector`, `pg_trgm`.
- **Backup:** Supabase günlük otomatik yedek (Pro'da PITR). Ek güvence: haftalık `pg_dump` → obje depolama (cron).
- **Export (NFR-06):** `pnpm export:venues` cron'u haftalık JSON/CSV snapshot üretir.

## 4. CI/CD (GitHub Actions)

```
PR açıldı:
  lint + typecheck + test (Turborepo cache ile değişen paketler)
  → Vercel preview (web/admin otomatik)
main'e merge:
  migration'ları staging'e uygula → API'yi Railway staging'e deploy → smoke test
  → manuel onay (tag) → prod migration + deploy
Mobil:
  EAS build — release branch'te; OTA update (Expo Updates) küçük düzeltmeler için
```

- Prod deploy migration'dan **sonra** çalışır; geri alma = önceki container imajı + gerekiyorsa down migration.

## 5. İzleme & Loglama

| Alan | Araç | Not |
|---|---|---|
| Hata takibi | Sentry (free katman) | API + web + mobil tek projede |
| API log | Railway log + yapılandırılmış JSON log (pino) | Kullanıcı koordinatı loglanmaz (NFR-04) |
| Uptime | Better Stack / UptimeRobot free | `/health` ucu |
| DB | Supabase dashboard + `get_advisors` | Yavaş sorgu incelemesi |
| AI maliyeti | Günlük LLM çağrı sayısı + token metriği → basit dashboard | `ai_fallback_rate` ve cache hit oranı dahil ([ai-prompt-design.md §5](ai-prompt-design.md)) |

**Alarmlar:** API 5xx oranı, p95 gecikme > 500 ms (NFR-02 marjı), kürasyon kuyruğu bekleme > 72 saat (SLA). (AI harcama alarmı Faz 2'te eklenecek.)

## 6. Maliyet Tahmini (MVP, aylık)

**Not (2026-07-16):** AI/LLM/embedding kalemleri MVP'den çıkarıldı — semantic search Faz 2'e alındı (bkz. [docs/CHANGELOG.md](CHANGELOG.md)).

| Kalem | Tahmin |
|---|---|
| Supabase | $0 → $25 (Pro'ya geçince) |
| Railway API | ~$5-10 |
| Vercel | $0 |
| Expo EAS | $0 |
| Sentry/uptime | $0 |
| **Toplam** | **~$5-35/ay** ✅ bütçe içinde |

Ölçek tetikleyicileri: Supabase Pro (DB > 500 MB veya günlük aktif > ~1K), Redis ekleme (rate limit sayaç yükü), Railway ölçekleme (p95 bozulunca). Faz 2'te LLM (Haiku, cache'li ~binlerce sorgu/ay ~$1-5) + embedding (<$1) eklenecek.
