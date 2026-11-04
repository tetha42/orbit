# Orbit Community OS — User Data, Invitations & Session Security (v3.0)

> This document summarizes the `users` security model, cryptographic invitation lifecycle, password reset flows, `mail_outbox` approval queue, WebAuthn Passkey / 2FA behavior, and governance audit access in **Orbit Community OS v3.0**.
> For field-level specifications and schema architecture, see [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md), [`DATA_MODEL_ROADMAP.md`](./DATA_MODEL_ROADMAP.md), and [`DATABASE.md`](./DATABASE.md).

---

## 1. Data Inventory in the `users` Table

In Orbit v3.0, the `users` table consolidates person identity, community membership profile, authentication credentials, custom fields (`custom_fields JSONB`), and roaming desktop state (`workspace_state JSONB`) in pure English `snake_case` columns:

### Identity & Contact
- `id`, `first_name`, `last_name`, `display_name`
- `email`, `email_verified_at`
- `handle` (Universal Member ID / Student No / ENS / Handle)
- `locale`, `timezone`, `directory_visibility` (`'public' | 'members' | 'hidden'`)

### Community & Archetype Profile
- `track` (Academic Department, DAO Guild, Research Area, or Practice Track)
- `cohort_level` (Academic Year, Contributor Tier, or Seniority Level)
- `avatar_url`, `bio`, `skills JSONB`, `links JSONB`
- `custom_fields JSONB` (governed by `form_schemas` and indexed via PostgreSQL `GIN`)
- `xp`
- `status` (`'pending' | 'active' | 'suspended' | 'alumni' | 'rejected'`)
- `role_id` (references `roles.id`)
- `approved_by`, `approved_at`, `joined_at`, `created_at`, `updated_at`

### Authentication & Second Factor
- `password_hash` — bcrypt (cost 12) / Argon2id hash; never stored or logged in plaintext
- `password_changed_at`, `must_change_password`
- `auth_method` (`'password' | 'totp' | 'passkey'`)
- `session_token` (SHA-256 hash of the `orbit_session` cookie), `session_expires_at`
- `totp_secret` (AES-256-GCM encrypted), `totp_enabled`, `totp_recovery_codes JSONB` (8 bcrypt-hashed codes), `totp_confirmed_at`, `totp_last_step`

### Security Telemetry & Roaming Workspace State
- `last_login_at`, `last_login_ip`, `last_login_ua`
- `last_active_at`, `last_active_ip`
- `notification_prefs JSONB`
- `workspace_state JSONB` (cloud-roaming desktop layout, wallpaper, Dock items, audio/brightness)

