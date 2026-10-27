# Orbit Community OS — REST & SSE API Reference

This document specifies the HTTP REST endpoints, Server-Sent Events (SSE) streams, OAuth 2.0 / OIDC Identity Provider contracts, Zero-Config Setup endpoints, Autonomous SoC & SOAR playbooks, and domain APIs for **Orbit Community OS** by **tetha42**.

---

## Table of Contents

1. [API Design Principles & Standard Response Envelopes](#1-api-design-principles--standard-response-envelopes)
2. [Zero-Config Setup & Onboarding Endpoints (`/api/setup` & `/api/kurulum`)](#2-zero-config-setup--onboarding-endpoints-apisetup--apikurulum)
3. [Authentication, 2FA & WebAuthn Passkey Endpoints (`/api/auth/*`)](#3-authentication-2fa--webauthn-passkey-endpoints-apiauth)
4. [OAuth 2.0 & OpenID Connect (OIDC) Identity Provider (`/api/oauth/*`)](#4-oauth-20--openid-connect-oidc-identity-provider-apioauth)
5. [Autonomous SoC Telemetry & SOAR Playbooks (`/api/soc/*`)](#5-autonomous-soc-telemetry--soar-playbooks-apisoc)
6. [Events, QR Attendance & Check-In (`/api/etkinlikler/*`)](#6-events-qr-attendance--check-in-apietkinlikler)
7. [Cryptographic Certificates & Document Verification (`/api/sertifikalar/*`)](#7-cryptographic-certificates--document-verification-apisertifikalar)
8. [Finance, Treasury & Sub-Ledgers (`/api/butce/*`)](#8-finance-treasury--sub-ledgers-apibutce)
9. [Core Workspace, RBAC, Teams, Chat & Zero-Trust DB Studio](#9-core-workspace-rbac-teams-chat--zero-trust-db-studio)
10. [Unauthenticated Public Syndication API (`/api/public/v1/*`)](#10-unauthenticated-public-syndication-api-apipublicv1)

---

## 1. API Design Principles & Standard Response Envelopes

### Authentication & Authorization Gate (`requireApp`)

All workspace API endpoints enforce server-side session verification, IP binding (`Pass-the-Cookie` defense), mandatory 2FA checks, and per-app RBAC permissions via `requireApp(request, appId, level)` (`src/lib/auth/access.ts`).

- **Session Cookie:** Authenticated requests carry an `HttpOnly`, `SameSite=Lax` cookie (`oturum_token` / session cookie). The raw token is hashed with `SHA-256` before comparing against `kullanicilar.aktifOturumToken`.
- **Edge WAF & Rate Limiting:** Every mutating request (`POST`, `PUT`, `PATCH`, `DELETE`) passes through `inspectRequestPayload(request)` (`src/lib/waf.ts`) and sliding-window rate limiters (`src/lib/rateLimit.ts`).

### Standard JSON Envelopes

#### Success Envelope
```json
{
  "success": true,
  "data": { ... }
}
```
*(Read endpoints may also return domain arrays or keyed collections directly, e.g. `{ "etkinlikler": [...] }` or `{ "items": [...], "nextCursor": null }`, consumed by `useJsonResource(url)`).*

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
| `401 Unauthorized` | `UNAUTHENTICATED` / `SESSION_IP_MISMATCH` | Missing/expired session cookie, or client IP changed mid-session |
| `403 Forbidden` | `2FA_SETUP_REQUIRED` / `INSUFFICIENT_PERMISSION` / `WAF_BLOCKED` | Role lacks required `kullan`/`yonet` level, mandatory 2FA not yet enrolled, or WAF/IP quarantine active |
| `404 Not Found` | `NOT_FOUND` | Resource does not exist or caller lacks visibility (prevents ID enumeration) |
| `409 Conflict` | `son-admin` / `CAPACITY_FULL` | Attempted to demote the last active admin, or event/team capacity reached |
| `429 Too Many Requests` | `RATE_LIMITED` | Sliding-window rate limit exceeded (`Retry-After` header included) |

---

## 2. Zero-Config Setup & Onboarding Endpoints (`/api/setup` & `/api/kurulum`)

Orbit Community OS requires zero `.env` or `config.ini` files. First-run initialization is handled entirely over HTTP by the **Web UI Setup Wizard (`/setup` / `/kurulum`)**.

### `GET /api/kurulum` (Setup Status & Connectivity Probe)
Returns current initialization state without crashing even when PostgreSQL is unconfigured or offline.

**Response (`200 OK`):**
```json
{
  "hazir": false,
  "firstRun": true,
  "step": "database",
  "dbStatus": {
    "connected": true,
    "configured": true,
    "databaseName": "orbit"
  },
  "brand": {
    "studioName": "tetha42",
    "communityName": "Orbit Community",
    "domain": "orbit.local"
  }
}
```

### `POST /api/kurulum/test-db` (Live PostgreSQL Connection Test)
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

### `POST /api/kurulum` & `POST /api/kurulum/complete` (Execute Zero-Config Onboarding)
Atomically reconfigures the runtime PostgreSQL pool (`reconfigurePgPool`), runs idempotent schema initialization (`ensurePostgresInit`), persists Studio & Community identity into `sistem_ayarlari`, creates the first super-administrator account under `pg_advisory_xact_lock(hashtext('setup.first_admin'))`, seeds the default community chat channel, and attaches an authenticated `HttpOnly` session cookie.

> **Security Gate:** Once at least one user holds `rol_admin`, `POST /api/kurulum` permanently rejects any further admin creation attempts (`400 Bad Request`).

**Request Body:**
```json
{
  "dbUrl": "postgresql://orbit:secret@localhost:5432/orbit",
  "identity": {
    "studioName": "tetha42",
    "communityName": "Orbit Community",
    "domain": "orbit.local"
  },
  "admin": {
    "ad": "Ada",
    "soyad": "Lovelace",
    "eposta": "admin@orbit.local",
    "sifre": "correct-horse-battery-staple-42"
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
| `POST /api/auth/register` | Public (Rate-limited: 5/min/IP) | Submit a new community membership application (Full Name, Email, Member ID / Handle, Track/Discipline, Password) |
| `POST /api/auth/login` | Public (Rate-limited) | Authenticate with email + password; returns session cookie or `{ requires2FA: true, challengeToken }` |
| `POST /api/auth/logout` | Session | Revoke active session token in PostgreSQL and clear `HttpOnly` cookie |
| `GET /api/auth/me` | Session | Return current user profile, resolved RBAC permission map (`yetki.izinler`), and 2FA status |
| `POST /api/auth/verify-password` | Session | Re-verify password to unlock a locked desktop session |
| `POST /api/auth/reset-password` | Public / Token | Request or complete an email-verified password reset |
| `GET /api/auth/2fa/status` | Session | Inspect TOTP 2FA enrollment state and remaining recovery codes |
| `POST /api/auth/2fa/setup` | Session | Generate a new Base32 TOTP secret and provisioning QR URI (`otpauth://`) |
| `POST /api/auth/2fa/enable` | Session | Confirm a 6-digit TOTP code (`otplib`), activate 2FA, and issue 8 single-use recovery codes |
| `POST /api/auth/2fa/challenge` | Challenge Token | Complete second-factor login using a 6-digit TOTP code or recovery code (replay-protected via `totpSonAdim`) |
| `POST /api/auth/2fa/disable` | Session + Password/2FA | Disable TOTP 2FA (blocked if user's role has `ikiAdimZorunlu = 1`) |
| `GET /api/auth/passkey` | Session | List registered FIDO2 / WebAuthn Passkeys (`webauthn_credentials`) |
| `POST /api/auth/passkey/register/options` | Session | Generate WebAuthn attestation challenge (`@simplewebauthn/server`) |
| `POST /api/auth/passkey/register/verify` | Session | Verify hardware/biometric attestation and store COSE public key + signature counter |
| `POST /api/auth/passkey/login/options` | Public | Generate WebAuthn assertion challenge for passwordless sign-in |
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
| `GET / POST / DELETE /api/oauth/clients` | Manage registered OAuth 2.0 client applications (Requires `settings: yonet`) |

---

## 5. Autonomous SoC Telemetry & SOAR Playbooks (`/api/soc/*`)

All `/api/soc/*` endpoints require `requireApp(request, 'soc', 'kullan' | 'yonet')`.

### `GET /api/soc` (Live Posture, Radar, SIEM & Incidents)
Returns current DEFCON level (`1`–`5`), active Lockdown status, Threat Radar metrics, 24-hour SIEM log histograms, active IP bans (`guvenlik_engelleri`), Canary honeypot hits, and open security incidents (`soc_incidents`).

### `GET /api/soc/stream` (Real-Time SoC Telemetry SSE)
Server-Sent Events (`text/event-stream`, `X-Accel-Buffering: no`) pushing real-time WAF blocks, Canary triggers, FIM alerts, and incident updates to `SocContext.tsx`.

### `POST /api/soc/playbooks` (Execute Automated SOAR Response)
Requires `soc: yonet`. Executes atomic defensive actions and logs an immutable audit entry:

**Supported Playbook Actions:**
- `set_defcon`: Change community security posture (`level: 1..5`) or toggle Emergency Lockdown (`lockdown: true | false`).
- `ban_ip` / `unban_ip`: Quarantine or release an IP address in `guvenlik_engelleri`.
- `revoke_user_sessions`: Immediately invalidate a user's `aktifOturumToken` and broadcast `oturum-sonlandi` via SSE.
- `kill_terminal_sessions`: Terminate all active Linux PTY shell processes belonging to a user (`closeUserTerminalSessions`).
- `freeze_db_access` / `unfreeze_db_access`: Revoke or restore Zero-Trust DB Studio eligibility (`freezeUserDatabaseAccess`).
- `resolve_incident`: Update status, assignee, or post-mortem notes on a `soc_incidents` record.

### Additional SoC Endpoints
- **`GET / POST /api/soc/inspection`**: Trigger Go-powered File Integrity Monitoring (FIM) scans (`tools/bin/fim-scanner`), inspect SHA-256 baseline drift, and view unified file diffs.
- **`POST /api/soc/testbench`**: Run controlled security simulations (WAF signature validation, OAuth PKCE flow verification, rate-limit stress check).
- **`GET /api/soc/export`**: Export forensic incident dossiers and filtered SIEM logs in JSON or CSV format.

---

## 6. Events, QR Attendance & Check-In (`/api/etkinlikler/*`)

| Method & Path | Permission | Description |
| :--- | :--- | :--- |
| `GET /api/etkinlikler` | `events: kullan` | List community events with RSVP counts, capacity status, and caller's registration state |
| `POST /api/etkinlikler` | `events: yonet` | Create a new event (`atolye`, `seminer`, `yarisma`, `toplanti`), update status, or toggle live check-in |
| `POST /api/etkinlikler/[id]/katilim` | `events: kullan` | RSVP to an event (`SELECT ... FOR UPDATE` capacity lock) or self-cancel an existing registration |
| `GET / POST /api/etkinlikler/[id]/yoklama-kodu` | `events: yonet` / `kullan` | Generate rotating QR check-in tokens & 6-digit short codes (managers) or submit attendance check-in at `/checkin` (`/yoklama`) |

---

## 7. Cryptographic Certificates & Document Verification (`/api/sertifikalar/*`)

| Method & Path | Permission | Description |
| :--- | :--- | :--- |
| `GET /api/sertifikalar` | `certificates: kullan` | List issued certificates (members see their own; managers see all) |
| `POST /api/sertifikalar` | `certificates: yonet` | Issue single or bulk certificates with unique verification codes (e.g., `ORB-2026-X9A-4021`) |
| `GET /api/sertifikalar/[kod]` | **Public** (Rate-limited) | Verify a certificate or official governance document (`kararNo`) by its verification code for the standalone `/verify` (`/dogrula`) portal |

---

## 8. Finance, Treasury & Sub-Ledgers (`/api/butce/*`)

All treasury mutations run inside `pg_advisory_xact_lock(hashtext('kasa:<takimId|genel>'))` transactions to prevent negative balances or race conditions.

| Method & Path | Permission | Description |
| :--- | :--- | :--- |
| `GET /api/butce/kasalar` | `budget: kullan` or Team Lead | List accessible treasuries (General Community Vault + R&D Team Sub-Vaults) with live balances in minor units (`tutarKurus`) |
| `GET /api/butce` | `verifyKasaAccess` (Read) | Fetch ledger transactions (`gelir` / `gider`), inter-vault transfers (`aktarimId`), and receipt attachments (`fisFotoUrl`) |
| `POST /api/butce` | `verifyKasaAccess` (Write) | Record income/expense entries, execute atomic inter-vault allocations (locks both vaults in deterministic order), or amend descriptions/receipts |

---

## 9. Core Workspace, RBAC, Teams, Chat & Zero-Trust DB Studio

### RBAC & Governance
- **`GET / POST / PATCH / DELETE /api/roller`** (`settings: yonet`): Create, update, delete, or set default roles. Enforces privilege escalation prevention (`rolVerilebilirMi`).
- **`GET / PATCH / DELETE /api/uyeler`** (`members: kullan` / `yonet`): Member roster, role assignment (`setKullaniciRol` with last-admin advisory lock), and membership approval.
- **`GET /api/denetim`** (`settings: yonet`): Query immutable governance and security audit logs (`denetim_kaydi`).
- **`GET / PUT /api/settings/community`** (`settings: yonet`): Read and update Studio name, Community name, Domain, and signatory titles in `sistem_ayarlari`.
- **`GET / PUT / POST /api/settings/smtp`** (`settings: yonet`): Configure AES-256-GCM encrypted SMTP relay settings and send test emails (`/api/settings/smtp/test`).

### R&D Teams & Kanban (`teams`)
- **`GET / POST /api/takimlar`** & **`GET /api/takimlar/kesfet`**: Browse squads, apply to join, approve members, and manage team settings.
- **`GET / PATCH / DELETE /api/takimlar/gorevler/[id]`**: Kanban task detail sheet, checklists (`takim_gorev_maddeleri`), comments (`takim_gorev_yorumlari`), activity log (`takim_gorev_aktivite`), and automatic XP rewards upon task completion.

### Real-Time Chat (`chat`)
- **`GET / POST /api/chat/rooms`**: List or create community channels (`genel`), team rooms (`takim`), and 1-on-1 or Group DM rooms (`ozel`).
- **`GET / POST / PATCH / DELETE /api/chat/messages`**: Cursor-paginated messages, replies, forwarding, emoji reactions, and read-cursor updates (`markRoomAsRead`).
- **`POST /api/chat/poll`**: Create interactive multi-option polls and cast votes in real time.
- **`GET /api/chat/stream`**: SSE stream (`club_chat_events`) for live room messaging and typing indicators.

### Zero-Trust Database Studio (`database`)
All `/api/database/*` endpoints (except `/auth`) require both `database: yonet` **and** a valid, non-expired `x-db-token` header obtained by completing a secondary 2FA challenge at `POST /api/database/auth`:
- **`GET /api/database/tables`** & **`GET /api/database/schema`**: Inspect PostgreSQL tables, columns, indexes, and foreign keys.
- **`GET /api/database/data`** & **`POST /api/database/mutate`**: Paginated row browser and parameterized cell editor.
- **`POST /api/database/query`**: Sandboxed SQL query runner (blocks `COPY ... PROGRAM` and direct security table tampering).
- **`GET /api/database/audit`**: Dedicated audit trail of every query and mutation executed inside DB Studio.

---

## 10. Unauthenticated Public Syndication API (`/api/public/v1/*`)

External websites and landing pages can syndicate public community content without session cookies (`src/lib/publicApi.ts`):

- **CORS & Rate Limiting:** Controlled via allowed origins (`Access-Control-Allow-Origin`) and per-IP rate limiting (`60 req / 60s`).
- **`GET /api/public/v1/news`**: Cursor-paginated list of published articles (`yayinDurumu = 'yayinda'`). Supports `?limit=12`, `?cursor=<ms>_<id>`, and `?category=<name>`.
- **`GET /api/public/v1/news/[slug]`**: Full Markdown body and metadata for a single published article.
- **`GET /api/public/v1/events`**: Cursor-paginated list of public events (`durum IN ('yayinda', 'tamamlandi')`). Supports `?state=upcoming|past|all` and `?type=atolye|seminer|yarisma|toplanti`.

**Example Response (`GET /api/public/v1/events?state=upcoming&limit=2`):**
```json
{
  "items": [
    {
      "id": "e1b8f4c0-9a21-4d8a-8c1e-3f0a9b2c1d4e",
      "slug": "distributed-systems-workshop",
      "title": "Distributed Systems & Consensus Workshop",
      "type": "atolye",
      "summary": "Hands-on Raft and Paxos implementation in Go and TypeScript.",
      "location": "Orbit Lab A / Live Stream",
      "startsAt": "2026-11-15T14:00:00.000Z",
      "endsAt": "2026-11-15T17:00:00.000Z",
      "capacity": 60,
      "registeredCount": 42,
      "status": "yayinda"
    }
  ],
  "nextCursor": null
}
```
