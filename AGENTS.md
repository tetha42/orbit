<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Orbit Community OS — AI Architecture & Verification Guide

### 1. Start Here Before Editing Code (AI-Driven v3.1 Workflow)
- Read [AI_INDEX.json](./AI_INDEX.json) (`v3.1.0`, strictly `<= 4 KB`) first for the compact map of all **18** module IDs (`m`), **24** domain shards (`s`), **42** SQL tables grouped by schema file (`t`), and **153** API route subpaths grouped by domain (`r`).
- Read `.ai/shards/<domain>.json` (or run `./bin/orbit ai map [<domain>]`) for a domain's full file list, API routes (`dbCalls`, `tablesTouched`), SQL table columns/indexes, mapped contract tests (`tests`), AST `exports`, `limits`, and `errorCodes`.
- Use `./bin/orbit ai deps <file>` to inspect forward/reverse imports and `./bin/orbit ai impact <file1,file2>` to compute affected domains, tests, and recommended checks.
- Read the auto-generated references under `docs/generated/` (`SCHEMA.md`, `API.md`, `SURFACES.md`) and [docs/OPS_AND_SECURITY.md](./docs/OPS_AND_SECURITY.md) rather than guessing schema columns, route handlers, or runtime security setup.
- Use `pnpm` (`packageManager: pnpm@10.12.3`) and Node.js `>=22`. Never run `npm install`.

### 2. Directory & Module Architecture
- **Mini-Apps (`src/apps/<id>/`):** Self-contained apps with pure `manifest.ts`, `<id>.contract.json`, hooks, and views. Code under `src/apps/**` must use `@/core/*` hooks (`useSession`, `useI18n`, `useSound`, `useWindowActions`, `useShell`), never `@/state/workspaceStore`, and must never cross-import `@/apps/<other>`.
- **Feature Domains (`src/domains/<domain>/`):** Cross-cutting vertical domains (`chatSearch`, `devices`, `drive`, `webrtc`) indexed directly into their owning `.ai/shards/<domain>.json`.
- **i18n Auto-Discovery (`src/lib/i18n/domains/*.ts`):** Domain translation bundles placed under `src/lib/i18n/domains/*.ts` are auto-discovered and compiled into `src/lib/i18n/domains.gen.ts` by `scripts/gen-apps.mjs`.

### 3. Hard Repository Invariants
- **File size & line width:** Every file in `src/**/*.{ts,tsx,js,mjs}` must stay `<= 250` lines and `<= 180` characters per line; every `src/**/*.css` file must stay `<= 180` characters per line (`scripts/file-length-ceilings.json` must remain `{}`). `scripts/**/*.mjs` and `services/security-guard/*.go` must stay `<= 400` lines (`scripts/non-src-length-ceilings.json` must remain `{}`).
- **English identifiers everywhere:** Variable, property, type, CSS class, and internal route/channel names must be pure English (`scripts/verify-ast.mjs` / `scripts/check-identifiers.mjs`).
- **i18n completeness:** Every UI string uses `t('key')` defined for all locales in `src/lib/i18n/` (`scripts/verify-ast.mjs` / `scripts/check-i18n.mjs`), with zero ternary-ceiling entries (`scripts/i18n-ternary-ceilings.json` must remain `{}`).
- **Audit & error hygiene:** All mutating routes (`POST`/`PUT`/`PATCH`/`DELETE`) require `withAudit(...)` and zero empty `catch {}` blocks (`scripts/verify-ast.mjs`; `scripts/empty-catch-ceilings.json` must remain `{}`).
- **Design tokens:** Use semantic CSS custom properties from `src/app/globals.css` (`var(--window-bg)`, `var(--text-primary)`, `var(--accent)`) instead of raw hex or colored `rgb()`/`hsl()` literals (`scripts/check-tokens.mjs`).

### 4. Runtime Safety & Concurrency Rules
- **PostgreSQL `pg` pool (`src/db/core/pool.ts`):** `INT8` (`BIGINT`) parses to JS `number`, and `mapRow()` automatically normalizes `snake_case` columns to `camelCase`. Do not duplicate row-mapping hacks.
- **Advisory locks & init:** Never hold a session advisory lock across `CREATE INDEX CONCURRENTLY` without polling `pg_try_advisory_lock` (`orbit.schema.init` pattern in `src/db/core/init.ts`). Wrap vault/balance/quota mutations in `withTransaction` + `pg_advisory_xact_lock`.
- **Singleflight & multi-instance cache invalidation:** Coalesce concurrent cold reads (`getCached` / `sessionLookupInFlight`) and propagate invalidations via `publishEvent` (`pg_notify`) + local `registerEventHandler` so stale reads never poison `globalThis` caches.
- **Streams & request bounds:** Always acquire/release stream slots via `src/server/sse/streamQuota.ts` (including on pre-aborted `request.signal`) and enforce body-size limits before buffering.

### 5. Verification Commands
- `./bin/orbit verify --files <f1,f2>` or `./bin/orbit verify --staged`: fast scoped length and AST verification for incremental changes.
- `pnpm verify`: runs `tsc --noEmit`, `eslint --cache .`, and `pnpm check` (`./bin/orbit verify --check`, running codegen freshness + length, pure, single-pass AST, token, and language gates).
- `./bin/orbit verify`: runs codegen (`gen-apps`, `gen-ai-index`, `gen-docs`) and static verification gates (use `--check` for read-only verification).
- `pnpm test`: runs the full `tests/contract/*.test.mjs` suite against live route handlers and PostgreSQL.
- `pnpm e2e`: runs Playwright UI E2E suites (`tests/e2e/ui/run.mjs`).
- `pnpm preflight` (`--full` adds `pnpm test`): local mirror of CI (override/dependency conflicts, `--frozen-lockfile` sync, `pnpm verify`). Enforced by `.githooks/pre-push`; enable once with `pnpm hooks:install`.

### 6. Definition of Done (check before saying "done" or committing)
1. Changed `package.json` dependencies or `pnpm.overrides`? Run `pnpm install`, commit `pnpm-lock.yaml` with it, and never set an override to a different range than the dependency.
2. Run `pnpm preflight` and show its output; do not claim a check passed unless it was re-run after the last edit.
3. Touched routes, DB, or shared libs? Also run `pnpm test`; touched UI flows? Run the affected `pnpm e2e <suite>`.
4. New or renamed files: respect the 250-line / 180-char limits and English identifiers; run `./bin/orbit verify --staged`.
5. Never commit build artifacts, `data/`, `.next/`, or `tests/e2e/.tmp`.
6. When a mistake is found, add one line here so it cannot repeat.
