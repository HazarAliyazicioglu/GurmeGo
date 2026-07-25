# GurmeGo — Plan 4a: `packages/shared` Build Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the production-crashing bug where `apps/api` imports `packages/shared` as
uncompiled TypeScript source, and prove the fix with a real (not mocked) process-boot smoke test
wired into CI — closing the gap that let this bug survive three prior plans undetected.

**Architecture:** `packages/shared` gains a real `tsc` build step (`dist/` output, already
configured via its existing `tsconfig.json`) plus a `prepare` lifecycle script so `dist/` exists
immediately after any `pnpm install`, independent of Turborepo's task graph. A new bash smoke-test
script boots the real compiled `apps/api/dist/main.js` with `node` (no `ts-node`, no Jest) against
a real local Postgres and polls `/health` with a bounded, per-request-timeout loop, checking for
an exact `200` — proving the fix works outside any TypeScript-aware runtime.

**Tech Stack:** TypeScript (`tsc`, no new bundler), bash, existing Turborepo/pnpm workspace, existing GitHub Actions CI, local Supabase CLI stack (Postgres).

## Global Constraints

- Node version used everywhere is `.nvmrc`'s actual content — do not hardcode a version number
  anywhere in code, scripts, or docs written by this plan (read the file at execution time).
- No new runtime dependency for the build step — plain `tsc`, no bundler (`tsup` etc. rejected by
  idea-red-team as unnecessary; the existing inherited `tsconfig.base.json` already produces
  correct CommonJS + declaration output).
- Any command that needs Turbo's local binary must use `pnpm exec turbo ...`, never a bare
  `turbo ...` (bare `turbo` is not guaranteed to be on `PATH` in a clean shell/CI).
- This plan makes no real cloud-account or spend-incurring changes.
- **This repository has no `origin` git remote configured** (verified: `git remote -v` prints
  nothing). No task in this plan may assume `git push` reaches GitHub or that a GitHub Actions run
  can be observed — CI wiring (Task 3) is verified by running the *same commands* locally, not by
  watching a real workflow run.

---

## Task 1: Smoke-test script proving the bug is real (RED)

**Files:**
- Create: `scripts/smoke-api.sh`

**Interfaces:**
- Consumes: `apps/api/dist/main.js` (built via `apps/api`'s existing `nest build`, invoked in Step
  4 below); a **reachable, already-migrated** local Postgres at the connection string passed via
  `DATABASE_URL` (this task does NOT start or migrate a database — see Step 3, a required
  precondition check); `DATABASE_URL`/`SUPABASE_JWKS_URL` env vars; the `bash`, `node`, `curl` CLI
  tools (all already used elsewhere in this repo's tooling).
- Produces: `scripts/smoke-api.sh` — a script Task 2 and Task 3 reuse verbatim; exit code 0 = API
  booted and answered `/health` with an exact `200` within a bounded ~10s window, exit code 1 = it
  did not (crashed, wrong status code, timed out, port already occupied, or
  `apps/api/dist/main.js` is missing).

- [ ] **Step 1: Confirm the local Postgres precondition and get the real connection details —
      this task assumes a running stack, it does not create one**

Run (from the repo root — Supabase CLI walks up to find `supabase/config.toml` regardless of
which subdirectory you invoke it from, verified empirically both ways in this repo):
```bash
npx supabase status
```
Expected: output shows the local stack running, including `API_URL` and `DB_URL` lines. **Do not
assume the ports are `54321`/`54322`** — `apps/api/.env.example`'s defaults are stale for this
specific project's `supabase/config.toml` (which uses a non-default port range so it can run
alongside other local Supabase projects on the same machine). Read the actual `API_URL`/`DB_URL`
from this command's output and use those exact ports in every step below — do not copy the
example values below verbatim if your `supabase status` output differs. If the command reports
the stack is stopped, run `npx supabase start` first (can take a minute on first run).

- [ ] **Step 2: Apply migrations so the precondition is real, not assumed**

