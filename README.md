# Orbit Community OS

**A self-hosted, modular community operating system built with Next.js 16 (App Router), React 19, TypeScript 5.9, and PostgreSQL 16.**

Orbit Community OS delivers a multi-window web desktop workspace (with responsive mobile views) backed by **18** app manifests, **153** REST/SSE API route handlers, and **42** PostgreSQL tables — complete with role-based permissions, device-aware sessions & Passkey MFA, Cloud Drive quotas, real-time Chat search & WebRTC voice calls, an autonomous SOC Defense Studio, a Go `security-guard` sidecar, and a zero-config `/setup` onboarding wizard.

---

## Key Capabilities

- **Modular Web Desktop & Mobile Workspace:** 17 user-facing mini-apps plus the internal `mediaviewer` preview window across Community (`members`, `news`, `chat`, `decisions`, `certificates`), Operations (`events`, `teams`, `projects`, `inventory`, `mail`, `database`, `soc`, `terminal`), Finance (`budget`), and Productivity (`notes`, `drive`, `settings`).
- **Cloud Drive, Notes Media & Streaming:** Chunked resumable uploads, member/role sharing, and global/role/member storage quotas (`storage_quotas`) in **Cloud Drive** (`drive`); embedded image uploads with automatic orphan file & quota cleanup in **Notes** (`notes`); and HTTP Range (`206 Partial Content`) media streaming (`/api/uploads/[name]`).
- **Real-Time Chat Search & WebRTC Audio Calls:** Multi-room chat, polls, quota-tracked file attachments, server-side message history search (`/api/chat/search`), and peer-to-peer WebRTC voice calls (`/api/chat/call*`).
- **Device Sessions, Mobile Approval & Passkeys:** `bcryptjs` passwords, signed `HttpOnly` sessions (`club_session_token`), replay-protected `otplib` TOTP 2FA, and WebAuthn/Hybrid Passkeys (`@simplewebauthn/server`). Enforces single active mobile session + up to **4** concurrent desktop sessions (`MAX_DESKTOP_SESSIONS = 4`) with E-Devlet-style 2-digit number matching, 6-digit code, QR link approval, and optional VAPID Web Push / Service Worker Notification fallback. Verified Passkey sign-ins satisfy MFA directly and auto-unlock **Database Studio** and **Terminal**.
- **RBAC, OAuth 2.0 / OIDC & Audit Hygiene:** Per-app `'none' | 'use' | 'manage'` permissions on `roles`, built-in OAuth 2.0 / OIDC Identity Provider (`/oauth/authorize`), and statically verified `withAudit(...)` coverage on every mutating endpoint.
- **First-Run Setup & Config Provenance:** 5-step web wizard (`/setup`) featuring Docker/local PostgreSQL auto-detection, live connection-pool reconfiguration, boot-time `/setup#token=...` URL fragment announcement, and HMAC-bound `HttpOnly; SameSite=Strict` unlock cookie exchange (`/api/setup/unlock`). Configuration resolves deterministically across `Docker secrets > ENV > .env.local > .env > config.ini > data/runtime-config.json > defaults`.
- **Autonomous SOC & Go Security Guard:** Real-time threat telemetry, File Integrity Monitoring (FIM), and WAF inspection via `services/security-guard` over a `0600` Unix domain socket (with Bearer-authenticated TCP HTTP via `SECURITY_GUARD_TOKEN` and deterministic TypeScript fallbacks).
- **Bilingual UI & Sharded v3.1 AI Index:** AST-enforced English/Turkish (`en` / `tr`) dictionaries (with auto-discovered `src/lib/i18n/domains/*.ts`) alongside compact `AI_INDEX.json` (`v3.1.0`, `<= 4 KB`), **24** domain shards (`.ai/shards/*.json`), and `docs/generated/{SCHEMA,API,SURFACES}.md`.

---

## Quick Start

### Prerequisites