### Related Security & Lifecycle Tables
- **`webauthn_credentials`** — Passkey COSE public key, signature clone counter, transport hints, and device type (**private keys never leave the user's hardware authenticator**).
- **`verification_tokens`** — Unified short-lived token ledger (`purpose: 'signup_otp' | 'password_reset' | 'email_change' | 'webauthn_reg' | 'webauthn_auth'`) storing only `token_hash` (SHA-256).
- **`user_consents` & `legal_documents`** — Cryptographic proof of accepted legal document versions (`document_version`, `content_hash`, `locale`, `ip`, `user_agent`).
- **`invitations`** — Single-use cryptographic invitation tokens (`token_hash`).
- **`unit_members`** — Membership, role title, voting weight, term limits, and application decision audit trail across organizational `units`.
- **`roles`** — Role metadata (`translations JSONB`) and per-app permission matrix (`permissions JSONB`: `Record<AppId, 'none' | 'use' | 'manage'>`).
- **`audit_logs`** — Immutable administrative and governance mutation ledger.
- **`mail_outbox`** — AES-256-GCM encrypted fallback queue for transactional emails when outbound SMTP is unconfigured or unreachable.

### Data Never Stored by Orbit
- Plaintext passwords
- WebAuthn / Passkey private keys
- Raw OTP codes or raw invitation tokens (only SHA-256 digests are persisted)
- External personal IMAP inbox contents

---

## 2. Cryptographic Invitation Workflow (`invitations`)

1. In **Settings → Membership Policy** (`organization_settings.membership_policy`), the invitation system (`inviteEnabled`) must be active.
2. An authorized manager creates an invitation specifying an optional target `email`, pre-assigned `role_id`, optional `unit_id`, `note`, and expiration window (default 7 days).
3. The server generates a cryptographically random 24-byte token. The raw token is displayed **only once** in the creation response; PostgreSQL stores only its SHA-256 digest in `invitations.token_hash`.
4. The invitee opens `/?invite=<token>` and submits the registration form.
5. The server verifies `token_hash`, expiration (`expires_at`), single-use status (`status = 'pending'`), and email match (if `invitations.email` was restricted).
6. The user account is created with `status = 'pending'`, pre-assigned the invitation's `role_id` (and `unit_id` if specified), and the invitation is atomically marked `status = 'accepted'`.
7. **Invitations never bypass manual administrator approval:** the application enters the review queue ready for final verification, and email OTP verification still applies if required by `membership_policy`.

---

## 3. Password Reset & Transactional `mail_outbox` Resilience

### Self-Service Password Reset (`/api/auth/reset-password`)
1. **`request_code`:** If the email matches an account, a 6-digit OTP is generated, hashed with SHA-256 into `verification_tokens` (`purpose = 'password_reset'`), and dispatched via email (responses are uniform to prevent account enumeration).
2. **`verify_and_reset`:** Once the OTP is verified within the attempt and TTL window, the new `password_hash` is written and all active sessions (`session_token`) are revoked.

### Offline / Unconfigured SMTP Fallback (`mail_outbox`)
If a signup verification OTP or password reset email cannot be delivered because outbound SMTP is not yet configured or temporarily unreachable:
- The email payload is encrypted using **AES-256-GCM** and queued in `mail_outbox` with `status = 'pending'`.
- The user is informed that their verification request has been queued for administrator dispatch, and the token's TTL is extended to 24 hours.
- Administrators review and approve queued transactional messages in **Mail → Outbox Approval**, which retries SMTP delivery or records any transport error for inspection.

### Administrator-Triggered Password Reset (`POST /api/members/[id]/password-reset`)
- Requires `members: 'manage'` permission.
- Generates a fresh 6-digit reset code in `verification_tokens` and sends it to the member's verified email address (the code is never returned to the administrator's browser).
- Disabled for `'role_admin'` target accounts to prevent lateral admin lockouts.
- Rate-limited to 3 requests per 15 minutes per actor and recorded in `audit_logs` (`member.password_reset`).

---

## 4. WebAuthn Passkeys & Mandatory 2FA Behavior

- **Passkey Enrollment:** Managed in **Settings → Account & Security** (`webauthn_credentials`).
- **Passwordless Sign-In:** On browsers supporting `PublicKeyCredential`, the login portal offers one-tap **Sign in with Passkey**.
- **Multi-Factor Equivalence:** A session authenticated via a hardware or biometric Passkey (`auth_method = 'passkey'`) inherently satisfies role-enforced mandatory 2FA (`roles.require_2fa = true`).
- **Zero-Trust Terminal & DB Studio Step-Up:** Passkey-authenticated sessions can obtain short-lived `x-db-token` grants (`method: 'passkey'`) and open Terminal shells without requiring a redundant TOTP code.

---

## 5. PWA Fullscreen Mode

- The web app manifest specifies `display: fullscreen` and `display_override: ['fullscreen', 'window-controls-overlay', 'standalone', 'minimal-ui']`.
- When launched as an installed PWA, Orbit attempts `requestFullscreen()` once on the first pointer or keyboard interaction, falling back gracefully to standard windowed rendering if declined by the browser or OS.

---

## 6. Governance & Security Audit Access (`audit_logs`)

- All administrative and domain mutation histories are centralized in **SoC Pro Studio → Forensics & Audit → Change History**.
- `GET /api/audit` requires `'role_admin'` or `soc: 'manage'`.
- `DELETE /api/audit` (manual retention purge) is restricted exclusively to `'role_admin'`.
