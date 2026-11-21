# Operations & Security Runbook

Concise runtime reference for deploying, securing, operating, and verifying **Orbit Community OS**.

---

## 1. Docker Compose Stacks, Proxy Trust & Configuration Provenance

### Production Stack (`infra/docker/docker-compose.yml`)

Included by the root [`docker-compose.yml`](../docker-compose.yml) (use `infra/docker/docker-compose.build.yml` via `make local-up` to build images from local source). There is **no Caddy configuration** in the repository; `app` exposes port `3000` internally (`expose: ['3000']`) for Coolify or an external reverse proxy:

| Service | Image / Build | Role & Hardening |
| :--- | :--- | :--- |
| **`db`** | `postgres:16-alpine` | Primary PostgreSQL 16 store (`orbit-pgdata` volume, `pg_isready` healthcheck, bound to `127.0.0.1:${POSTGRES_PORT:-5432}`). |
| **`app`** | `ghcr.io/tetha42/orbit` | Next.js 16 server (`expose: 3000`, `read_only: true`, `cap_drop: ALL`, `no-new-privileges`, volumes `orbit-data`, `orbit-uploads`, `orbit-custom`, `orbit-tmp`). |
| **`security-guard`** | `services/security-guard/Dockerfile` | Go FIM/WAF sidecar (`expose: 8080`, `read_only: true`, `cap_drop: ALL`, read-only repo mounts + `orbit-guard-state` volume). |

