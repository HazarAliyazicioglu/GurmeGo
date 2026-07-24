# Proje skill haritası — GurmeGo

## Evrensel taban (global, `~/.claude/skills/`, tüm projelerde kurulu)
- Frontend/UI: `impeccable`, `ui-ux-pro-max`, `motion` — `delegating-ui-work` üzerinden Codex'e referans
- Backend: `nestjs-best-practices`
- Database/ORM: `prisma-cli`, `prisma-client-api`, `prisma-database-setup`, `prisma-postgres`
- DevOps: `devops-engineer`
- Skill keşfi: `find-skills`

## Proje-özel eklemeler (sadece GurmeGo, `.claude/skills/`)
- Monorepo: `turborepo-monorepo` (giuseppe-trisciuoglio/developer-kit, 1.7K kurulum) — 2026-07-23, architecture.md §3'teki pnpm+Turborepo iskeleti kurulurken kullanılacak
- Şema validasyonu: `zod-schema-validation` (mindrally/skills, 868 kurulum) — 2026-07-23, `packages/shared`'daki API+client ortak zod şemaları için
- Mobil: `expo-react-native-performance` (pproenca/dot-skills, 1.1K kurulum) — 2026-07-23, `apps/mobile` için. **2026-07-24: React Native MVP'den Faz 2'ye ertelendi (round 3 panel + Codex koşullu-GO), bu skill MVP/pilot döneminde kullanılmayacak — kurulum duruyor, Faz 2 açılınca devreye girer.**
- Coğrafi arama: `postgis` (resmi postgis/postgis org reposu, 202 kurulum — düşük ama kaynak resmi) — 2026-07-23, repository katmanındaki `ST_DWithin`/`ST_Distance` sorguları için

## Ertelenenler
- pgvector/semantic search skill'i (timescale/pg-aiguide@pgvector-semantic-search): KURULMADI. Gerekçe: docs/STATE.md'de semantic search MVP'den Faz 2'ye alındı, ELENDİ notu var. Faz 2 açıldığında yeniden değerlendirilir.
- Supabase Auth: güçlü aday yok (en iyisi 663 kurulum, Next.js'e özel, NestJS guard senaryosuna uymuyor). find-skills ile tekrar aranabilir.
