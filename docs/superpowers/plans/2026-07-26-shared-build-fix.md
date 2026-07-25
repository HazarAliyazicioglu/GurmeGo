# GurmeGo — Plan 4a: `packages/shared` Build Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the production-crashing bug where `apps/api` imports `packages/shared` as
uncompiled TypeScript source, and prove the fix with a real (not mocked) process-boot smoke test
wired into CI — closing the gap that let this bug survive three prior plans undetected.

**Architecture:** `packages/shared` gains a real `tsc` build step (`dist/` output, already
configured via its existing `tsconfig.json`) plus a `prepare` lifecycle script so `dist/` exists
immediately after any `pnpm install`, independent of Turborepo's task graph. A new bash smoke-test
script boots the real compiled `apps/api/dist/main.js` with `node` (no `ts-node`, no Jest) and
polls `/health` with a bounded timeout, proving the fix works outside any TypeScript-aware runtime.

**Tech Stack:** TypeScript (`tsc`, no new bundler), bash, existing Turborepo/pnpm workspace, existing GitHub Actions CI.

## Global Constraints

- Node version used everywhere is `.nvmrc`'s actual content — do not hardcode a version number
  anywhere in code, scripts, or docs written by this plan (read the file at execution time).
- No new runtime dependency for the build step — plain `tsc`, no bundler (`tsup` etc. rejected by
  idea-red-team as unnecessary; the existing inherited `tsconfig.base.json` already produces
  correct CommonJS + declaration output).
- Any command that needs Turbo's local binary must use `pnpm exec turbo ...`, never a bare
  `turbo ...` (bare `turbo` is not guaranteed to be on `PATH` in a clean shell/CI).
- This plan makes no real cloud-account or spend-incurring changes.

---

## Task 1: Smoke-test script proving the bug is real (RED)

**Files:**
- Create: `scripts/smoke-api.sh`

**Interfaces:**
- Consumes: nothing (first task) — expects `apps/api/dist/main.js` to already exist (built via
  `apps/api`'s existing `nest build`) and `DATABASE_URL`/`SUPABASE_JWKS_URL` env vars to be set.
- Produces: `scripts/smoke-api.sh` — a script every later task and CI reuses verbatim; exit code
  0 = API booted and answered `/health` with 200 within 10s, exit code 1 = it did not (crashed,
  timed out, or `apps/api/dist/main.js` is missing).

- [ ] **Step 1: Create `scripts/smoke-api.sh`**

```bash
#!/usr/bin/env bash
# Boots the REAL compiled apps/api/dist/main.js with plain `node` (no ts-node, no Jest) and
# polls /health. This is the only valid proof that packages/shared's build output is actually
# consumable at runtime -- `tsc --noEmit` passing is NOT sufficient (that's exactly how this bug
# survived three prior plans undetected).
set -uo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SUPABASE_JWKS_URL:?SUPABASE_JWKS_URL is required}"

PORT="${PORT:-3000}"
API_DIST="apps/api/dist/main.js"

if [ ! -f "$API_DIST" ]; then
  echo "FAIL: $API_DIST does not exist. Build apps/api first (pnpm exec turbo run build --filter=@gurmego/api...)." >&2
  exit 1
fi

node "$API_DIST" &
PID=$!

cleanup() {
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
}
trap cleanup EXIT

for i in $(seq 1 20); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "FAIL: apps/api process exited early -- it crashed on startup instead of serving requests." >&2
    exit 1
  fi
  if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    echo "PASS: /health responded within $((i * 500))ms"
    exit 0
  fi
  sleep 0.5
done

echo "FAIL: /health did not respond within 10s (timeout)." >&2
exit 1
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/smoke-api.sh`

- [ ] **Step 3: Build `apps/api` with today's (still-broken) `packages/shared` config, then run the smoke script to confirm it FAILS**

Run:
```bash
pnpm exec turbo run build --filter=@gurmego/api...
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres" \
SUPABASE_JWKS_URL="http://localhost:54321/auth/v1/.well-known/jwks.json" \
bash scripts/smoke-api.sh
```
Expected: **FAIL** — the script prints `FAIL: apps/api process exited early...` (the API crashes
on boot because `@gurmego/shared`'s `main` field still points at uncompiled `src/index.ts`, which
`node` cannot `require()` correctly). Exit code must be `1`. This is the proof the bug is real,
not assumed — do not proceed to Task 2 until you've seen this fail with your own eyes.

- [ ] **Step 4: Commit**

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
  changes needed to this file).
- Produces: `packages/shared/dist/index.js` + `packages/shared/dist/index.d.ts` (and per-module
  `.js`/`.d.ts` files) — every consumer (`apps/api`, `apps/web`, `apps/admin`) resolves
  `@gurmego/shared` to this compiled output via the `main`/`types` fields below, both when run
  through Turbo and when run directly (via the `prepare` script).

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
`dist/` breaks any command that bypasses Turbo, e.g. `cd apps/api && pnpm run start:dev`).

- [ ] **Step 2: Build `packages/shared` directly and inspect the output**

Run: `pnpm --filter @gurmego/shared run build`
Expected: no errors; `packages/shared/dist/index.js` and `packages/shared/dist/index.d.ts` now
exist (along with per-file output for `enums/price-range.js`, `schemas/*.js`, etc.)

