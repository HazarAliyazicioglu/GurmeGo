# GurmeGo — Development Guidelines

**Versiyon:** 1.0 · **Tarih:** 2026-07-06

İlgili: [architecture.md](architecture.md) · [infrastructure.md](infrastructure.md)

---

## 1. Repo Yapısı (monorepo)

```
gurmego/
├─ apps/
│  ├─ api/        # NestJS + Prisma
│  ├─ mobile/     # React Native (Expo)
│  ├─ web/        # Next.js tüketici
│  └─ admin/      # Next.js kürasyon paneli
├─ packages/
│  ├─ shared/     # zod şemaları, ortak tipler, sabitler (ilçe listesi, enum'lar)
│  └─ api-client/ # OpenAPI'den üretilen istemci
├─ docs/          # bu dokümantasyon seti
├─ turbo.json
└─ pnpm-workspace.yaml
```

- Araçlar: **pnpm** + **Turborepo**. Node LTS sürümü `.nvmrc` ile sabitlenir.
- İş mantığı yalnızca `apps/api`; istemciler görüntüleme + istek katmanı.

## 2. Kod Standartları (TypeScript)

- `strict: true` her pakette; `any` yasak (kaçınılmazsa `// eslint-disable` + gerekçe).
- **Lint/format:** ESLint + Prettier; CI'da zorunlu, pre-commit hook (husky + lint-staged).
- **Validasyon:** tüm API girdileri zod ile (`packages/shared` şemaları); NestJS pipe entegrasyonu. Aynı şemalar istemci form validasyonunda yeniden kullanılır.
- **ORM: Prisma.** PostGIS/pgvector sorguları `$queryRaw` ile repository katmanında izole edilir — servis katmanı raw SQL görmez. Şema değişikliği yalnızca `prisma migrate` ile ([infrastructure.md §3](infrastructure.md)).
- Rule engine eşikleri asla hardcode edilmez — config/ayarlar tablosundan okunur ([rule-engine.md](rule-engine.md)).
- Kullanıcı koordinatı hiçbir log/analytics çağrısına yazılmaz (NFR-04) — code review kontrol maddesi.

## 3. Branch & Commit Kuralları

- **GitHub Flow:** `main` her zaman deploy edilebilir; kısa ömürlü feature branch → PR → squash merge.
- Branch adı: `feat/venue-detail`, `fix/search-cursor`, `chore/ci-cache`.
- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`. Kapsam opsiyonel: `feat(api): ...`. Otomatik changelog buradan üretilir.
- `main`'e doğrudan push kapalı (branch protection); PR + en az 1 onay + yeşil CI zorunlu.

## 4. Test Stratejisi (kritik yol odaklı)

| Katman | Kapsam | Araç |
|---|---|---|
| **Rule engine** (butik kuralı, Gurme Puanı formülü, güncellik, anomali) | Zorunlu unit — hedef ~%80+ bu modülde | Vitest/Jest |
| **Kürasyon akışı** (kuyruk → onay → Venue + versiyon) | Zorunlu integration (test DB ile) | Jest + Testcontainers/Supabase lokal |
| **Arama filtreleri** (yapısal sorgu + cursor pagination + PostGIS yakınlık) | Zorunlu integration | aynı |
| **AI filtre çıkarımı** | Prompt regression: örnek sorgu seti → beklenen filtre snapshot'ları; fallback yolu test edilir | fixture bazlı, canlı LLM CI'da çağrılmaz (mock) |
| **UI** | Smoke E2E: keşif→detay→favori, öneri gönder, admin onayla (3-4 senaryo) | Playwright (web/admin), Maestro (mobil, opsiyonel) |

- Genel kapsam yüzdesi eşiği **yok** — kritik modüller derin, geri kalan pragmatik.
- Her bugfix, önce hatayı üreten test ile gelir.

## 5. PR Süreci

1. PR şablonu: ne değişti, neden, nasıl test edildi, ilgili doküman güncellendi mi.
2. CI: lint + typecheck + test (Turborepo cache) + Vercel preview.
3. Review kontrol listesi: zod validasyonu var mı, rate limit etkilenen uç var mı, rule engine eşiği hardcode mu, koordinat loglanıyor mu, migration geri alınabilir mi.
4. Squash merge → staging otomatik deploy → smoke → tag ile prod ([infrastructure.md §4](infrastructure.md)).

## 6. Dokümantasyon Disiplini

- Mimari/kural değişikliği yapan PR, ilgili `docs/*.md` dosyasını aynı PR'da günceller.
- Açık kararlar (AK-01, AK-02, AK-03 — [prd.md §4](prd.md)) çözüldüğünde: prd.md güncellenir + karar tarihi ve gerekçe eklenir + etkilenen dokümanlara yansıtılır.
