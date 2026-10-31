# Orbit Community OS — Authentication, Cyber Defense & Legal Compliance

**Orbit Community OS** by **tetha42** is engineered with a defense-in-depth, zero-trust security architecture. Rather than relying on external security appliances, Orbit embeds an **Autonomous Security Operations Center (`SoC Pro Studio`)**, automated **SOAR response playbooks**, hardware-backed **FIDO2 / WebAuthn Passkeys**, **AI & Recon Canary Honeypots**, and **Go-powered File Integrity Monitoring (FIM)** directly into the operating system kernel.

---

## Table of Contents

1. [Authentication Lifecycle & Cryptographic Primitives](#1-authentication-lifecycle--cryptographic-primitives)
2. [Multi-Factor Authentication: TOTP 2FA & WebAuthn Passkeys](#2-multi-factor-authentication-totp-2fa--webauthn-passkeys)
3. [Session Integrity & Pass-the-Cookie Shield](#3-session-integrity--pass-the-cookie-shield)
4. [Global Legal Compliance (Terms of Service, GDPR Privacy Policy, Cookie Policy)](#4-global-legal-compliance-terms-of-service-gdpr-privacy-policy-cookie-policy)
5. [Autonomous SoC Defense & DEFCON 1–5 Posture](#5-autonomous-soc-defense--defcon-15-posture)
6. [Edge WAF & AI / Recon Canary Honeypot Fleet](#6-edge-waf--ai--recon-canary-honeypot-fleet)
7. [Automated SOAR Playbooks & Zero-Trust DB Studio Guard](#7-automated-soar-playbooks--zero-trust-db-studio-guard)
8. [File Integrity Monitoring (FIM) & Immutable Audit Trails](#8-file-integrity-monitoring-fim--immutable-audit-trails)

---

## 1. Authentication Lifecycle & Cryptographic Primitives

### Password Hashing (Argon2id / bcrypt)
- User passwords require a minimum of 12 characters for administrative accounts (`setupFirstAdmin` / `bootstrapAdminEnv`) and strong entropy validation across all member registrations.
- Passwords are never stored or logged in plaintext; they are salted and hashed using high-cost `bcrypt` (cost factor `12`) / Argon2id-compatible verification envelopes (`src/db/index.ts`, `src/lib/auth/`).

### Secret Encryption at Rest (`secretBox.ts`)
- Sensitive runtime credentials stored in `sistem_ayarlari`—such as outbound SMTP relay passwords—are encrypted at rest using **AES-256-GCM** (`src/lib/auth/secretBox.ts`) keyed by a 256-bit HKDF derivative of the instance's `auth_secret`.

### Single Active Session & At-Rest Token Hashing
- Upon successful login, the server generates a cryptographically random 256-bit session token (`establishSession` in `src/lib/auth/session.ts`).
- The raw token is transmitted exclusively to the browser inside an `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookie.
- **Database Breach Resilience:** The database (`kullanicilar.aktifOturumToken`) stores only the **SHA-256 hash** of the session token. Even if an attacker obtained a read-only SQL dump of `kullanicilar`, they could not reconstruct valid session cookies to impersonate users.
- Signing in from a new browser invalidates the previous `aktifOturumToken` and dispatches an immediate `oturum-sonlandi` event over the `/api/olaylar` SSE stream to sign out older tabs.

---

## 2. Multi-Factor Authentication: TOTP 2FA & WebAuthn Passkeys

### Time-Based One-Time Passwords (TOTP — RFC 6238)
- Powered by `otplib` (`src/lib/auth/totp.ts`), members can enroll any standard authenticator app (1Password, Apple Passwords, Google Authenticator, Authy, Aegis).
- **Single-Use Replay Protection (`totpSonAdim`):** Standard TOTP codes remain mathematically valid for a 30-second window. To prevent a network eavesdropper or shoulder-surfer from reusing a captured 6-digit code within the same 30-second window, Orbit records the accepted time-step in `kullanicilar.totpSonAdim` and rejects any code whose time-step is `<= totpSonAdim`.
- **Recovery Codes:** Enabling 2FA generates 8 single-use recovery codes, each individually hashed with `bcrypt` in `kullanicilar.totpRecoveryCodes`.
- **Role-Enforced Mandatory 2FA (`ikiAdimZorunlu`):** A role configured with mandatory 2FA (including the built-in `Admin` role) blocks password-only sessions (`403 { code: '2FA_SETUP_REQUIRED' }`) until a TOTP authenticator is enrolled. A session established with a WebAuthn passkey already satisfies the second factor and is not asked for a TOTP code afterwards.

### FIDO2 / WebAuthn Hardware & Biometric Passkeys
- Powered by `@simplewebauthn/server` and `@simplewebauthn/browser` (`src/lib/auth/webauthn.ts`), Orbit supports passwordless and second-factor sign-in via Touch ID, Face ID, Windows Hello, Android Biometrics, and hardware security keys (YubiKey).
- **Cryptographic Challenge Lifecycle:** Registration and authentication challenges (`webauthn_challenges`) are single-use, bound to the session/origin (`WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN`), and expire automatically.
- **Clone Detection (`counter`):** Every assertion verifies that the authenticator's signature counter strictly increments above `webauthn_credentials.counter`. A regressed counter immediately aborts authentication and logs a high-severity SoC alert for potential hardware key cloning.

---

## 3. Session Integrity & Pass-the-Cookie Shield

To neutralize stolen session cookies (XSS, malware stealer logs, or MITM session hijacking), Orbit enforces **Pass-the-Cookie IP Binding** on every authenticated request (`verifyAuth` in `src/lib/auth/authGuard.ts`):

1. When a session is established, the client's network address is recorded in `kullanicilar.sonGirisIp`.
2. On every subsequent API call or SSE handshake, `verifyAuth` compares the request's client IP (`clientAddress(request)`) against `sonGirisIp`.
3. If an IP mismatch is detected on a protected session:
   - The session token is **immediately revoked** in PostgreSQL.
   - A high-severity security event is written to `sistem_loglari` and broadcast to **SoC Pro Studio**.
   - The server responds with `401 Unauthorized` (`{ "error": "SESSION_IP_MISMATCH" }`), forcing clean re-authentication.

---

## 4. Global Legal Compliance (Terms of Service, GDPR Privacy Policy, Cookie Policy)

Orbit Community OS is designed for international open-source collectives, research institutions, and digital communities, adhering to global privacy and governance standards:

### 1. Terms of Service & Community Charter
- During account registration (`RegisterForm.tsx`), prospective members review and explicitly accept the **Community Charter & Terms of Service**, which establishes:
  - Open-source collaboration ethics, code of conduct, and intellectual property guidelines.
  - Governance structure (Community Leads, Core Maintainers, R&D Squad Leads, and Audit Reviewers).
  - Transparent treasury and hardware lab accountability rules.

### 2. GDPR-Aligned Privacy Policy & Data Minimization
- Orbit collects only the minimum personal data required for community operation:
  - **Identity & Handle:** Full Name, Email Address, global **Member ID / Handle**, and engineering track/discipline.
  - **Security & Audit Telemetry:** Password hash, client IP address for session integrity and WAF protection, and immutable administrative audit logs (`denetim_kaydi`).
- **Zero Commercial Tracking or Third-Party Data Monetization:** Member data is self-hosted entirely within the community's own PostgreSQL instance and is never sold, shared with ad networks, or transmitted to external analytics providers.
- **Data Subject Rights (Access, Rectification, Erasure, Portability):** Members and administrators can inspect personal profile records, export activity logs, and execute account deletion or anonymization in compliance with **GDPR Articles 15–20**.

### 3. Strict First-Party Cookie Policy
- Orbit uses **strictly necessary first-party `HttpOnly` authentication cookies** (`oturum_token`) required to maintain secure sessions and CSRF protection (`SameSite=Lax`).
- UI preferences (theme mode, accent color, reduced motion, locale, and window coordinates) are stored locally in the user's browser (`localStorage` and `IndexedDB`) with zero third-party tracking cookies.

---

## 5. Autonomous SoC Defense & DEFCON 1–5 Posture

**SoC Pro Studio (`src/apps/soc/`)** provides security operators with a real-time command center and a five-tier readiness posture (**DEFCON 5** through **DEFCON 1**):

| Posture Level | Operational State | Automated System Behavior |
| :--- | :--- | :--- |
| **DEFCON 5** | Normal Readiness | Standard WAF signature inspection, sliding-window rate limits, and passive Canary monitoring |
| **DEFCON 4** | Elevated Vigilance | Tighter rate-limit thresholds on authentication and public API endpoints; verbose SIEM logging |
| **DEFCON 3** | High Alert | Strict IP reputation scoring; automatic temporary quarantine on repeated `401`/`403` bursts |
| **DEFCON 2** | Severe Threat | Non-essential public write endpoints throttled; mandatory step-up verification for sensitive actions |
| **DEFCON 1 (Lockdown)** | **Emergency Quarantine** | One-click **Emergency Lockdown** freezes non-admin sessions, disables public registrations and terminal shells, and isolates the workspace to authorized SoC operators |

---

## 6. Edge WAF & AI / Recon Canary Honeypot Fleet

Every incoming HTTP request traverses `src/proxy.ts` and `src/lib/waf.ts` before reaching application logic:

### Signature-Based Web Application Firewall (WAF)
Inspects URL paths, query strings, headers, and JSON payloads for:
- SQL Injection (`UNION SELECT`, boolean/time-based blind payloads, stacked queries).
- Cross-Site Scripting (XSS `<script>`, event handlers, `javascript:` URIs).
- Path Traversal & Local File Inclusion (`../`, `/etc/passwd`, `/proc/self/environ`).
- Command Injection & SSRF vectors.

Each matched signature logs a forensic entry in `sistem_loglari` and increments the offending IP's threat score via `recordSecurityStrike`.

### AI & Recon Canary Deception Fleet
Automated vulnerability scanners, rogue AI scraping agents, and reconnaissance bots routinely probe well-known sensitive paths. Orbit deploys deceptive **Canary Honeypot routes** inside `src/proxy.ts`:
- `/.env`, `/.git/config`, `/wp-login.php`, `/wp-admin`, `/phpmyadmin`, `/admin/config.php`, `/actuator/env`, `/.aws/credentials`

**Instant Quarantine:** The moment any client touches a Canary path, Orbit assigns a **100-point threat strike**, immediately quarantines the IP address in `guvenlik_engelleri`, creates a critical incident in `soc_incidents`, and fires a real-time alert to SoC Pro Studio and configured security webhooks (`src/lib/server/securityWebhook.ts`).

---

## 7. Automated SOAR Playbooks & Zero-Trust DB Studio Guard

### SOAR (Security Orchestration, Automation, and Response)
From **SoC Pro Studio**, operators (or automated threshold triggers) can execute atomic response playbooks (`src/lib/server/soarPlaybooks.ts`):
1. **Session Freeze (`revoke_user_sessions`):** Clears `aktifOturumToken` and pushes an instant SSE termination signal to all connected devices of a compromised account.
2. **Linux PTY Shell Kill-Switch (`kill_terminal_sessions`):** Immediately sends `SIGKILL` to any active pseudo-terminal processes spawned by the user in the **Terminal** mini-app.
3. **Database Access Freeze (`freezeUserDatabaseAccess`):** Revokes any active `x-db-token` and blocks the account from authenticating into **DB Studio**.
4. **IP Quarantine (`ban_ip`):** Blocks the IP across all REST, SSE, and setup routes for a configurable duration or permanently.

### Zero-Trust DB Studio Guard (`src/lib/server/databaseAccess.ts`)
Access to the raw PostgreSQL database via **DB Studio** is never granted by session cookie alone—even for super-administrators:
- Opening DB Studio requires a second factor: a live TOTP verification at `POST /api/database/auth` for password/TOTP sessions, or a short-lived rememberable `x-db-token` issued directly for a passkey-authenticated session. Terminal access follows the same rule.
- The SQL execution engine (`POST /api/database/query`) parses and blocks dangerous superuser primitives such as `COPY ... PROGRAM`, `pg_read_file`, and direct tampering with `denetim_kaydi` or `kullanicilar.sifreHash`.

---

## 8. File Integrity Monitoring (FIM) & Immutable Audit Trails

### Go-Powered File Integrity Monitoring (`tools/fim/`)
- Orbit includes a compiled, high-concurrency Go binary (`tools/bin/fim-scanner`, source in `tools/fim/main.go`) that computes cryptographic **SHA-256** digests of critical source files, server routes, and configuration manifests against `tools/fim/baseline.json`.
- When triggered from **SoC Pro Studio → Blue Team / FIM** (`/api/soc/inspection`), any unauthorized file modification on disk is flagged immediately with a line-by-line **unified diff** viewer.

### Transactional Governance Audit Log (`denetim_kaydi`)
- Every sensitive state change (role creation/modification, permission grant, member role assignment, application approval, treasury allocation, SOAR playbook execution) calls `denetimYaz(client, ctx, entry)` (`src/db/audit.ts`) **inside the same PostgreSQL transaction** as the mutation.
- If the audit record fails to write, the entire database transaction rolls back.
- Before/after snapshots (`onceki` / `sonraki` JSONB) are filtered through a strict allowlist that strips password hashes, TOTP secrets, recovery codes, and session tokens.
- Automated retention maintenance (`denetimBakiminiBaslat`) preserves audit records for 730 days (`AUDIT_RETENTION_DAYS`, minimum 30 days).