- [ ] **Step 3: Rebuild `apps/api` (now depending on the fixed `packages/shared`) and re-run the smoke test — confirm it now PASSES**

Run:
```bash
pnpm exec turbo run build --filter=@gurmego/api...
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres" \
SUPABASE_JWKS_URL="http://localhost:54321/auth/v1/.well-known/jwks.json" \
bash scripts/smoke-api.sh
```
Expected: **PASS** — `PASS: /health responded within ...ms`, exit code `0`. If this still fails,
do not proceed — re-check Step 1's `package.json` edit and Step 2's build output before moving on.

- [ ] **Step 4: Verify the `prepare` script actually fires on a real `pnpm install` (idea-red-team round 4's specific concern) — without touching `node_modules`**

Run:
```bash
rm -rf packages/shared/dist
pnpm install
test -f packages/shared/dist/index.js && echo "PREPARE_OK" || echo "PREPARE_MISSING"
```
Expected: `PREPARE_OK` is printed — this proves `pnpm install` alone (not a `turbo run` command)
regenerates `dist/`, which is the entire point of the `prepare` script. If `PREPARE_MISSING` is
printed instead, the `prepare` script did not fire as expected for a workspace package on this
pnpm version — stop and report this as a blocker rather than silently rebuilding manually and
moving on, since it means the round-4 fix doesn't actually hold.

- [ ] **Step 5: Confirm nothing downstream broke — full existing test suites still pass**

Run: `pnpm exec turbo run test typecheck --filter=@gurmego/api... --filter=@gurmego/shared`
Expected: all existing tests pass, `tsc --noEmit` clean (this is Plan 1/2/3's existing test suite —
this task must not regress it).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/package.json
git commit -m "fix(shared): compile to dist/ via tsc, add prepare script for install-time build

Fixes apps/api crashing under plain 'node dist/main.js' (production mode) --
@gurmego/shared's main field pointed at uncompiled src/index.ts, which Node's
native TS type-stripping cannot resolve for extensionless re-exports. Verified
with a real process-boot smoke test (scripts/smoke-api.sh), not just tsc --noEmit,
which is what let this bug survive Plans 1-3 undetected."
```

---

## Task 3: Wire the smoke test into CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `scripts/smoke-api.sh` (Task 1), the fixed `packages/shared` (Task 2), the existing
  `quality` job's PostGIS service container and `prisma migrate deploy` step (Plan 1 Task 23,
  unchanged).
- Produces: a CI gate that fails the build if the production-boot bug ever regresses — the actual
  motivation for this whole plan.

- [ ] **Step 1: Read the current `.github/workflows/ci.yml`** to confirm the exact step order
      before editing (lint → typecheck → test, in the `quality` job, after the `prisma migrate
      deploy` step against the PostGIS service).

- [ ] **Step 2: Add a `build-and-smoke-test` step at the end of the `quality` job**, after the
      existing `pnpm run test` step, reusing the same job's Postgres service and env vars:

```yaml
      - run: pnpm exec turbo run build --filter=@gurmego/api...
      - run: bash scripts/smoke-api.sh
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
          SUPABASE_JWKS_URL: http://localhost:54321/auth/v1/.well-known/jwks.json
```

(Same `DATABASE_URL`/`SUPABASE_JWKS_URL` values already used by the existing `pnpm run test` step
in this file — reuse them verbatim, do not invent new ones.)

- [ ] **Step 3: Sanity-check the edit landed correctly**

Run: `grep -c "smoke-api.sh" .github/workflows/ci.yml`
Expected: `1` (the new step references the script exactly once). A full YAML-syntax check isn't
worth adding a new dependency for — Step 5's actual GitHub Actions run is the real syntax check;
if the YAML were malformed, that run fails immediately with a parse error.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add real process-boot smoke test after build, guards against prod-crash regressions"
```

- [ ] **Step 5: Push this branch and confirm the CI run's new step actually executes and passes**

Run: `git push origin HEAD` (this worktree's branch, `worktree-mvp-backend-foundation`)
Expected: GitHub Actions "CI" workflow runs; the `quality` job's new smoke-test step shows
`PASS: /health responded within ...ms` in its log output, job succeeds.

---

## Self-Review Notes (completed during plan authoring)

- **Spec coverage:** design doc's Bölüm 2 (build fix) → Task 2; Bölüm 2's smoke-test contract
  (PID capture, readiness polling, early-exit detection, guaranteed cleanup) → Task 1's script;
  Bölüm 3's test/doğrulama checklist (pre-fix red, post-fix green, prepare-script proof) → Task 1
  Step 3, Task 2 Steps 3-4. All three design-doc checklist items have a corresponding task step.
- **Placeholder scan:** no TBD/TODO; every step has real, complete code or an exact command with
  expected output.
- **Type consistency:** `scripts/smoke-api.sh` is created once (Task 1) and reused verbatim in
  Task 2 Step 3 and Task 3 Step 2 — no divergent copies.
- **Not in scope (per design doc, correctly excluded):** Railway/Vercel provisioning, Sentry/pino,
  CORS runbook entries, Supabase Auth↔User sync fix — all tracked separately in `docs/STATE.md`.