- **Node.js:** `>= 22.0.0`
- **pnpm:** `10.12+` (`packageManager: pnpm@10.12.3` — never use `npm install`)
- **Database:** Docker (recommended for local dev) or PostgreSQL `16+`

### 1. Local Development (Recommended)

```bash
git clone <repository-url> orbit && cd orbit
pnpm install
make db-up          # or: ./bin/orbit db up (starts isolated orbit-db PostgreSQL on 127.0.0.1:5432)
make dev            # or: ./bin/orbit dev (starts Next.js dev server on http://localhost:3000)
```

On first run (while setup is incomplete):
1. Orbit creates `data/orbit.setup.token` (`0600`) and prints a clickable `/setup#token=...` URL at server boot (also retrievable via `make setup-url` or `./bin/orbit setup url`).
2. Opening the URL exchanges the client-side fragment token at `/api/setup/unlock` for the scoped `HttpOnly; SameSite=Strict` `orbit_setup_session` cookie without leaking secrets to server access logs.
3. Complete the 5-step wizard to bind PostgreSQL (including one-click Docker container detection) and create the root administrator account.
4. Run `make doctor` (`./bin/orbit doctor`) at any time to verify Node/pnpm, Docker, PostgreSQL connectivity, setup status, and secret-masked configuration provenance.

> **Optional Local Loopback Convenience:** Setting `ORBIT_DEV_AUTO_UNLOCK=1` enables tokenless `/setup` access strictly when `NODE_ENV=development` and the request originates directly from loopback (`127.0.0.1`/`::1`) with a `localhost` host and no forwarding headers.

### 2. Production Deployment (Docker Compose)

```bash
cp .env.example .env   # set POSTGRES_PASSWORD (required; prod compose has no default)
make up                # or: docker compose -f infra/docker/docker-compose.yml up -d
```

Starts three hardened containers: `db` (`postgres:16-alpine`), `app` (GHCR Next.js server exposing `:3000` for Coolify or an external reverse proxy — no built-in Caddy configuration), and `security-guard` (Go FIM/WAF sidecar on `:8080`). To build and run the full stack from local source instead, run `make local-up`. See [`docs/OPS_AND_SECURITY.md`](docs/OPS_AND_SECURITY.md) for deployment hardening, `TRUSTED_PROXY_MODE`, and `SECURITY_GUARD_TOKEN`.

---

## Architecture Overview

| Layer | Location | Purpose |
| :--- | :--- | :--- |
| **App Router & APIs** | `src/app/` | **153** REST/SSE route handlers (`src/app/api/**/route.ts`) plus `/`, `/setup`, `/verify`, `/checkin`, `/oauth/authorize` |
| **Mini-App Modules** | `src/apps/<id>/` | **18** app manifests (`manifest.ts` + `<id>.contract.json`), hooks, and desktop/mobile views |
| **Feature Domains** | `src/domains/<domain>/` | Modular multi-layer domains (`chatSearch`, `devices`, `drive`, `webrtc`) |
| **Generated Truth** | `src/apps/registry.gen.ts`, `AI_INDEX.json`, `.ai/shards/*.json`, `docs/generated/*` | Auto-generated manifest/i18n loaders, v3.1 `<= 4 KB` semantic index + 24 domain shards, and Markdown inventories |
| **Core & Shell** | `src/core/`, `src/components/` | Workspace window compositor, dock, menu bar, Spotlight search, setup unlock gate, and shared UI |
| **Server Domain** | `src/server/` | Auth/RBAC guards, config provenance, Database Studio access, storage quotas, SoC/WAF/FIM orchestration, OAuth, SMTP, terminal |
| **Database Layer** | `src/db/` | PostgreSQL 16 `pg` pool (`INT8` -> `number`, `snake_case` -> `camelCase`), advisory-locked init, **42** tables |
| **i18n & Locales** | `src/lib/i18n/`, `src/locales/registry.ts` | Bilingual `en` / `tr` dictionaries with auto-discovered `src/lib/i18n/domains/*.ts` |
| **CLI & Gates** | `bin/orbit`, `scripts/`, `Makefile` | Unified 27-command CLI (`./bin/orbit`), thin `Makefile` facade, AI map/deps/impact tools, and static/AST gates |
| **Security Sidecar** | `services/security-guard/` | Go FIM & WAF service over `0600` Unix domain socket with Bearer-authenticated TCP HTTP fallback |