Run — **pass `DATABASE_URL` explicitly**, using your own Step 1 `DB_URL` value, so this genuinely
targets the stack you just confirmed rather than whatever `apps/api/.env` happens to contain:
```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54422/postgres" \
pnpm --filter @gurmego/api exec prisma migrate deploy
```
Expected: `No pending migrations to apply.` or a list of migrations being applied, ending
successfully — either output means the schema this smoke test's `/health` check depends on
(Prisma's connection pool, verified at `PrismaService.onModuleInit`) is genuinely in place, not
merely assumed from a prior session.

- [ ] **Step 3: Create `scripts/smoke-api.sh`**

```bash
#!/usr/bin/env bash
# Boots the REAL compiled apps/api/dist/main.js with plain `node` (no ts-node, no Jest) and
# polls /health for an exact 200. This is the only valid proof that packages/shared's build
# output is actually consumable at runtime -- `tsc --noEmit` passing is NOT sufficient (that's
# exactly how this bug survived three prior plans undetected).
set -uo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SUPABASE_JWKS_URL:?SUPABASE_JWKS_URL is required}"

PORT="${PORT:-3000}"
API_DIST="apps/api/dist/main.js"

# Set up cleanup before any exit path exists, so a temp file never leaks even if we exit early
# (missing dist, port already occupied) before the API process itself is started.
LOG_FILE="$(mktemp)"
PID=""
cleanup() {
  [ -n "$PID" ] && kill "$PID" 2>/dev/null || true
  [ -n "$PID" ] && wait "$PID" 2>/dev/null || true
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

if [ ! -f "$API_DIST" ]; then
  echo "FAIL: $API_DIST does not exist. Build apps/api first (pnpm exec turbo run build --filter=@gurmego/api...)." >&2
  exit 1
fi

# Refuse to run if something is already answering on $PORT -- otherwise a stray unrelated
# service could make this script false-positive as if our process were healthy.
if curl -s -o /dev/null --max-time 1 "http://localhost:${PORT}/health" 2>/dev/null; then
  echo "FAIL: something is already listening on port ${PORT} before this script started its own process. Set PORT to a free port and retry." >&2
  exit 1
fi

node "$API_DIST" > "$LOG_FILE" 2>&1 &
PID=$!

# Bounded to ~10s worst case: 10 attempts * (0.3s sleep + up to 0.7s curl timeout).
for i in $(seq 1 10); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "FAIL: apps/api process exited early -- it crashed on startup instead of serving requests. Captured output:" >&2
    cat "$LOG_FILE" >&2
    exit 1
  fi
  status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 0.7 "http://localhost:${PORT}/health" 2>/dev/null || echo "000")"
  if [ "$status" = "200" ]; then
    echo "PASS: /health returned exactly 200"
    exit 0
  fi
  sleep 0.3
done

echo "FAIL: /health did not return 200 within the polling window (timeout). Captured output:" >&2
cat "$LOG_FILE" >&2
exit 1
```

- [ ] **Step 4: Make it executable**

Run: `chmod +x scripts/smoke-api.sh`

(On Windows, `chmod +x` may not always persist the executable bit through every git configuration
— this is not a blocker for this plan, since every invocation in this plan and in CI calls the
script as `bash scripts/smoke-api.sh` explicitly, which does not require the executable bit.)

- [ ] **Step 5: Build `apps/api` with today's (still-broken) `packages/shared` config, then run the smoke script to confirm it FAILS**

Run — **substitute the `DATABASE_URL`/`SUPABASE_JWKS_URL` values below with the real `API_URL`/
`DB_URL` your own Step 1 `npx supabase status` printed** (the values shown here are this plan
author's actual local values at time of writing, not universal defaults):
```bash
pnpm exec turbo run build --filter=@gurmego/api...
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54422/postgres" \
SUPABASE_JWKS_URL="http://127.0.0.1:54421/auth/v1/.well-known/jwks.json" \
bash scripts/smoke-api.sh
```

Expected: **FAIL** — the script prints `FAIL: apps/api process exited early...` followed by the
captured Node error output. Read that captured output: it should show a module-resolution error
naming `@gurmego/shared` or one of its source files (e.g. `price-range`) — if instead it shows a
database connection error, **stop**: that means Step 1/2's precondition wasn't actually satisfied
(wrong ports substituted, or migrations didn't apply), and this FAIL is not proof of the bug this
plan fixes. Only proceed once the captured error clearly points at `@gurmego/shared`'s module
resolution. Exit code must be `1`.

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke-api.sh
git commit -m "test(api): add real process-boot smoke test (currently failing, proves prod build bug)"
```

---

## Task 2: `packages/shared` build fix (GREEN)

**Files:**
- Modify: `packages/shared/package.json`

**Interfaces:**
- Consumes: `packages/shared/tsconfig.json` (already has `outDir: "dist"`, `rootDir: "src"`,
  inherits `module: "commonjs"` and `declaration: true` from `../../tsconfig.base.json` — no
  changes needed to this file); `scripts/smoke-api.sh` (Task 1).
- Produces: `packages/shared/dist/index.js` + `packages/shared/dist/index.d.ts` (and per-module
  `.js`/`.d.ts` files) — `apps/api` resolves `@gurmego/shared` to this compiled output via the
  `main`/`types` fields below, both when built through Turbo and when installed directly (via the
  `prepare` script). This task verifies `apps/api`'s runtime resolution and `apps/api`/`shared`'s
  own test suites; it does **not** runtime-boot `apps/web`/`apps/admin` (out of scope — Step 5
  only confirms they still *typecheck* against the new `dist`-based exports, which is what their
  build-time consumption actually depends on).

- [ ] **Step 1: Edit `packages/shared/package.json`** — change `main`/`types`, add `build` and
      `prepare` scripts

Replace the file's contents with:

```json
{
  "name": "@gurmego/shared",
  "version": "0.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "prepare": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^1.6.0",
    "typescript": "^5.4.0"
  }
}
```

*Why both `build` and `prepare` run the same command:* `build` is what Turbo's `dependsOn:
["^build"]` graph calls (Task 0's `turbo.json`, unchanged) when a consumer is built via `turbo
run`. `prepare` is what `pnpm install` runs automatically for this workspace package regardless of
Turbo — this is what guarantees `dist/` exists after a fresh `pnpm install`, before any `turbo run`
command has ever executed (idea-red-team round 4 finding: without this, `main`/`types` pointing at
`dist/` breaks any command that bypasses Turbo, e.g. `cd apps/api && pnpm run start:dev`). Known,
accepted caveat (plan-red-team finding, not fixed here): if a developer's global pnpm config sets
`ignore-scripts: true`, `prepare` will not fire and they must run `pnpm --filter @gurmego/shared
run build` manually once — this is a pnpm-wide opt-out no plan can silently override, and nothing
in this repo currently sets it.

- [ ] **Step 2: Build `packages/shared` directly and inspect the output**

Run: `pnpm --filter @gurmego/shared run build`
Expected: no errors; `packages/shared/dist/index.js` and `packages/shared/dist/index.d.ts` now
exist (along with per-file output for `enums/price-range.js`, `schemas/*.js`, etc.)

- [ ] **Step 3: Rebuild `apps/api` (now depending on the fixed `packages/shared`) and re-run the smoke test — confirm it now PASSES**

Run (same local Postgres precondition as Task 1 Steps 1-2 applies — confirm it's still up; use
your own `npx supabase status` values, not the example ports below):
```bash
pnpm exec turbo run build --filter=@gurmego/api...
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54422/postgres" \
SUPABASE_JWKS_URL="http://127.0.0.1:54421/auth/v1/.well-known/jwks.json" \
bash scripts/smoke-api.sh
```
Expected: **PASS** — `PASS: /health returned exactly 200`, exit code `0`. If this still fails,
read the captured output the script prints and fix accordingly before moving on — do not skip
ahead assuming a later step will paper over it.

- [ ] **Step 4: Verify the `prepare` script actually fires on a real `pnpm install` (idea-red-team round 4's specific concern) — without touching `node_modules`**

Run:
```bash
rm -rf packages/shared/dist
pnpm install
test -f packages/shared/dist/index.js && grep -q "PRICE_RANGE_VALUES" packages/shared/dist/index.js && echo "PREPARE_OK" || echo "PREPARE_MISSING"
```
Expected: `PREPARE_OK` — this proves `pnpm install` alone (not a `turbo run` command) regenerates
a real, non-empty `dist/index.js` (the `grep` checks for a known real export, not just file
existence). If `PREPARE_MISSING` is printed instead, stop and report this as a blocker — it means
the round-4 fix doesn't actually hold in this environment (see Global Constraints' note on
`ignore-scripts` as the one known cause).

- [ ] **Step 5: Confirm nothing downstream broke — existing test suites plus web/admin typecheck**

Run: `pnpm exec turbo run test typecheck --filter=@gurmego/api... --filter=@gurmego/shared --filter=@gurmego/web --filter=@gurmego/admin`
Expected: all existing `apps/api`/`packages/shared` tests pass, and `tsc --noEmit` is clean across
all four packages — `apps/web`/`apps/admin` resolving `@gurmego/shared`'s types from the new
`dist/index.d.ts` without error is exactly the "consumers still resolve" proof for those two apps
(this task does not runtime-boot them, per this task's Interfaces note above).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/package.json
git commit -m "fix(shared): compile to dist/ via tsc, add prepare script for install-time build

Fixes apps/api crashing under plain 'node dist/main.js' (production mode) --
@gurmego/shared's main field pointed at uncompiled src/index.ts, which Node's
native TS type-stripping cannot resolve for extensionless re-exports. Verified
with a real process-boot smoke test (scripts/smoke-api.sh) against a real local
Postgres, not just tsc --noEmit, which is what let this bug survive Plans 1-3
undetected."
```

---

## Task 3: Wire the smoke test into CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `scripts/smoke-api.sh` (Task 1), the fixed `packages/shared` (Task 2), the existing
  `quality` job's PostGIS service container and `prisma migrate deploy` step (Plan 1 Task 23,
  unchanged).
- Produces: a CI gate that fails the build if the production-boot bug ever regresses. **This repo
  has no `origin` remote**, so this task's acceptance test is running the same commands the CI
  step will run, locally, in the same order CI runs them — not observing an actual GitHub Actions
  run (see Global Constraints).

- [ ] **Step 1: Read the current `.github/workflows/ci.yml`** to confirm the exact step order
      before editing (lint → typecheck → test, in the `quality` job, after the `prisma migrate
      deploy` step against the PostGIS service).

- [ ] **Step 2: Add a build-and-smoke step at the end of the `quality` job**, after the existing
      `pnpm run test` step, reusing the same job's Postgres service and env vars:

```yaml
      - run: pnpm exec turbo run build --filter=@gurmego/api...
      - run: bash scripts/smoke-api.sh
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
          SUPABASE_JWKS_URL: http://localhost:54321/auth/v1/.well-known/jwks.json
```

(Same `DATABASE_URL`/`SUPABASE_JWKS_URL` values already used by the existing `pnpm run test` step
in this file — reuse them verbatim, do not invent new ones. This job's Postgres service listens on
`localhost:5432`, a fresh ephemeral CI-only database — a different port than the local dev stack's
real ports used in Task 1/2. This is expected and already how the existing `pnpm run test` step in
this same job is wired; `SUPABASE_JWKS_URL`'s value never needs to be reachable for `/health` to
work, since `/health` has no auth guard and the JWKS client is only lazily fetched on an actual
token verification — it only needs to be a syntactically valid URL.)

- [ ] **Step 3: Sanity-check the edit landed correctly**

Run: `grep -c "smoke-api.sh" .github/workflows/ci.yml`
Expected: `1` (the new `run: bash scripts/smoke-api.sh` line is the only reference to the
filename). If `0`, the edit didn't land — re-check Step 2.

- [ ] **Step 4: Reproduce the CI job's full command sequence locally, in order, as this task's real acceptance test**

Since this repo has no remote to push to and no way to observe an actual GitHub Actions run, run
the `quality` job's commands yourself, in the same order as the YAML, against your local Postgres
(use your own `npx supabase status` values from Task 1 Step 1, not the example ports below — and
note, unlike the CI job's ephemeral database, your local one needs Step 1's real
`SUPABASE_JWKS_URL` too, since local dev's `.env` may be read by some of these commands):

```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54422/postgres" \
pnpm --filter @gurmego/api exec prisma migrate deploy
pnpm run lint
pnpm run typecheck
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54422/postgres" \
SUPABASE_JWKS_URL="http://127.0.0.1:54421/auth/v1/.well-known/jwks.json" \
pnpm run test
pnpm exec turbo run build --filter=@gurmego/api...
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54422/postgres" \
SUPABASE_JWKS_URL="http://127.0.0.1:54421/auth/v1/.well-known/jwks.json" \
bash scripts/smoke-api.sh
```
Expected: every command exits `0`, and the final line is `PASS: /health returned exactly 200`.
This is the plan's real acceptance proof for the CI wiring — a genuine GitHub Actions run remains
untested until this repo has a remote and a PR is opened (out of scope, tracked in
`docs/STATE.md` alongside the rest of the deferred infra/provisioning work).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add real process-boot smoke test after build, guards against prod-crash regressions"
```

---

## Self-Review Notes (completed during plan authoring)

- **Spec coverage:** design doc's Bölüm 2 (build fix) → Task 2; Bölüm 2's smoke-test contract
  (PID capture, readiness polling, early-exit detection, guaranteed cleanup, exact-200, bounded
  timeout) → Task 1's script; Bölüm 3's test/doğrulama checklist (pre-fix red, post-fix green,
  prepare-script proof) → Task 1 Step 4, Task 2 Steps 3-4. All design-doc checklist items have a
  corresponding task step.
- **Placeholder scan:** no TBD/TODO; every step has real, complete code or an exact command with
  expected output.
- **Type consistency:** `scripts/smoke-api.sh` is created once (Task 1) and reused verbatim in
  Task 2 Step 3 and Task 3 Step 4 — no divergent copies.
- **Not in scope (per design doc, correctly excluded):** Railway/Vercel provisioning, Sentry/pino,
  CORS runbook entries, Supabase Auth↔User sync fix — all tracked separately in `docs/STATE.md`.

## Red-team bulguları (Codex, plan-red-team, 2026-07-26)

**Verdikt: DÜZELTİLEBİLİR** — task bölünmesi sağlam (dosya sahipliği çakışmıyor, sıralama mantıklı,
paralel çalıştırılmıyor zaten), ama smoke test'in tanımı birkaç yerde sözleşmesini tam karşılamıyordu.

**Kabul edilenler (plana işlendi):**
- Task 1'in "Consumes: nothing" iddiası yanlıştı — script gerçekte çalışan/migrate edilmiş bir
  Postgres'e, env değişkenlerine ve birkaç CLI aracına bağımlı. Interfaces bölümü düzeltildi, Task
  1'e açık bir Postgres-önkoşul kontrolü (Step 1) eklendi.
- `curl -sf`'de `--max-time` yoktu, "10 saniye sınırı" iddiası doğru değildi (TCP bağlanıp yanıt
  gelmezse süresiz asılı kalabilirdi) — her curl çağrısına `--max-time 0.7` eklendi, döngü
  10 iterasyon × (0.3s sleep + 0.7s curl) ≈ 10s'ye sıkılaştırıldı.
- `curl -sf` yalnızca HTTP hatalarını (≥400) reddediyordu, "exact 200" değil — `-w '%{http_code}'`
  ile gerçek durum kodu okunup `"200"`e birebir karşılaştırılacak şekilde değiştirildi.
- Varsayılan `PORT=3000`'de başka bir servis zaten dinliyorsa yanlış-pozitif riski vardı — script
  başlamadan önce portu bir kez prob edip doluysa net bir hatayla durma eklendi.
- "PASS within Xms" mesajı gerçek bir ölçüm değildi (döngü sayacından hesaplanan sahte bir
  süreydi) — kaldırıldı, yerine düz "PASS: /health returned exactly 200" kondu.
- RED sonucunun nedensel kanıt olmadığı (DB hatası da aynı exit code'u üretir) — script artık
  node'un stderr/stdout'unu bir log dosyasına yakalayıp hata durumunda basıyor; Task 1 Step 4'e
  "captured output'u oku, gerçekten @gurmego/shared hatası mı DB hatası mı ayırt et" talimatı
  eklendi.
- Task 2 Step 5'in "her tüketici resolve ediyor" iddiası yalnızca api/shared'ı test ediyordu,
  web/admin'e dokunmuyordu — web/admin artık aynı komuta typecheck olarak eklendi (runtime boot
  değil, ama bu görevin gerçek amacı zaten derleme-zamanı resolution).
- Task 3 Step 5'in "push et, GitHub Actions'ı izle" adımı bu repoda **hiç remote olmadığı** için
  hiç çalışamazdı (doğrulandı: `git remote -v` boş) — Global Constraints'e bu kısıt eklendi, Task
  3'ün kabul kriteri CI job'unun komutlarını yerel olarak sırayla çalıştırmaya çevrildi.
- Task 2 Step 4'ün "dosya var mı" kontrolü zayıftı — dosyanın gerçek, boş olmayan bir export
  içerdiğini doğrulayan bir `grep` eklendi.

**Reddedilenler:** Yok — tüm bulgular kabul edildi.

**Şüpheli mutabakat kontrolü atlandı (round 1):** Verdikt DÜZELTİLEBİLİR idi (HAZIR değil), skill
kuralı gereği bu durumda ikinci (karşıt pozisyon zorlayan) çağrı atlanır.

### Round 2 (yine DÜZELTİLEBİLİR)

**Kabul edilenler (plana işlendi):**
- Script'te `mktemp` çağrısı `trap cleanup EXIT` kurulmadan önceydi — dist eksikliği veya port
  doluluğu gibi erken çıkış yollarında geçici log dosyası hiç silinmiyordu. `trap` artık `mktemp`'ten
  hemen sonra, ilk `exit` yolundan önce kuruluyor (`PID` boşken `kill`/`wait` no-op olacak şekilde
  korumalı).
- **Gerçek port uyuşmazlığı bulundu ve doğrulandı:** Plan ve `apps/api/.env.example`'daki varsayılan
  portlar (`54321`/`54322`) bu worktree'nin GERÇEK çalışan Supabase stack'iyle (`54421`/`54422`,
  `npx supabase status` ile bizzat bu oturumda doğrulandı) uyuşmuyordu — `.env.example` bu proje
  için bayat. Plandaki tüm yerel-Postgres komutları gerçek portlara güncellendi, ayrıca "kendi
  `supabase status` çıktını kullan, örnek değerleri kopyalama" uyarısı eklendi.
- "Already-migrated" önkoşulu test edilmiyordu, yalnızca varsayılıyordu — Task 1'e açık bir
  `prisma migrate deploy` adımı (yeni Step 2) eklendi.
- Task 3 Step 4'ün yerel CI tekrarında `prisma migrate deploy` çağrısına `DATABASE_URL` açıkça
  verilmiyordu, geliştiricinin `.env` dosyasına örtük bağımlıydı — artık açıkça veriliyor.

**Reddedilenler (gerekçesiyle):**
- **Bulgu:** "`cd apps/api && npx supabase status` yanlış çalışma dizininde çalışıyor, Supabase
  config'i depo kökünde." **Ret gerekçesi:** Bu oturumda bizzat test edildi — hem repo kökünden hem
  `apps/api` içinden `npx supabase status` çalıştırıldı, ikisi de aynı doğru sonucu (`API_URL:
  127.0.0.1:54421`) verdi. Supabase CLI, git gibi üst dizinlere doğru `supabase/config.toml`'u arayıp
  buluyor. **Bu yanlışsa ne olur:** Gelecekte farklı bir Supabase CLI sürümünde bu davranış
  değişirse, Task 1 Step 1 gerçek dizinden bağımsız çalışmaz hale gelir — düşük olasılık, kolayca
  fark edilir (komut hiç "running" demez), bu yüzden ayrıca bir savunma eklenmedi. Yine de plan artık
  komutu repo kökünden çalıştıracak şekilde yazıldı (Step 1), bu belirsizliği pratikte sıfırlıyor.

**Şüpheli mutabakat kontrolü atlandı (round 2):** Verdikt yine DÜZELTİLEBİLİR, ikinci çağrı gerekmedi.

### Round 3 (DÜZELTİLEBİLİR, tek satırlık düzeltme)

**Kabul edildi:** Task 1 Step 2'nin `prisma migrate deploy` çağrısına `DATABASE_URL` açıkça
verilmiyordu — `apps/api/.env`'in bayat/farklı bir değeri varsa migration'lar Step 1'de doğrulanan
gerçek DB'ye değil, o bayat hedefe uygulanabilirdi, RED/GREEN kanıtını geçersiz kılabilirdi.
Düzeltildi: `DATABASE_URL` artık açıkça geçiliyor. Codex'in kendi ifadesiyle: "bu düzeltmeden sonra
HAZIR."

**Şüpheli mutabakat kontrolü atlandı (round 3):** Tek satırlık, mekanik bir düzeltmeydi; kabul
edilen bulgu HAZIR'ı doğrudan tetikleyen türden, ikinci bir tur gerekmedi.
