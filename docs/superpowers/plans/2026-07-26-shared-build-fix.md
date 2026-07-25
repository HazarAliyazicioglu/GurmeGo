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

- [ ] **Step 1: Confirm the local Postgres precondition — this task assumes it, does not create it**

Run:
```bash
cd apps/api && npx supabase status
cd -
```
Expected: output shows the local stack is running, including a `DB_URL` /
`postgresql://postgres:postgres@127.0.0.1:<port>` line. If the command reports the stack is
stopped, run `cd apps/api && npx supabase start && cd -` first (this can take a minute on first
run) — do not proceed to Step 4 until `supabase status` shows the stack up. This plan does not
provision Postgres; it only proves `apps/api` can boot against one that already exists, matching
how every prior plan's tests in this repo already assume a running local stack (see
`apps/api/.env.example`'s `DATABASE_URL` default port).

- [ ] **Step 2: Create `scripts/smoke-api.sh`**

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
LOG_FILE="$(mktemp)"

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

cleanup() {
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

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

- [ ] **Step 3: Make it executable**

Run: `chmod +x scripts/smoke-api.sh`

(On Windows, `chmod +x` may not always persist the executable bit through every git configuration
— this is not a blocker for this plan, since every invocation in this plan and in CI calls the
script as `bash scripts/smoke-api.sh` explicitly, which does not require the executable bit.)

- [ ] **Step 4: Build `apps/api` with today's (still-broken) `packages/shared` config, then run the smoke script to confirm it FAILS**

Run:
```bash
pnpm exec turbo run build --filter=@gurmego/api...
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
SUPABASE_JWKS_URL="http://localhost:54321/auth/v1/.well-known/jwks.json" \
bash scripts/smoke-api.sh
```
(Adjust the `DATABASE_URL` port to match whatever `npx supabase status` printed in Step 1 if it
differs from `54322`.)

Expected: **FAIL** — the script prints `FAIL: apps/api process exited early...` followed by the
captured Node error output. Read that captured output: it should show a module-resolution error
naming `@gurmego/shared` or one of its source files (e.g. `price-range`) — if instead it shows a
database connection error, **stop**: that means Step 1's precondition wasn't actually satisfied,
and this FAIL is not proof of the bug this plan fixes. Only proceed once the captured error clearly
points at `@gurmego/shared`'s module resolution. Exit code must be `1`.

- [ ] **Step 5: Commit**

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

Run (same local Postgres precondition as Task 1 Step 1 applies — confirm it's still up):
```bash
pnpm exec turbo run build --filter=@gurmego/api...
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
SUPABASE_JWKS_URL="http://localhost:54321/auth/v1/.well-known/jwks.json" \
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
in this file — reuse them verbatim, do not invent new ones. Note this job's Postgres service
listens on `localhost:5432`, a different port than the local dev stack's `54322` used in Task 1/2
— this is expected and already how the existing `pnpm run test` step in this same job is wired.)

- [ ] **Step 3: Sanity-check the edit landed correctly**

Run: `grep -c "smoke-api.sh" .github/workflows/ci.yml`
Expected: `1` (the new `run: bash scripts/smoke-api.sh` line is the only reference to the
filename). If `0`, the edit didn't land — re-check Step 2.

- [ ] **Step 4: Reproduce the CI job's full command sequence locally, in order, as this task's real acceptance test**

Since this repo has no remote to push to and no way to observe an actual GitHub Actions run, run
the `quality` job's commands yourself, in the same order as the YAML, against your local Postgres
(the same one from Task 1 Step 1 — adjust the `DATABASE_URL` port to match your local stack, e.g.
`54322`, not the CI-only `5432` hardcoded in the YAML for the ephemeral service container):

```bash
pnpm --filter @gurmego/api exec prisma migrate deploy
pnpm run lint
pnpm run typecheck
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
SUPABASE_JWKS_URL="http://localhost:54321/auth/v1/.well-known/jwks.json" \
pnpm run test
pnpm exec turbo run build --filter=@gurmego/api...
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
SUPABASE_JWKS_URL="http://localhost:54321/auth/v1/.well-known/jwks.json" \
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

**Şüpheli mutabakat kontrolü atlandı:** Verdikt DÜZELTİLEBİLİR idi (HAZIR değil), skill kuralı
gereği bu durumda ikinci (karşıt pozisyon zorlayan) çağrı atlanır — zaten karşı çıkmış bir
verdikte tekrar karşı çıktırmak token israfı olurdu.