---

## CLI, Make Shortcuts & Verification

`Makefile` provides thin shortcuts over `./bin/orbit` (`scripts/orbit-cli.mjs`) without silently overriding `DATABASE_URL`. Diagnostic and gate commands support `--json` and respect `NO_COLOR=1`.

```bash
# Environment, DB & Onboarding
./bin/orbit doctor                      # or: make doctor (diagnostics, config provenance & DB health)
./bin/orbit db up|down|status|shell|reset|explain   # dev PostgreSQL & query plans (make db-*)
./bin/orbit setup status|url|reset                  # setup lock state & URL (make setup-url)
./bin/orbit dev [--with-db] [--port N]              # dev server + boot setup URL hint (make dev)

# AI Index, Codegen & Static Verification
./bin/orbit ai map [<domain>]           # inspect compact v3.1 summary or single domain shard
./bin/orbit ai deps <file>              # inspect forward/reverse module import graph
./bin/orbit ai impact <file1,file2>     # compute affected domains, contract tests & required checks
./bin/orbit verify [--files ...|--staged] # regenerate registry/AI index/docs + run static/AST gates
pnpm verify                             # tsc --noEmit, eslint --cache ., and pnpm check
./bin/orbit status                      # build status, Security Guard transport & FIM baselines
./bin/orbit quotas                      # SSE stream quotas, HTTP upload/body limits & Guard IPC info

# Test Suites & Production Build
pnpm test                   # run contract test suites (tests/contract/*.test.mjs)
pnpm test:security          # run WAF, honeypot, RBAC & SOC security E2E suite
pnpm e2e                    # run Playwright Chromium UI E2E (<= 1024 MB RSS / <= 180s budget)
pnpm build                  # build production Next.js standalone bundle
```

Run `make help` or `./bin/orbit --help` for the complete list of targets and options. For browser E2E options (`E2E_DATABASE_URL`, `--base`, isolated suites), see [`tests/e2e/ui/README.md`](tests/e2e/ui/README.md).

---

## Documentation Index

- **[`docs/README.md`](docs/README.md)** — Documentation hub and role-based reading paths.
- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — Full-stack topology, pure manifests, PostgreSQL 16 `pg` pool, 42-table domain map, and API guard conventions.
- **[`docs/OPS_AND_SECURITY.md`](docs/OPS_AND_SECURITY.md)** — Docker Compose profiles, config provenance, `#token=` setup unlock, device sessions & Passkeys, Go `security-guard`, CLI workflow, and design tokens.
- **[`src/apps/README.md`](src/apps/README.md)** — Mini-application manifest and `<id>.contract.json` authoring guide.
- **[`tests/e2e/ui/README.md`](tests/e2e/ui/README.md)** — Playwright browser E2E runner and suite authoring guide.
- **[`examples/oauth-client-node/README.md`](examples/oauth-client-node/README.md)** — Zero-dependency OAuth 2.0 + PKCE / OIDC reference client.
- **Governance & Agent Rules:** [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`SECURITY.md`](SECURITY.md) · [`AGENTS.md`](AGENTS.md)
- **Machine-Generated References:** [`AI_INDEX.json`](AI_INDEX.json) (`v3.1.0`, `<= 4 KB`) · [`.ai/shards/`](.ai/shards) · [`docs/generated/SCHEMA.md`](docs/generated/SCHEMA.md) · [`docs/generated/API.md`](docs/generated/API.md) · [`docs/generated/SURFACES.md`](docs/generated/SURFACES.md)

---

## License

Licensed under the [Apache License 2.0](LICENSE).