- Copy [`.env.example`](../.env.example) to `.env` (gitignored).
- `POSTGRES_PASSWORD` has **no default** in `infra/docker/docker-compose.yml` (`${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}`) and must be supplied explicitly.
- Optional overrides: `DATABASE_URL`, `AUTH_SECRET`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_RP_ID`, `PUBLIC_BASE_URL`, `PUBLIC_API_ALLOWED_ORIGINS`, `TRUSTED_PROXY_MODE`, `SECURITY_GUARD_TOKEN`, `BOOTSTRAP_ADMIN_*`, VAPID keys for Web Push.

### Trusted Proxy Resolution (`TRUSTED_PROXY_MODE` in `src/lib/http.ts`)

`clientAddress(request)` only honors forwarding headers (`cf-connecting-ip`, `true-client-ip`, `x-real-ip`, `x-forwarded-for`) when the immediate connecting peer is a trusted proxy:
- `TRUSTED_PROXY_MODE=none`: ignore all proxy headers and return the socket remote IP.
- `TRUSTED_PROXY_MODE=cloudflare`: prioritize Cloudflare headers (`cf-connecting-ip`, `true-client-ip`) before walking `x-forwarded-for` right-to-left.
- Unset / default: inspect `cf-connecting-ip`, `true-client-ip`, `x-real-ip`, and right-to-left untrusted hops in `x-forwarded-for` only if the connecting socket is a verified trusted proxy.

### Isolated Local Dev Database (`infra/docker/docker-compose.dev.yml`)

- Standalone local development profile (`name: orbit-dev`, container `orbit-db` on `127.0.0.1:${POSTGRES_PORT:-5432}`, volume `orbit-dev-pgdata`, local-dev-only fallback `orbit_dev_2026`).
- Manage via `./bin/orbit db up|down|status|shell|reset` (or `make db-up|db-down|db-status|db-shell|db-reset`).

### Configuration Provenance (`src/server/config/provenance.ts`)

Configuration resolves in deterministic precedence order:
`Docker secrets (/run/secrets/*, *_FILE) > process ENV > .env.local / .env > config.ini > data/runtime-config.json > defaults`.
Run `./bin/orbit doctor [--json]` (or `make doctor`) to inspect the active source and secret-masked value for each key.

---

## 2. First-Run Setup Fragment (`#token=`) & Unlock Session

- When setup is incomplete and `BOOTSTRAP_ADMIN_PASSWORD` (12+ chars) is unset, `ensureSetupToken()` (`src/lib/setup.ts`) writes a 32-hex token to `data/orbit.setup.token` (`0600`) and announces a clickable `/setup#token=...` URL at server boot (also available via `./bin/orbit setup url` or `make setup-url`). Using the `#token=` URL fragment keeps the secret out of HTTP request lines, `Referer` headers, and reverse-proxy access logs.
- `/api/setup/unlock` (`src/app/api/setup/unlock/route.ts`, `withAudit` on `POST`) verifies the submitted token with `crypto.timingSafeEqual` and sets an HMAC-bound `HttpOnly; SameSite=Strict` cookie (`orbit_setup_session`, 1-hour TTL, automatically invalidated if `data/orbit.setup.token` rotates or is deleted).
- **Explicit Local-Dev Opt-In:** Setting `ORBIT_DEV_AUTO_UNLOCK=1` enables tokenless `/setup` access **only** when `NODE_ENV=development`, the socket IP is direct loopback (`127.0.0.1` / `::1`), the `Host` header targets localhost/loopback, and zero forwarding headers (`x-forwarded-for`, `cf-connecting-ip`, `true-client-ip`, `x-real-ip`, `x-forwarded-host`) are present (`src/lib/setupSession.ts`).
- Completing setup runs `markSetupLocked()`, writing `data/setup.lock` (`0600`) and deleting `data/orbit.setup.token`.

---

## 3. Authentication, Device Sessions, Passkeys, Critical Apps & Audit

- **Password & Session Cookie:** Passwords use `bcryptjs`; login issues a random 256-bit token stored hashed in `users.session_token` / `user_sessions.token_hash` and delivered via the `HttpOnly`, `SameSite=Lax` cookie `club_session_token` (`secure` in production).
- **Device Session Limits & Mobile Approval (`src/domains/devices/`, `/api/auth/devices/*`):**
  - Enforces a single active `mobile` session (signing in on a new mobile device evicts the prior mobile session) and up to **4** concurrent `desktop` sessions (`MAX_DESKTOP_SESSIONS = 4`).
  - Role device policies (`allow_mobile_access`, `allow_desktop_access`, `desktop_auth_policy`: `standard | mobile_preferred | mobile_required`) support E-Devlet-style 2-digit number matching approval, 6-digit verification codes, QR link approval, and Hybrid WebAuthn Passkeys.
  - Optional VAPID Web Push (`push_subscriptions`, `/api/auth/devices/push/subscribe`) notifies the active mobile device of pending desktop approvals, with a Service Worker Notification fallback when Web Push is unconfigured.
- **TOTP 2FA (`otplib`):** TOTP secrets are encrypted at rest via `secretBox.ts`. Accepted 30s time steps are recorded in `users.totp_last_step` to prevent replay, and roles with `roles.require_2fa` enforce second-factor enrollment.
- **WebAuthn Passkeys (`@simplewebauthn/server`):** Passkeys verify origin (`WEBAUTHN_ORIGIN`), RP ID (`WEBAUTHN_RP_ID`), and strictly incrementing signature counters (`webauthn_credentials`). Verified Passkey sign-ins (`/api/auth/passkey/login/verify`) complete authentication directly with `authMethod: 'passkey'` without an extra TOTP prompt and satisfy `roles.require_2fa`.
- **Critical App Access (Database Studio & Terminal):** Passkey-authenticated sessions (`authMethod === 'passkey'`) unlock **Database Studio** (`requireDatabaseAdmin` in `src/server/databaseAccess.ts`) and **Terminal** (`/api/database/auth`, `/api/terminal/*`) while enforcing admin permissions, SoC incident containment (`isUserDatabaseFrozen` / lockdowns), read-only SQL transactions (`BEGIN TRANSACTION READ ONLY`), and break-glass write protection (`ORBIT_DB_STUDIO_WRITE=1`). Password/TOTP sessions require explicit 2FA step-up (`x-db-token` 30-minute HMAC token or password/TOTP prompt).
- **Audit Trails (`withAudit`):** Every mutating API route logs before/after state into `audit_logs` (`src/db/audit/`), enforced statically by `scripts/verify-ast.mjs`.

---

## 4. Go Security Guard Sidecar (`services/security-guard/`)

- **IPC Transport Priority (`src/server/security/securityGuardClient.ts`):**
  1. **Unix Domain Socket (default):** `/tmp/orbit-security-guard.sock` with mode `0600` (override via `ORBIT_GUARD_SOCKET` / `SECURITY_GUARD_SOCKET`; set `none`, `off`, or `SECURITY_GUARD_DISABLE_SOCKET=1` to disable).
  2. **TCP HTTP Fallback:** `SECURITY_GUARD_URL` (`http://127.0.0.1:8080` locally, `http://security-guard:8080` in Docker Compose).
  3. **Local TS Fallback:** Deterministic TypeScript WAF/FIM engines if the sidecar is offline.
- **Bearer Authentication (`SECURITY_GUARD_TOKEN`):** When `SECURITY_GUARD_TOKEN` is set, `services/security-guard/main.go` protects `/api/fim/status`, `/api/fim/scan`, `/api/waf/inspect`, and `/api/telemetry` with constant-time `Authorization: Bearer <token>` validation (`subtle.ConstantTimeCompare`), while leaving `/health` and `/api/health` open for Docker healthchecks. Requests are capped at 1 MiB with max 2 concurrent FIM scans.

---

## 5. Unified CLI (`./bin/orbit`), Developer Workflow & Verification

`Makefile` provides thin shortcuts over `./bin/orbit` (`scripts/orbit-cli.mjs`) with zero silent `DATABASE_URL` overrides (`make help` lists all targets). Most diagnostic and gate subcommands support `--json` and `NO_COLOR=1`:

```bash
./bin/orbit doctor                         # Environment, config provenance & PostgreSQL health
./bin/orbit dev [--with-db] [--port N]     # Start Next.js dev server with boot setup URL hint
./bin/orbit db up|down|status|shell|reset|explain  # Dev DB lifecycle & EXPLAIN diagnostics
./bin/orbit setup status|url|reset         # Inspect setup lock state, fragment URL, or reset dev setup
./bin/orbit status                         # Node/Next build, Security Guard transport, FIM baselines
./bin/orbit ai map [<domain>]              # Compact v3.1 summary or single domain shard details
./bin/orbit ai deps <file>                 # Inspect forward & reverse imports for a file
./bin/orbit ai impact <file1,file2>        # Compute affected domains, tests, and required checks
./bin/orbit verify [--check|--files|--staged]  # Codegen freshness + length, pure, AST, token, language gates
./bin/orbit test [contract|security|e2e|sim]   # Run automated suites
./bin/orbit ipc-ping                       # Probe Go security-guard socket/TCP latency
./bin/orbit fim                            # Run File Integrity Monitoring scan (--target, --save-baseline)
./bin/orbit waf /path                      # Test WAF signatures locally and via security-guard
./bin/orbit quotas                         # Print SSE stream quotas, body limits, and guard transport
```

Additional gate/diagnostic subcommands: `audit`, `tokens`, `i18n`, `empty-catch`, `bench`, `bundle-budget`. Always run `pnpm verify` (`tsc --noEmit`, `eslint --cache .`, and `./bin/orbit verify --check`) before merging.

---

## 6. Design Token & CSS Rules (`scripts/check-tokens.mjs`, `scripts/check-file-lengths.mjs`)

- **CSS Modules (`*.module.css`):** Raw hex colors (`#...`) and non-grayscale `rgb()`/`hsl()` calls are forbidden; use semantic tokens (`var(--window-bg)`, `var(--text-primary)`, `var(--accent)`, `var(--border-subtle)`) from `src/app/globals.css` and `color-mix(in srgb, var(--token) ...)` for tints. Every `src/**/*.css` line must remain `<= 180` characters.
- **UI Components (`*.ts` / `*.tsx`):** Semantic/accent hex literals and colored `rgb()`/`hsl()` functions are rejected outside explicit theme/icon/email exemptions (`scripts/check-tokens.mjs`), and all `src/` files must remain `<= 250` lines and `<= 180` characters per line.
