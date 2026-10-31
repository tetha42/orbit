# Changelog

All notable changes to **Orbit Community OS** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-10-31

### Added
- **100% Mutation Audit Coverage:** Implemented `withAudit` higher-order route wrapper (`src/lib/audit/withAudit.ts`) and direct global pool writer `writeAuditLog` (`src/db/audit.ts`). All 116 mutation handlers across 85 API route files now log actor ID, actor name, client IP, action, target, and sanitized payload diffs.
- **Audit Coverage CI Gate:** Created `scripts/check-audit-coverage.mjs` wired into `pnpm check` and `pnpm verify`. Any new unaudited mutation route fails CI automatically.
- **Contract Test Suite:** Created `tests/contract/` using Node.js native test runner (`node:test` / `node:assert`):
  - `health.test.mjs`: Database connectivity and health probe contract (`/api/healthz`).
  - `unauthenticated.test.mjs`: Ensures every protected route returns 401 or 403 (never 500) when called unauthenticated.
  - `auth-flow.test.mjs`: End-to-end authentication cycle verification.
  - `db-studio.test.mjs`: Enforces transaction read-only guards and break-glass mutation blocks.
  - `rate-limit.test.mjs`: Verifies 31st request triggers HTTP 429 Too Many Requests with `Retry-After`.
- **Fresh-DB CI Workflow:** Added `fresh-db` pipeline job in `.github/workflows/ci-cd.yml` that boots an empty PostgreSQL 16 container, applies schema migrations from scratch, and verifies contract tests and E2E simulation.
- **Automated Secret Scanning:** Added Gitleaks GitHub Action (`gitleaks/gitleaks-action@v2`) to CI pipeline to detect accidental secret commits.
- **Root Docker Compose:** Added root `docker-compose.yml` including `infra/docker/docker-compose.yml` and comprehensive `.env.example`.

### Changed
- **Next.js 16 Upgrade:** Upgraded Next.js to 16.4.3 with native Turbopack and replaced deprecated root middleware with modern edge proxy (`src/proxy.ts`).
- **Database Architecture & Legacy View Elimination:** Completely eliminated dependencies on legacy `kullanicilar` view across all 20 domain repositories (budget, certificates, chat, decisions, events, inventory, kanban, news, notifications, projects, teams, soar, posta). Added idempotent migration `2026_27_drop_legacy_kullanicilar_view` to drop the view.
- **Zero Hardcoded Credentials:** Removed all default passwords (`orbit_secret_2026`, `kulup_secret_2026`, `postgres:postgres`) from 15 files across Docker compose, scripts, documentation, and tests.
- **Setup Wizard Dynamic Passwords:** `FirstRunSetupWizard.tsx` generates cryptographically random passwords client-side for Docker quickstart commands.
- **DB Studio Guardrails:**
  - Query execution strictly enforced within `BEGIN TRANSACTION READ ONLY` with statement timeouts.
  - Mutate and Import endpoints strictly require break-glass environment variable `ORBIT_DB_STUDIO_WRITE=1` plus 2FA challenge token (`x-db-token`).
  - Sensitive columns (`password_hash`, `totp_secret`, tokens) automatically redacted from data results.
- **Dependency Upgrades:** Updated `next`, `nodemailer`, and pinned transitive dependencies (`dompurify`, `source-map-js`) through `pnpm.overrides`, reaching **0 known vulnerabilities** on `pnpm audit --prod`.
- **Documentation Parity:** Updated documentation across `README.md`, `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, and `docs/README.md` to reference canonical `/api/healthz` and exact 16 workspace application count.

### Removed
- Removed deprecated `src/middleware.ts` and `src/middleware/authRateLimiter.ts`.
- Removed database auto-discovery candidate credential guessing in `src/db/index.ts`.
- Removed invalid npm package badge from `README.md` (private project).

---

## [1.0.0] - 2026-10-15

### Added
- Initial release of **Orbit Community OS**:
  - Hardware-accelerated 60/120fps Web-Desktop shell with 16 modular workspace applications and internal media preview.
  - Triple-stream real-time Server-Sent Events (SSE) bus (`orbit_events`, `chat_events`, `soc_stream`).
  - Autonomous Security Operations Center (**SoC Pro Studio**) with DEFCON 1–5 posture controls, Canary honeypots, and SOAR playbooks.
  - Built-in RFC 6749 OAuth 2.0 / OIDC Identity Provider with PKCE.
  - Zero Config Files runtime setup wizard (`/setup`).
  - Dual design system (Adaptive glass/studio desktop + High-contrast monochrome flat utilities).
