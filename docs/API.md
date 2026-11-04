# Orbit Community OS — REST & SSE API Reference (v3.0)

This document specifies the HTTP REST endpoints, Server-Sent Events (SSE) streams, OAuth 2.0 / OIDC Identity Provider contracts, Zero-Config Setup endpoints, Autonomous SoC & SOAR playbooks, and domain APIs for **Orbit Community OS** by **tetha42**.

---

## Table of Contents

1. [API Design Principles & Standard Response Envelopes](#1-api-design-principles--standard-response-envelopes)
2. [Zero-Config Setup & Onboarding Endpoints (`/api/setup`)](#2-zero-config-setup--onboarding-endpoints-apisetup)
3. [Authentication, 2FA & WebAuthn Passkey Endpoints (`/api/auth/*`)](#3-authentication-2fa--webauthn-passkey-endpoints-apiauth)
4. [OAuth 2.0 & OpenID Connect (OIDC) Identity Provider (`/api/oauth/*`)](#4-oauth-20--openid-connect-oidc-identity-provider-apioauth)
5. [Autonomous SoC Telemetry & SOAR Playbooks (`/api/soc/*`)](#5-autonomous-soc-telemetry--soar-playbooks-apisoc)
6. [Events, QR Attendance & Check-In (`/api/events/*`)](#6-events-qr-attendance--check-in-apievents)
7. [Cryptographic Certificates & Document Verification (`/api/certificates/*`)](#7-cryptographic-certificates--document-verification-apicertificates)
8. [Finance, Treasury & Sub-Ledgers (`/api/budget/*`)](#8-finance-treasury--sub-ledgers-apibudget)
9. [Core Workspace, RBAC, Units, Chat & Zero-Trust DB Studio](#9-core-workspace-rbac-units-chat--zero-trust-db-studio)
10. [Unauthenticated Public Syndication API (`/api/public/v1/*`)](#10-unauthenticated-public-syndication-api-apipublicv1)

---

## 1. API Design Principles & Standard Response Envelopes

### Authentication & Authorization Gate (`requireApp`)

All workspace API endpoints enforce server-side session verification, IP binding (`Pass-the-Cookie` defense), mandatory 2FA checks, and per-app RBAC permissions via `requireApp(request, appId, level)` (`src/lib/auth/access.ts`), where `level` is `'use'` or `'manage'`.

- **Session Cookie:** Authenticated requests carry an `HttpOnly`, `SameSite=Lax` cookie (`orbit_session`). The raw token is hashed with `SHA-256` before comparing against `users.session_token`.
- **Edge WAF & Rate Limiting:** Every mutating request (`POST`, `PUT`, `PATCH`, `DELETE`) passes through `inspectRequestPayload(request)` (`src/lib/waf.ts`) and sliding-window rate limiters (`src/lib/rateLimit.ts`).

### Standard JSON Envelopes

#### Success Envelope
```json
{
  "success": true,
  "data": { ... }
}
```
*(Read endpoints may also return domain arrays or keyed collections directly, e.g. `{ "events": [...] }` or `{ "items": [...], "nextCursor": null }`, consumed by `useJsonResource(url)`).*

#### Error Envelope
```json
{
  "error": "Human-readable explanation of the failure",
  "code": "MACHINE_READABLE_ERROR_CODE"
}
```

| HTTP Status | Error Code / Meaning | Description |
| :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_PAYLOAD` | Missing required fields, schema validation failure, or business rule violation |
| `401 Unauthorized` | `UNAUTHENTICATED` / `SESSION_IP_MISMATCH` | Missing/expired `orbit_session` cookie, or client IP changed mid-session |
| `403 Forbidden` | `2FA_SETUP_REQUIRED` / `INSUFFICIENT_PERMISSION` / `WAF_BLOCKED` | Role lacks required `'use'`/`'manage'` level, mandatory 2FA not yet enrolled, or WAF/IP quarantine active |
| `404 Not Found` | `NOT_FOUND` | Resource does not exist or caller lacks visibility (prevents ID enumeration) |
| `409 Conflict` | `LAST_ADMIN_PROTECTED` / `CAPACITY_FULL` | Attempted to demote the last active `'role_admin'`, or event/unit capacity reached |
| `429 Too Many Requests` | `RATE_LIMITED` | Sliding-window rate limit exceeded (`Retry-After` header included) |

---

## 2. Zero-Config Setup & Onboarding Endpoints (`/api/setup`)

Orbit Community OS requires zero `.env` or `config.ini` files. First-run initialization is handled entirely over HTTP by the **Web UI Setup Wizard (`/setup`)**.

### `GET /api/setup` (Setup Status & Connectivity Probe)
Returns current initialization state without crashing even when PostgreSQL is unconfigured or offline.

**Response (`200 OK`):**
```json
{
  "ready": false,
  "firstRun": true,
  "step": "database",
  "dbStatus": {
    "connected": true,
    "configured": true,
    "databaseName": "orbit"
  },
  "brand": {
    "archetype": "dao_collective",
    "studioName": "tetha42",
    "communityName": "Orbit Community",
    "domain": "orbit.local"
  }
}
```

### `POST /api/setup/test-db` (Live PostgreSQL Connection Test)
Tests a candidate PostgreSQL connection string (`SELECT 1`) before committing it to the runtime pool.

**Request Body:**
```json
{
  "dbUrl": "postgresql://orbit:secret@db:5432/orbit"
}
```

**Response (`200 OK`):**
```json
{
  "ok": true,
  "message": "PostgreSQL connection verified."
}
```

### `POST /api/setup` & `POST /api/setup/complete` (Execute Zero-Config Onboarding)
Atomically reconfigures the runtime PostgreSQL pool (`reconfigurePgPool`), runs idempotent schema initialization (`ensurePostgresInit`), persists the selected Organization Archetype (`'academic_club' | 'dao_collective' | 'research_lab' | 'professional_guild'`) and identity into `organization_settings`, creates the first super-administrator account (`'role_admin'`) under `pg_advisory_xact_lock(hashtext('setup.first_admin'))`, seeds the default community chat channel, and attaches an authenticated `HttpOnly` `orbit_session` cookie.

> **Security Gate:** Once at least one user holds `'role_admin'`, `POST /api/setup` permanently rejects any further admin creation attempts (`400 Bad Request`).

**Request Body:**
```json
{
  "dbUrl": "postgresql://orbit:secret@localhost:5432/orbit",
  "identity": {
    "archetype": "research_lab",
    "parentEntity": "tetha42",
    "name": "Orbit Community",
    "domain": "orbit.local"
  },
  "admin": {
    "firstName": "Ada",
    "lastName": "Lovelace",
    "email": "admin@orbit.local",
    "password": "correct-horse-battery-staple-42"
  },
  "smtp": {
    "host": "smtp.orbit.local",
    "port": 465,
    "user": "noreply@orbit.local",
    "password": "smtp-app-password",
    "from": "Orbit Community <noreply@orbit.local>"
  }
}
```

---

## 3. Authentication, 2FA & WebAuthn Passkey Endpoints (`/api/auth/*`)

| Method & Path | Auth Required | Description |
| :--- | :--- | :--- |
| `POST /api/auth/register` | Public (Rate-limited: 5/min/IP) | Submit a new community membership application (`firstName`, `lastName`, `email`, `handle`, `track`, `cohortLevel`, `password`, `consents`) |
| `POST /api/auth/login` | Public (Rate-limited) | Authenticate with email + password; returns `orbit_session` cookie or `{ requires2FA: true, challengeToken }` |
| `POST /api/auth/logout` | Session | Revoke active `session_token` in PostgreSQL and clear `HttpOnly` cookie |
| `GET /api/auth/me` | Session | Return current user profile, resolved RBAC permission map (`permissions`), and 2FA status |
| `POST /api/auth/verify-password` | Session | Re-verify password to unlock a locked desktop session |
| `POST /api/auth/reset-password` | Public / Token | Request or complete an OTP-verified password reset via `verification_tokens` |
| `GET /api/auth/2fa/status` | Session | Inspect TOTP 2FA enrollment state and remaining recovery codes |
| `POST /api/auth/2fa/setup` | Session | Generate a new Base32 TOTP secret and provisioning QR URI (`otpauth://`) |
| `POST /api/auth/2fa/enable` | Session | Confirm a 6-digit TOTP code (`otplib`), activate 2FA, and issue 8 single-use recovery codes |
| `POST /api/auth/2fa/challenge` | Challenge Token | Complete second-factor login using a 6-digit TOTP code or recovery code (replay-protected via `totp_last_step`) |
| `POST /api/auth/2fa/disable` | Session + Password/2FA | Disable TOTP 2FA (blocked if user's role has `require_2fa = true`) |
| `GET /api/auth/passkey` | Session | List registered FIDO2 / WebAuthn Passkeys (`webauthn_credentials`) |
| `POST /api/auth/passkey/register/options` | Session | Generate WebAuthn attestation challenge (`verification_tokens` with `purpose = 'webauthn_reg'`) |
| `POST /api/auth/passkey/register/verify` | Session | Verify hardware/biometric attestation and store COSE public key + signature counter |
| `POST /api/auth/passkey/login/options` | Public | Generate WebAuthn assertion challenge for passwordless sign-in (`purpose = 'webauthn_auth'`) |
| `POST /api/auth/passkey/login/verify` | Public | Verify cryptographic assertion, validate clone counter, and establish session |

---

## 4. OAuth 2.0 & OpenID Connect (OIDC) Identity Provider (`/api/oauth/*`)

Orbit Community OS includes a standards-compliant **OAuth 2.0 / OIDC Identity Provider** (`src/db/oauth.ts`) supporting RFC 6749 Authorization Code Flow with mandatory PKCE (`S256`).

### Discovery & Cryptography
- **`GET /.well-known/openid-configuration`**: OpenID Connect Discovery metadata document.
- **`GET /api/oauth/jwks`**: Public JSON Web Key Set (`RS256` / `ES256` public keys) for verifying signed `id_token` JWTs.

### Authorization & Token Flow
| Method & Path | Description |
| :--- | :--- |
| `GET /api/oauth/authorize` | Validates `client_id`, `redirect_uri`, `scope`, `state`, and `code_challenge` (`S256`); renders consent screen at `/oauth/authorize` |
| `POST /api/oauth/authorize` | Records user consent (`oauth_consents`) and issues a single-use, 60-second authorization code (`oauth_auth_codes`) |
| `POST /api/oauth/token` | Exchanges `code` + `code_verifier` (PKCE) + client credentials for `access_token` and OIDC `id_token` |
| `GET /api/oauth/userinfo` | Bearer token endpoint returning scoped user claims (`sub`, `name`, `email`, `role`, `handle`, `xp`) |
| `GET / POST / DELETE /api/oauth/clients` | Manage registered OAuth 2.0 client applications (Requires `settings: 'manage'`) |

---

## 5. Autonomous SoC Telemetry & SOAR Playbooks (`/api/soc/*`)

All `/api/soc/*` endpoints require `requireApp(request, 'soc', 'use' | 'manage')`.

### `GET /api/soc` (Live Posture, Radar, SIEM & Incidents)
Returns current DEFCON level (`1`–`5`), active Lockdown status, Threat Radar metrics, 24-hour SIEM log histograms (`system_logs`), active IP bans (`security_blocks`), Canary honeypot hits, and open security incidents (`security_incidents`).

### `GET /api/soc/stream` (Real-Time SoC Telemetry SSE)
Server-Sent Events (`text/event-stream`, `X-Accel-Buffering: no`) pushing real-time WAF blocks, Canary triggers, FIM alerts, and incident updates to `SocContext.tsx`.

### `POST /api/soc/playbooks` (Execute Automated SOAR Response)
Requires `soc: 'manage'`. Executes atomic defensive actions and logs an immutable audit entry in `audit_logs`:

**Supported Playbook Actions:**
- `set_defcon`: Change community security posture (`level: 1..5`) or toggle Emergency Lockdown (`lockdown: true | false`).
- `ban_ip` / `unban_ip`: Quarantine or release an IP address in `security_blocks`.
- `revoke_user_sessions`: Immediately invalidate a user's `session_token` and broadcast `session_revoked` via SSE.
- `kill_terminal_sessions`: Terminate all active Linux PTY shell processes belonging to a user (`closeUserTerminalSessions`).
- `freeze_db_access` / `unfreeze_db_access`: Revoke or restore Zero-Trust DB Studio eligibility (`freezeUserDatabaseAccess`).
- `resolve_incident`: Update status, assignee, or post-mortem notes on a `security_incidents` record.

### Additional SoC Endpoints
- **`GET / POST /api/soc/inspection`**: Trigger Go-powered File Integrity Monitoring (FIM) scans (`tools/bin/fim-scanner`), inspect SHA-256 baseline drift, and view unified file diffs.
- **`POST /api/soc/testbench`**: Run controlled security simulations (WAF signature validation, OAuth PKCE flow verification, rate-limit stress check).
- **`GET /api/soc/export`**: Export forensic incident dossiers and filtered SIEM logs in JSON or CSV format.

---

## 6. Events, QR Attendance & Check-In (`/api/events/*`)

| Method & Path | Permission | Description |
| :--- | :--- | :--- |
| `GET /api/events` | `events: 'use'` | List community events with RSVP counts, capacity status, and caller's registration state (`event_participants`) |
| `POST /api/events` | `events: 'manage'` | Create a new event (`'workshop' \| 'seminar' \| 'hackathon' \| 'meeting' \| 'social' \| 'townhall'`), update status (`'draft' \| 'published' \| 'completed' \| 'cancelled'`), or toggle live check-in |
| `POST /api/events/[id]/rsvp` | `events: 'use'` | RSVP to an event (`SELECT ... FOR UPDATE` capacity lock on `events`) or self-cancel an existing registration in `event_participants` |
| `GET / POST /api/events/[id]/checkin` | `events: 'manage'` / `'use'` | Generate rotating QR check-in tokens & 6-digit short codes (managers) or submit attendance check-in at `/checkin` |

---

## 7. Cryptographic Certificates & Document Verification (`/api/certificates/*`)

| Method & Path | Permission | Description |
| :--- | :--- | :--- |
| `GET /api/certificates` | `certificates: 'use'` | List issued certificates (members see their own; managers see all) |
| `POST /api/certificates` | `certificates: 'manage'` | Issue single or bulk certificates with unique verification codes (e.g., `ORB-2026-X9A-4021`) |
| `GET /api/certificates/[code]` | **Public** (Rate-limited) | Verify a certificate (`verification_code`) or official governance record (`reference_no`) for the standalone `/verify` portal |

---

## 8. Finance, Treasury & Sub-Ledgers (`/api/budget/*`)

All treasury mutations run inside `pg_advisory_xact_lock(hashtext('vault:<unitId|general>'))` transactions on `treasury_entries` to prevent negative balances or race conditions.

| Method & Path | Permission | Description |
| :--- | :--- | :--- |
| `GET /api/budget/vaults` | `budget: 'use'` or Unit Lead | List accessible treasuries (General Community Vault + Unit Sub-Vaults) with live balances in minor units (`amount_minor`) |
| `GET /api/budget` | Vault Read Access | Fetch ledger transactions (`'income' \| 'expense' \| 'transfer'`), inter-vault transfers (`transfer_pair_id`), and receipt attachments (`receipt_url`) |
| `POST /api/budget` | Vault Write Access | Record income/expense entries, execute atomic inter-vault allocations (locks both vaults in deterministic order), or amend descriptions/receipts |

---

## 9. Core Workspace, RBAC, Units, Chat & Zero-Trust DB Studio

### RBAC, Members & Governance
- **`GET / POST / PATCH / DELETE /api/roles`** (`settings: 'manage'`): Create, update, delete, or set default roles (`roles.permissions JSONB`). Enforces privilege escalation prevention (`canAssignRole`).
- **`GET / PATCH / DELETE /api/members`** (`members: 'use'` / `'manage'`): Member roster, role assignment (with last-admin advisory lock), and membership approval (`'pending' | 'active' | 'suspended' | 'alumni' | 'rejected'`).
- **`GET / DELETE /api/audit`** (`soc: 'manage'` or `role_admin`): Query or prune immutable governance and security audit logs (`audit_logs`).
- **`GET / PUT /api/settings/community`** (`settings: 'manage'`): Read and update Organization Archetype, Parent Entity, Organization Name, Domain, and signatory titles in `organization_settings`.
- **`GET / PUT / POST /api/settings/smtp`** (`settings: 'manage'`): Configure AES-256-GCM encrypted SMTP relay settings (`organization_settings.smtp_config`) and send test emails (`/api/settings/smtp/test`).

### Organizational Units & Kanban (`teams`)
- **`GET / POST /api/teams`** & **`GET /api/teams/discover`**: Browse units (`'squad' | 'committee' | 'council' | 'guild'`), apply to join (`unit_members`), approve members, and manage unit settings.
- **`GET / PATCH / DELETE /api/teams/tasks/[id]`**: Kanban task detail sheet, embedded checklists (`tasks.checklist JSONB`), comments (`task_comments`), and automatic XP rewards upon task completion (`status = 'done'`).

### Real-Time Chat & Polls (`chat`)
- **`GET / POST /api/chat/rooms`**: List or create community channels (`'channel'`), unit rooms (`'unit'`), and 1-on-1 or Group DM rooms (`'direct'`).
- **`GET / POST / PATCH / DELETE /api/chat/messages`**: Cursor-paginated messages, replies, forwarding, emoji reactions, and read-cursor updates (`chat_members.last_read_at`).
- **`POST /api/chat/poll`**: Create interactive multi-option polls (`polls`) and cast votes in real time.
- **`GET /api/chat/stream`**: SSE stream (`chat_events`) for live room messaging and typing indicators.

### Zero-Trust Database Studio (`database`)
All `/api/database/*` endpoints (except `/auth`) require both `database: 'manage'` **and** a valid, non-expired `x-db-token` header obtained by completing a secondary 2FA/Passkey challenge at `POST /api/database/auth`:
- **`GET /api/database/tables`** & **`GET /api/database/schema`**: Inspect all 32 PostgreSQL tables, columns, indexes, and foreign keys.
- **`GET /api/database/data`** & **`POST /api/database/mutate`**: Paginated row browser and parameterized cell editor.
- **`POST /api/database/query`**: Sandboxed SQL query runner (blocks `COPY ... PROGRAM` and direct security/audit table tampering).
- **`GET /api/database/audit`**: Dedicated audit trail of every query and mutation executed inside DB Studio.

---

## 10. Unauthenticated Public Syndication API (`/api/public/v1/*`)

External websites and landing pages can syndicate public community content without session cookies (`src/lib/publicApi.ts`):

- **CORS & Rate Limiting:** Controlled via allowed origins (`Access-Control-Allow-Origin`) and per-IP rate limiting (`60 req / 60s`).
- **`GET /api/public/v1/news`**: Cursor-paginated list of published articles (`news_posts.status = 'published'`). Supports `?limit=12`, `?cursor=<ms>_<id>`, and `?category=<name>`.
- **`GET /api/public/v1/news/[slug]`**: Full Markdown body and metadata for a single published article.
- **`GET /api/public/v1/events`**: Cursor-paginated list of public events (`events.status IN ('published', 'completed')`). Supports `?state=upcoming|past|all` and `?category=workshop|seminar|hackathon|meeting|social|townhall`.

**Example Response (`GET /api/public/v1/events?state=upcoming&limit=2`):**
```json
{
  "items": [
    {
      "id": "e1b8f4c0-9a21-4d8a-8c1e-3f0a9b2c1d4e",
      "slug": "distributed-systems-workshop",
      "title": "Distributed Systems & Consensus Workshop",
      "category": "workshop",
      "summary": "Hands-on Raft and Paxos implementation in Go and TypeScript.",
      "location": "Orbit Lab A / Live Stream",
      "startsAt": "2026-11-15T14:00:00.000Z",
      "endsAt": "2026-11-15T17:00:00.000Z",
      "capacity": 60,
      "registeredCount": 42,
      "status": "published"
    }
  ],
  "nextCursor": null
}
```
