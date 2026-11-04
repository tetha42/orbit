# Orbit Community OS — Canonical Data Dictionary (v3.0)

> This document is the field-level specification for the **Orbit Community OS v3.0** Universal Data Platform described in [`DATA_MODEL_ROADMAP.md`](./DATA_MODEL_ROADMAP.md) and [`DATABASE.md`](./DATABASE.md).
> **Objective:** Define the owner, SQL type, nullability, visibility classification, edit authority, and retention policy for every entity across the consolidated **32-table English `snake_case` schema**.

---

## Table of Contents

1. [Data Classification & Visibility Lattice](#1-data-classification--visibility-lattice)
2. [Universal Organization Archetypes (`organization_settings`)](#2-universal-organization-archetypes-organization_settings)
3. [Identity, Membership & Account Security (`users`, `roles`, `webauthn_credentials`, `verification_tokens`, `invitations`)](#3-identity-membership--account-security)
4. [Dynamic Form Schemas & Legal Consent Evidence (`form_schemas`, `legal_documents`, `user_consents`)](#4-dynamic-form-schemas--legal-consent-evidence)
5. [OAuth 2.0 / OIDC Identity Provider (`oauth_clients`, `oauth_auth_codes`, `oauth_consents`)](#5-oauth-20--oidc-identity-provider)
6. [Core Infrastructure: Files, Notifications, Telemetry & Outbox (`files`, `notifications`, `audit_logs`, `system_logs`, `mail_outbox`)](#6-core-infrastructure-files-notifications-telemetry--outbox)
7. [Organizational Units & Kanban Execution (`units`, `unit_members`, `tasks`, `task_comments`)](#7-organizational-units--kanban-execution)
8. [Events, Check-In & Cryptographic Certificates (`events`, `event_participants`, `certificates`)](#8-events-check-in--cryptographic-certificates)
9. [Treasury, Projects, Hardware Lab & Governance (`treasury_entries`, `projects`, `inventory_items`, `governance_records`)](#9-treasury-projects-hardware-lab--governance)
10. [Publishing, Personal Notes, Real-Time Chat & Polls (`news_posts`, `notes`, `chat_rooms`, `chat_members`, `chat_messages`, `polls`)](#10-publishing-personal-notes-real-time-chat--polls)
11. [Autonomous Cyber Defense (`security_blocks`, `security_incidents`)](#11-autonomous-cyber-defense)
12. [Visibility & Edit Authority Matrix](#12-visibility--edit-authority-matrix)
13. [Cardinality & Retention Policy](#13-cardinality--retention-policy)
14. [Relational Index Coverage](#14-relational-index-coverage)

---

## 1. Data Classification & Visibility Lattice

| Classification | Examples | Access Rule |
| :--- | :--- | :--- |
| **Public** | Display name, avatar, unit name, public project title, published news | Accessible to unauthenticated visitors and all authenticated members |
| **Community** | Member handle, track, cohort level, bio, unit membership, skills | Visible to authenticated community members (`status = 'active'`) |
| **Manager** | Membership status, assigned role, application notes, decision reasons | Visible to domain managers (`members: 'manage'`, `settings: 'manage'`, or unit leads) |
| **Self** | Phone number, date of birth, personal workspace state, notification preferences | Visible only to the account owner and authorized domain managers |
| **Secret** | `password_hash`, `totp_secret`, `totp_recovery_codes`, `session_token` | Never returned by any REST or SSE endpoint; hashed or AES-256-GCM encrypted at rest |
| **Evidence** | `user_consents`, `audit_logs`, `unit_members` decision trail | Append-only / immutable; cannot be modified or forged by administrators |
| **Derived** | `xp`, attendance totals, `star_count` | Computed by domain services or atomic SQL increments; never manually edited in forms |

---

## 2. Universal Organization Archetypes (`organization_settings`)

Orbit Community OS supports four first-class **Organization Archetypes** out of the box without altering a single SQL table or column:

| Archetype Key | Target Organization Type | `parent_entity` Meaning | `users.handle` Meaning | `users.track` Meaning | `users.cohort_level` Meaning | `units.unit_type` Defaults |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `'academic_club'` | University Club / Student Society | University / Faculty Name | Student / Member ID | Academic Department | Academic Year (`1..4`, `MSc`, `PhD`) | `'squad'`, `'committee'` |
| `'dao_collective'` | DAO / Web3 Protocol Collective | Ecosystem / Network (e.g., Ethereum, Cosmos) | ENS / Wallet / GitHub Handle | Core Guild (`protocol`, `treasury`, `ops`) | Contributor Tier (`Tier 1..4`, `Core`) | `'squad'`, `'council'`, `'guild'` |
| `'research_lab'` | R&D Lab / Open-Source Foundation | Host Institute / Umbrella Foundation | Researcher ID / ORCID / Handle | Research Track (`ai`, `systems`, `security`) | Seniority (`Junior`, `Senior`, `Fellow`, `PI`) | `'squad'`, `'committee'` |
| `'professional_guild'` | Professional Guild / NGO / Association | Federation / Chapter Network | Membership License / Handle | Practice Area / Chapter | Fellowship Level (`Associate`, `Senior`, `Board`) | `'guild'`, `'council'`, `'committee'` |

### 2.1 `organization_settings` Table

| Column | Type | Required | Visibility | Editor | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Yes | System | System | Singleton primary key (`'default'`) |
| `archetype` | `TEXT` | Yes | Public | Settings (`'manage'`) | `'academic_club' \| 'dao_collective' \| 'research_lab' \| 'professional_guild'` |
| `slug` | `TEXT` | Yes | Public | Settings (`'manage'`) | URL-safe organization identifier |
| `name` | `TEXT` | Yes | Public | Settings (`'manage'`) | Canonical community or organization name |
| `tagline_i18n` | `JSONB` | Yes | Public | Settings (`'manage'`) | Localized tagline map (`Record<LocaleCode, string>`) |
| `description_i18n` | `JSONB` | Yes | Public | Settings (`'manage'`) | Localized description map (`Record<LocaleCode, string>`) |
| `parent_entity` | `TEXT` | No | Public | Settings (`'manage'`) | Host university, ecosystem, institute, or umbrella foundation |
| `domain` | `TEXT` | Yes | Public | Settings (`'manage'`) | Primary FQDN (e.g., `orbit.example.com`) |
| `logo_url` | `TEXT` | No | Public | Settings (`'manage'`) | Custom brand mark URL |
| `theme_config` | `JSONB` | Yes | Public | Settings (`'manage'`) | Default theme mode, accent palette, and visual tokens |
| `wallpapers` | `JSONB` | Yes | Public | Settings (`'manage'`) | Array of custom wallpaper definitions with localized titles (`translations JSONB`) |
| `signatories` | `JSONB` | Yes | Public | Settings (`'manage'`) | Authorized certificate/resolution signatories (`[{ name, title_i18n }]`) |
| `membership_policy` | `JSONB` | Yes | Public (read) | Settings (`'manage'`) | Registration policy (`selfRegistration`, `inviteEnabled`, `emailVerification`, `reapplyCooldownDays`, `allowedEmailDomains`) |
| `smtp_config` | `JSONB` | No | **Secret** | Settings (`'manage'`) | Outbound SMTP host, port, sender, and AES-256-GCM encrypted credentials |
| `security_policy` | `JSONB` | Yes | Manager | SoC / Settings | DEFCON posture, lockdown flag, and outbound security webhook configuration |
| `default_role_id` | `TEXT` (FK) | Yes | Manager | Settings (`'manage'`) | References `roles.id` (default `'role_member'`) |
| `updated_at` | `BIGINT` | Yes | Manager | System | UTC epoch milliseconds |

---

## 3. Identity, Membership & Account Security

### 3.1 `users` Table
Consolidates person identity, community membership profile, authentication credentials, custom field values (`custom_fields JSONB`), and roaming desktop state (`workspace_state JSONB`) in a single high-performance row.

| Column | Type | Required | Visibility | Editor | Description & Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Yes | System | System | UUID / `usr_...` |
| `email` | `TEXT` (`UNIQUE`) | Yes | Manager / Self | Self (verified) / Members (`'manage'`) | Normalized lowercase email address |
| `email_verified_at` | `BIGINT` | No | Manager | System | Timestamp of OTP verification |
| `password_hash` | `TEXT` | Yes | **Secret** | Self / System | Bcrypt (cost 12) / Argon2id hash |
| `password_changed_at` | `BIGINT` | No | Manager | System | UTC epoch milliseconds |
| `must_change_password` | `BOOLEAN` | Yes | Manager | Admin reset | Forces password rotation on next login |
| `first_name` | `TEXT` | Yes | Community | Self / Members (`'manage'`) | 2–60 characters; control characters prohibited |
| `last_name` | `TEXT` | Yes | Community | Self / Members (`'manage'`) | 2–60 characters |
| `display_name` | `TEXT` | No | Community | Self / Members (`'manage'`) | Optional preferred display name |
| `handle` | `TEXT` (`UNIQUE`) | Policy-driven | Community | Members (`'manage'`) | Universal Member ID / Student No / ENS / Handle (`[A-Za-z0-9_-]{3,32}`) |
| `avatar_url` | `TEXT` | No | Community | Self / Members (`'manage'`) | Verified image upload (max 2 MB, 320px normalized) |
| `bio` | `TEXT` | No | Community | Self / Members (`'manage'`) | Up to 280 characters |
| `track` | `TEXT` | Yes | Community | Self* / Members (`'manage'`) | Discipline, department, or guild track (validated against `form_schemas`) |
| `cohort_level` | `TEXT` | Yes | Community | Self* / Members (`'manage'`) | Academic year, seniority, or contributor tier |
| `skills` | `JSONB` | Yes | Community | Self / Members (`'manage'`) | Array of skill/technology tags (`string[]`) |
| `links` | `JSONB` | Yes | Community | Self / Members (`'manage'`) | External profile links (`github`, `website`, `linkedin`, `x`) |
| `custom_fields` | `JSONB` | Yes | Policy-driven | Self / Members (`'manage'`) | Key-value map governed by `form_schemas` (GIN indexed) |
| `role_id` | `TEXT` (FK) | Yes | Manager | Members / Settings | References `roles.id` |
| `status` | `TEXT` | Yes | Manager | Members (`'manage'`) | `'pending' \| 'active' \| 'suspended' \| 'alumni' \| 'rejected'` |
| `xp` | `INTEGER` | Yes | Community | **Derived** | Earned via event attendance and completed Kanban tasks |
| `locale` | `TEXT` | Yes | Self | Self | Active locale code from `src/locales/registry.ts` (default `'en'`) |
| `timezone` | `TEXT` | Yes | Self | Self | IANA timezone identifier (e.g., `'UTC'`, `'Europe/Istanbul'`) |
| `directory_visibility` | `TEXT` | Yes | Self / Manager | Self | `'public' \| 'members' \| 'hidden'` |
| `workspace_state` | `JSONB` | Yes | Self | Self | Cloud-roaming desktop state (`activeWallpaper`, `windows`, `dockApps`, `brightness`, `volume`) |
| `notification_prefs` | `JSONB` | Yes | Self | Self | Per-channel and email notification preferences |
| `auth_method` | `TEXT` | Yes | Manager | System | `'password' \| 'totp' \| 'passkey'` |
| `totp_secret` | `TEXT` | No | **Secret** | Self | AES-256-GCM encrypted Base32 TOTP seed |
| `totp_enabled` | `BOOLEAN` | Yes | Manager | Self | Whether TOTP 2FA is active |
| `totp_recovery_codes` | `JSONB` | No | **Secret** | Self | Array of 8 bcrypt-hashed single-use recovery codes |
| `totp_confirmed_at` | `BIGINT` | No | Manager | System | Timestamp of 2FA activation |
| `totp_last_step` | `BIGINT` | No | **Secret** | System | Replay-protection counter for accepted 30s TOTP windows |
| `session_token` | `TEXT` | No | **Secret** | System | SHA-256 hash of the active session cookie (`orbit_session`) |
| `session_expires_at` | `BIGINT` | No | Manager | System | Session expiration timestamp |
| `last_login_at` | `BIGINT` | No | Manager | System | Last successful authentication timestamp |
| `last_login_ip` | `TEXT` | No | Manager | System | Bound client IP for Pass-the-Cookie shield |
| `last_login_ua` | `TEXT` | No | Manager | System | User-Agent string at login |
| `last_active_at` | `BIGINT` | No | Manager | System | Last API activity timestamp |
| `last_active_ip` | `TEXT` | No | Manager | System | Last observed client IP |
| `approved_by` | `TEXT` (FK) | No | Manager | System | Administrator who approved the membership |
| `approved_at` | `BIGINT` | No | Manager | System | Approval timestamp |
| `joined_at` | `BIGINT` | No | Community | System | Timestamp of initial transition to `'active'` |
| `created_at` | `BIGINT` | Yes | Manager | System | Account creation timestamp |
| `updated_at` | `BIGINT` | Yes | Manager | System | Last profile mutation timestamp |

### 3.2 `roles` Table
Replaces the legacy `roles` + `role_permissions` join pattern with atomic `permissions JSONB` and `translations JSONB` support.

| Column | Type | Required | Visibility | Editor | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Yes | Community | Settings (`'manage'`) | System IDs: `'role_admin'`, `'role_board'`, `'role_member'`, `'role_alumni'` or custom |
| `slug` | `TEXT` (`UNIQUE`) | Yes | Community | Settings (`'manage'`) | URL-safe role identifier |
| `translations` | `JSONB` | Yes | Community | Settings (`'manage'`) | `{"en": {"name": "Administrator", "description": "..."}, "tr": {...}}` |
| `color` | `TEXT` | Yes | Community | Settings (`'manage'`) | Hex badge accent color |
| `permissions` | `JSONB` | Yes | Manager | Settings (`'manage'`) | `Record<AppId, 'none' \| 'use' \| 'manage'>` across all 16 user-facing mini-apps |
| `is_system` | `BOOLEAN` | Yes | Manager | System | `true` for immutable system roles (`'role_admin'`, `'role_member'`, `'role_alumni'`) |
| `is_default` | `BOOLEAN` | Yes | Manager | Settings (`'manage'`) | Marks the default role assigned to newly approved members |
| `require_2fa` | `BOOLEAN` | Yes | Manager | Settings (`'manage'`) | Enforces mandatory TOTP or Passkey enrollment (`403 2FA_SETUP_REQUIRED`) |
| `rank` | `INTEGER` | Yes | Manager | Settings (`'manage'`) | Hierarchy rank for privilege escalation checks |
| `created_at` | `BIGINT` | Yes | Manager | System | Creation timestamp |

### 3.3 `webauthn_credentials` Table

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Base64URL credential ID |
| `user_id` | `TEXT` (FK) | References `users.id` (`ON DELETE CASCADE`) |
| `public_key` | `TEXT` | COSE public key payload |
| `counter` | `BIGINT` | Signature counter for hardware clone detection |
| `transports` | `JSONB` | Authenticator transport hints (`['internal', 'hybrid', 'usb', 'nfc']`) |
| `device_type` | `TEXT` | `'singleDevice' \| 'multiDevice'` |
| `backed_up` | `BOOLEAN` | Passkey cloud sync status |
| `nickname` | `TEXT` | User-assigned passkey label (e.g., `"MacBook Touch ID"`) |
| `created_at` | `BIGINT` | Enrollment timestamp |
| `last_used_at` | `BIGINT` | Last assertion timestamp |

### 3.4 `verification_tokens` Table
Unified short-lived cryptographic token store replacing legacy `email_verifications`, `email_change_requests`, and `webauthn_challenges`.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Unique token record ID |
| `user_id` | `TEXT` (FK) | Nullable reference to `users.id` (`ON DELETE CASCADE`) |
| `target` | `TEXT` | Target email address or WebAuthn session identifier |
| `purpose` | `TEXT` | `'signup_otp' \| 'password_reset' \| 'email_change' \| 'webauthn_reg' \| 'webauthn_auth'` |
| `token_hash` | `TEXT` | SHA-256 digest of the OTP code or challenge string (raw token never persisted) |
| `metadata` | `JSONB` | Contextual payload (e.g., requested `newEmail`, `userAgent`, or WebAuthn RP options) |
| `attempts` | `INTEGER` | Failed verification counter (max 5 attempts) |
| `expires_at` | `BIGINT` | Strict TTL expiration timestamp (typically 15 minutes) |
| `consumed_at` | `BIGINT` | Marked upon single-use redemption |
| `created_ip` | `TEXT` | Client IP that initiated the request |
| `created_at` | `BIGINT` | Creation timestamp |

### 3.5 `invitations` Table

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Invitation UUID |
| `token_hash` | `TEXT` (`UNIQUE`) | SHA-256 hash of the 24-byte invitation token |
| `email` | `TEXT` | Optional target email (if set, registration email must match) |
| `first_name`, `last_name` | `TEXT` | Optional pre-filled invitee name |
| `handle`, `track`, `cohort_level` | `TEXT` | Optional pre-filled community profile attributes |
| `role_id` | `TEXT` (FK) | Role pre-assigned upon registration (`roles.id`) |
| `unit_id` | `TEXT` (FK) | Optional unit pre-assignment (`units.id`) |
| `status` | `TEXT` | `'pending' \| 'accepted' \| 'expired' \| 'revoked'` |
| `note` | `TEXT` | Internal administrator note |
| `custom_fields` | `JSONB` | Optional pre-populated custom field values |
| `invited_by` | `TEXT` (FK) | Administrator who generated the invitation (`users.id`) |
| `accepted_by` | `TEXT` (FK) | Member account that redeemed the invitation (`users.id`) |
| `expires_at` | `BIGINT` | Expiration timestamp (default 7 days) |
| `accepted_at` | `BIGINT` | Redemption timestamp |
| `created_at` | `BIGINT` | Creation timestamp |

---

## 4. Dynamic Form Schemas & Legal Consent Evidence

### 4.1 `form_schemas` Table
Consolidates core registration fields and custom community fields with zero-friction multi-language support via `translations JSONB`.

| Column | Type | Description |
| :--- | :--- | :--- |
| `field_key` | `TEXT` (PK) | Unique identifier (e.g., `'track'`, `'cohort_level'`, `'github_url'`, `'dietary_notes'`) |
| `is_core` | `BOOLEAN` | `true` for built-in archetype fields (`track`, `cohort_level`, `handle`); `false` for custom fields |
| `field_type` | `TEXT` | `'text' \| 'email' \| 'tel' \| 'number' \| 'date' \| 'textarea' \| 'select' \| 'checkbox'` (`password` prohibited) |
| `translations` | `JSONB` | Localized UI strings: `{"en": {"label": "...", "placeholder": "...", "help": "..."}, "tr": {...}}` |
| `options` | `JSONB` | Select options list with localized labels |
| `collect_at` | `TEXT` | `'registration' \| 'profile' \| 'admin' \| 'both'` |
| `required_at` | `TEXT` | `'registration' \| 'activation' \| 'never'` |
| `visibility` | `TEXT` | `'public' \| 'members' \| 'managers' \| 'self'` |
| `self_editable` | `BOOLEAN` | Whether members can edit this field in Settings → Account |
| `admin_editable` | `BOOLEAN` | Whether managers (`members: 'manage'`) can edit this field |
| `is_sensitive` | `BOOLEAN` | Masks value in standard roster exports |
| `sort_order` | `INTEGER` | Display sequence in registration and profile forms |
| `is_active` | `BOOLEAN` | Soft-archive toggle (`false` hides from new forms while preserving existing `users.custom_fields` data) |
| `created_at`, `updated_at` | `BIGINT` | Timestamps |

### 4.2 `legal_documents` Table
Stores active legal documents and immutable version archives inside `version_history JSONB`, using `translations JSONB` for multi-language content.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Document ID |
| `slug` | `TEXT` (`UNIQUE`) | `'terms' \| 'privacy' \| 'cookie_policy' \| 'charter' \| 'code_of_conduct'` |
| `scope` | `TEXT` | `'registration' \| 'members' \| 'all'` |
| `current_version` | `INTEGER` | Monotonically increasing version number (`+1` on content edit) |
| `content_hash` | `TEXT` | SHA-256 digest of the canonical document body for cryptographic proof |
| `is_required` | `BOOLEAN` | Whether acceptance is mandatory for registration/membership |
| `reconsent_required` | `BOOLEAN` | Prompts existing members to accept the updated version |
| `is_active` | `BOOLEAN` | Whether the document is currently published |
| `translations` | `JSONB` | `{"en": {"title": "...", "summary": "...", "body": "..."}, "tr": {...}}` |
| `version_history` | `JSONB` | Immutable array of prior versions (`[{ version, contentHash, translations, archivedAt, archivedBy }]`) |
| `published_at`, `updated_at` | `BIGINT` | Timestamps |

### 4.3 `user_consents` Table
Immutable cryptographic evidence of legal document acceptance and GDPR withdrawal lifecycle.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Consent record ID |
| `user_id` | `TEXT` (FK) | References `users.id` (`ON DELETE CASCADE`) |
| `document_id` | `TEXT` (FK) | References `legal_documents.id` |
| `document_version` | `INTEGER` | Accepted version number |
| `content_hash` | `TEXT` | SHA-256 hash of the exact text accepted by the user |
| `locale` | `TEXT` | Locale in which the user read and accepted the document |
| `source` | `TEXT` | `'registration' \| 'settings' \| 'reconsent'` |
| `ip` | `TEXT` | Client IP at acceptance (cleared upon GDPR anonymization) |
| `user_agent` | `TEXT` | Browser User-Agent at acceptance |
| `accepted_at` | `BIGINT` | Acceptance timestamp |
| `withdrawn_at` | `BIGINT` | Nullable timestamp if user requested consent withdrawal |
| `withdrawal_reason` | `TEXT` | Optional user-supplied reason for withdrawal |
| `withdrawal_status` | `TEXT` | `'none' \| 'pending' \| 'processed' \| 'rejected'` |
| `processed_by` | `TEXT` (FK) | Administrator who processed the withdrawal request |
| `processed_at` | `BIGINT` | Processing timestamp |

---

## 5. OAuth 2.0 / OIDC Identity Provider

| Table | Primary Key | Key Columns & Purpose |
| :--- | :--- | :--- |
| **`oauth_clients`** | `client_id` (`TEXT`) | `secret_hash`, `name`, `description`, `logo_url`, `redirect_uris JSONB`, `allowed_scopes`, `created_by`, `created_at` |
| **`oauth_auth_codes`** | `code` (`TEXT`) | `client_id`, `user_id`, `redirect_uri`, `scopes`, `code_challenge`, `code_challenge_method` (`'S256'`), `nonce`, `auth_time`, `expires_at` (60s TTL), `created_at` |
| **`oauth_consents`** | `(user_id, client_id)` | `scopes`, `granted_at` — persisted user scope authorizations |

---

## 6. Core Infrastructure: Files, Notifications, Telemetry & Outbox

| Table | Primary Key | Key Columns & Purpose |
| :--- | :--- | :--- |
| **`files`** | `id` (`TEXT`) | `storage_key`, `original_name`, `mime_type`, `size_bytes`, `uploaded_by` (`users.id`), `is_public BOOLEAN`, `module_scope`, `created_at` |
| **`notifications`** | `id` (`TEXT`) | `user_id`, `app_id`, `kind`, `title`, `body`, `action_url`, `is_read BOOLEAN`, `created_at` |
| **`audit_logs`** | `id` (`TEXT`) | `actor_id`, `actor_name`, `action`, `module_id`, `target_type`, `target_id`, `target_name`, `before_state JSONB`, `after_state JSONB`, `ip`, `created_at` |
| **`system_logs`** | `id` (`TEXT`) | `timestamp`, `level` (`'INFO' \| 'WARN' \| 'ERROR' \| 'CRITICAL'`), `service`, `message`, `details JSONB`, `user_id`, `ip` |
| **`mail_outbox`** | `id` (`TEXT`) | `target_user_id`, `recipient_email`, `subject`, `encrypted_payload` (AES-256-GCM), `purpose`, `status` (`'pending' \| 'sent' \| 'failed' \| 'rejected'`), `requested_by`, `approved_by`, `error_message`, `created_at`, `updated_at` |

---

## 7. Organizational Units & Kanban Execution

### 7.1 `units` Table (Teams, Squads, Committees, Councils & Guilds)
Unifies working groups (`'squad'`, `'guild'`) and governance decision bodies (`'committee'`, `'council'`).

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Unit ID |
| `slug` | `TEXT` (`UNIQUE`) | URL-safe unit identifier |
| `name` | `TEXT` | Unit display name |
| `description` | `TEXT` | Unit mission and summary |
| `unit_type` | `TEXT` | `'squad' \| 'committee' \| 'council' \| 'guild'` |
| `category` | `TEXT` | Engineering, Research, Governance, Operations, Design, etc. |
| `lead_id` | `TEXT` (FK) | Primary unit lead / chair (`users.id`) |
| `capacity` | `INTEGER` | Maximum member capacity (`0` = unlimited) |
| `join_policy` | `TEXT` | `'open' \| 'approval' \| 'invite_only'` |
| `quorum` | `INTEGER` | Minimum voting quorum required for `'committee'` / `'council'` decisions |
| `repo_url` | `TEXT` | Optional Git repository URL |
| `charter_i18n` | `JSONB` | Localized unit charter (`Record<LocaleCode, string>`) |
| `status` | `TEXT` | `'active' \| 'archived' \| 'completed'` |
| `created_at` | `BIGINT` | Creation timestamp |

### 7.2 `unit_members` Table
Consolidates unit roster, governance voting weights, term limits, and application decision audit trail.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Membership record ID (`UNIQUE (unit_id, user_id)`) |
| `unit_id` | `TEXT` (FK) | References `units.id` (`ON DELETE CASCADE`) |
| `user_id` | `TEXT` (FK) | References `users.id` (`ON DELETE CASCADE`) |
| `role_title` | `TEXT` | e.g., `'Lead'`, `'Chair'`, `'Core Developer'`, `'Researcher'`, `'Rapporteur'` |
| `status` | `TEXT` | `'pending' \| 'active' \| 'rejected' \| 'alumni' \| 'left'` |
| `application_note` | `TEXT` | Candidate's motivation note submitted during application |
| `voting_weight` | `INTEGER` | Voting weight in committee/council polls (`0` = non-voting observer, `1+` = voting member) |
| `term_start`, `term_end` | `BIGINT` | Optional governance term boundaries |
| `decided_by` | `TEXT` (FK) | Unit lead or manager who approved/rejected the application (`users.id`) |
| `decided_at` | `BIGINT` | Decision timestamp |
| `decision_reason` | `TEXT` | Approval or rejection note |
| `joined_at` | `BIGINT` | Timestamp when membership became `'active'` |

### 7.3 `tasks` & `task_comments` Tables (Kanban Engine)

| Table | Column | Type | Description |
| :--- | :--- | :--- | :--- |
| **`tasks`** | `id` | `TEXT` (PK) | Task card ID |
| | `unit_id` | `TEXT` (FK) | References `units.id` (`ON DELETE CASCADE`) |
| | `title`, `description` | `TEXT` | Task title and Markdown description |
| | `status` | `TEXT` | `'todo' \| 'in_progress' \| 'review' \| 'done'` |
| | `priority` | `TEXT` | `'low' \| 'medium' \| 'high' \| 'critical'` |
| | `assignee_id` | `TEXT` (FK) | Assigned member (`users.id`) |
| | `created_by` | `TEXT` (FK) | Author (`users.id`) |
| | `due_at` | `BIGINT` | Optional deadline |
| | `position` | `INTEGER` | Ordering index within the Kanban column |
| | `labels` | `JSONB` | Array of label tags (`[{ id, name, color }]`) |
| | `checklist` | `JSONB` | Embedded sub-task checklist (`[{ id, text, completed, position }]`) |
| | `xp_awarded` | `BOOLEAN` | Prevents duplicate XP payouts when moving cards back and forth |
| | `completed_at`, `created_at`, `updated_at` | `BIGINT` | Lifecycle timestamps |
| **`task_comments`** | `id` | `TEXT` (PK) | Comment ID |
| | `task_id` | `TEXT` (FK) | References `tasks.id` (`ON DELETE CASCADE`) |
| | `user_id` | `TEXT` (FK) | Comment author (`users.id`) |
| | `body` | `TEXT` | Comment text |
| | `created_at`, `updated_at` | `BIGINT` | Timestamps |

---

## 8. Events, Check-In & Cryptographic Certificates

### 8.1 `events` Table

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Event ID |
| `slug` | `TEXT` (`UNIQUE`) | URL-safe event slug |
| `title`, `description` | `TEXT` | Event title and rich description |
| `category` | `TEXT` | `'workshop' \| 'seminar' \| 'hackathon' \| 'meeting' \| 'social' \| 'townhall'` |
| `location` | `TEXT` | Physical venue or live stream URL |
| `starts_at`, `ends_at` | `BIGINT` | Start and end timestamps (UTC epoch ms) |
| `capacity` | `INTEGER` | Maximum attendees (`0` = unlimited) |
| `status` | `TEXT` | `'draft' \| 'published' \| 'completed' \| 'cancelled'` |
| `checkin_open` | `BOOLEAN` | Whether QR / short-code check-in at `/checkin` is currently active |
| `checkin_code` | `TEXT` | 6-digit rotating or static venue check-in code |
| `xp_reward` | `INTEGER` | XP automatically awarded upon verified attendance |
| `unit_id` | `TEXT` (FK) | Organizing unit (`units.id`) |
| `owner_user_id` | `TEXT` (FK) | Responsible event lead (`users.id`) |
| `created_by` | `TEXT` (FK) | Creator (`users.id`) |
| `visibility` | `TEXT` | `'public' \| 'members' \| 'unit'` |
| `created_at` | `BIGINT` | Creation timestamp |

### 8.2 `event_participants` Table
Replaces the legacy dual `event_registrations` + `attendances` tables with a single unified lifecycle table (`UNIQUE (event_id, user_id)`), eliminating `UNION` queries.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Participant record ID |
| `event_id` | `TEXT` (FK) | References `events.id` (`ON DELETE CASCADE`) |
| `user_id` | `TEXT` (FK) | References `users.id` (`ON DELETE CASCADE`) |
| `status` | `TEXT` | `'registered' \| 'waitlisted' \| 'attended' \| 'cancelled'` |
| `checkin_method` | `TEXT` | `'qr' \| 'code' \| 'manual' \| null` |
| `verified_by` | `TEXT` (FK) | Nullable reference to manager who verified attendance (`users.id`) |
| `registered_at` | `BIGINT` | RSVP timestamp |
| `attended_at` | `BIGINT` | Nullable check-in verification timestamp |

### 8.3 `certificates` Table

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Certificate ID |
| `verification_code` | `TEXT` (`UNIQUE`) | Public verification code (e.g., `ORB-2026-X9A-4021`) resolved at `/verify` |
| `user_id` | `TEXT` (FK) | Recipient (`users.id`) |
| `event_id` | `TEXT` (FK) | Optional linked event (`events.id`) |
| `title` | `TEXT` | Certificate title |
| `category` | `TEXT` | `'achievement' \| 'participation' \| 'project' \| 'leadership'` |
| `issued_by` | `TEXT` (FK) | Issuing manager (`users.id`) |
| `pdf_url` | `TEXT` | Optional pre-rendered PDF path |
| `metadata` | `JSONB` | Signatory snapshot and cryptographic verification metadata |
| `issued_at` | `BIGINT` | Issuance timestamp |

---

## 9. Treasury, Projects, Hardware Lab & Governance

### 9.1 `treasury_entries` Table

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Ledger entry ID |
| `entry_type` | `TEXT` | `'income' \| 'expense' \| 'transfer'` |
| `category` | `TEXT` | Sponsorship, Grant, Hardware, Hosting, Event Catering, etc. |
| `description` | `TEXT` | Line-item explanation |
| `amount_minor` | `BIGINT` | Amount in minor currency units (e.g., cents / kuruş) to prevent floating-point drift |
| `currency` | `TEXT` | `'USD' \| 'EUR' \| 'TRY' \| 'USDC' \| 'ETH'` |
| `unit_id` | `TEXT` (FK) | `NULL` = General Community Vault; non-null = Unit Sub-Vault (`units.id`) |
| `transfer_pair_id` | `TEXT` | Links debit and credit rows of an atomic inter-vault transfer |
| `tx_reference` | `TEXT` | Invoice number, bank reference, or on-chain transaction hash |
| `receipt_url` | `TEXT` | Uploaded receipt document (`files.id`) |
| `recorded_by` | `TEXT` (FK) | Treasurer or unit lead (`users.id`) |
| `occurred_at`, `created_at` | `BIGINT` | Transaction date and record creation timestamp |

### 9.2 `projects` Table

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Project ID |
| `slug` | `TEXT` (`UNIQUE`) | URL-safe slug |
| `title`, `summary`, `description` | `TEXT` | Showcase title, short abstract, and full Markdown documentation |
| `repo_url`, `live_url`, `cover_url` | `TEXT` | Repository, live deployment, and cover image URLs |
| `tech_stack` | `JSONB` | Array of technology tags (`string[]`) |
| `unit_id` | `TEXT` (FK) | Owning unit (`units.id`) |
| `owner_user_id` | `TEXT` (FK) | Primary maintainer (`users.id`) |
| `created_by` | `TEXT` (FK) | Creator (`users.id`) |
| `status` | `TEXT` | `'planning' \| 'active' \| 'completed' \| 'archived'` |
| `is_featured` | `BOOLEAN` | Featured showcase highlight flag |
| `starred_user_ids` | `JSONB` | Array of user IDs who starred the project (`string[]`) |
| `star_count` | `INTEGER` | Denormalized star count |
| `visibility` | `TEXT` | `'public' \| 'members'` |
| `created_at`, `updated_at` | `BIGINT` | Timestamps |

### 9.3 `inventory_items` Table

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Asset ID |
| `asset_code` | `TEXT` (`UNIQUE`) | Barcode / inventory tag (e.g., `LAB-RPI-004`) |
| `name`, `category`, `serial_number`, `location` | `TEXT` | Hardware asset identification and storage location |
| `status` | `TEXT` | `'available' \| 'borrowed' \| 'maintenance' \| 'lost'` |
| `holder_user_id` | `TEXT` (FK) | Current borrower (`users.id`, nullable) |
| `borrowed_at`, `due_at` | `BIGINT` | Current loan checkout and return due timestamps |
| `notes` | `TEXT` | Condition and maintenance notes |
| `loan_history` | `JSONB` | Embedded chronological checkout/return ledger (`[{ userId, action, timestamp, actorId, note }]`) |
| `created_at`, `updated_at` | `BIGINT` | Timestamps |

### 9.4 `governance_records` Table
Unifies official board resolutions, committee meeting minutes, and DAO governance proposals.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Governance record ID |
| `reference_no` | `TEXT` (`UNIQUE`) | Sequential resolution/proposal code (e.g., `2026-001` or `OIP-042`), publicly verifiable at `/verify` |
| `record_type` | `TEXT` | `'resolution' \| 'minutes' \| 'proposal' \| 'meeting'` |
| `unit_id` | `TEXT` (FK) | Issuing committee, council, or working group (`units.id`) |
| `title`, `body` | `TEXT` | Official title and Markdown text |
| `agenda` | `JSONB` | Structured agenda items (`string[]`) |
| `status` | `TEXT` | `'draft' \| 'voting' \| 'passed' \| 'rejected' \| 'published' \| 'archived'` |
| `is_public` | `BOOLEAN` | Whether verifiable publicly at `/verify` |
| `is_locked` | `BOOLEAN` | Cryptographic immutability lock once finalized |
| `quorum_required` | `INTEGER` | Minimum votes required |
| `voting_ends_at` | `BIGINT` | Poll closing timestamp for `'proposal'` records |
| `attendees` | `JSONB` | Meeting attendee roster (`[{ userId, name, role, present }]`) |
| `signatures` | `JSONB` | Cryptographic/digital signatory approvals |
| `attachments` | `JSONB` | Attached supporting documents |
| `poll_id` | `TEXT` (FK) | Optional linked governance poll (`polls.id`) |
| `created_by` | `TEXT` (FK) | Author (`users.id`) |
| `decided_at`, `created_at`, `updated_at` | `BIGINT` | Timestamps |

---

## 10. Publishing, Personal Notes, Real-Time Chat & Polls

| Table | Primary Key | Key Columns & Enums |
| :--- | :--- | :--- |
| **`news_posts`** | `id` (`TEXT`) | `slug` (`UNIQUE`), `title`, `summary`, `body`, `category`, `cover_url`, `status` (`'draft' \| 'members_only' \| 'published'`), `is_pinned BOOLEAN`, `unit_id`, `author_id`, `published_at`, `created_at`, `updated_at` |
| **`notes`** | `id` (`TEXT`) | `user_id` (`ON DELETE CASCADE`), `title`, `body`, `color`, `folder_name`, `folder_color`, `tags JSONB`, `is_pinned BOOLEAN`, `is_trashed BOOLEAN`, `created_at`, `updated_at` |
| **`chat_rooms`** | `id` (`TEXT`) | `room_type` (`'channel' \| 'unit' \| 'direct' \| 'mail_thread'`), `unit_id`, `name`, `description`, `is_archived BOOLEAN`, `created_by`, `created_at`, `last_message_at` |
| **`chat_members`** | `(room_id, user_id)` | `folder` (`'inbox' \| 'archive' \| 'trash'`), `is_starred BOOLEAN`, `last_read_at`, `joined_at` |
| **`chat_messages`** | `id` (`TEXT`) | `room_id`, `sender_id`, `reply_to_id`, `poll_id`, `body`, `attachment_url`, `attachment_name`, `attachment_mime`, `attachment_size`, `reactions JSONB`, `edited_at`, `deleted_at`, `created_at` |
| **`polls`** | `id` (`TEXT`) | `scope_type` (`'chat' \| 'governance'`), `scope_id`, `question`, `options JSONB` (`[{ id, text }]`), `votes JSONB` (`Record<userId, optionId[]>`), `allow_multiple BOOLEAN`, `is_anonymous BOOLEAN`, `closes_at`, `closed_at`, `created_by`, `created_at` |

---

## 11. Autonomous Cyber Defense

| Table | Primary Key | Key Columns & Enums |
| :--- | :--- | :--- |
| **`security_blocks`** | `ip` (`TEXT`) | `mode` (`'ban' \| 'whitelist'`), `reason`, `threat_score INT`, `violation_count INT`, `expires_at`, `created_at`, `updated_at` |
| **`security_incidents`** | `id` (`TEXT`) | `incident_type` (`'intrusion' \| 'fim' \| 'honeypot' \| 'brute_force' \| 'anomaly'`), `title`, `severity` (`'low' \| 'medium' \| 'high' \| 'critical'`), `status` (`'open' \| 'investigating' \| 'mitigated' \| 'false_positive'`), `source_ip`, `target_user_id`, `assignee_id`, `evidence JSONB`, `notes`, `created_at`, `resolved_at` |

---

## 12. Visibility & Edit Authority Matrix

| Field Group | Self | Unit Lead | Members Manager (`members: 'manage'`) | Settings Manager (`settings: 'manage'`) | Super-Admin (`role_admin`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `first_name`, `last_name` | Read | Read | Edit | — | Edit |
| `email` | Edit (OTP verified) | — | Edit | — | Edit |
| `handle` | Read | Read | Edit | — | Edit |
| `avatar_url`, `bio`, `links`, `skills` | Edit | Read | Edit | — | Edit |
| `track`, `cohort_level` | Edit* | Read | Edit | Define options | Edit |
| `role_id` | Read | — | Assign** | Define roles | Assign |
| `users.status` | Read | — | Edit | — | Edit |
| `unit_members` | Apply / Leave | Approve / Edit | Edit | — | Edit |
| `users.custom_fields` | Policy-driven | Policy-driven | Policy-driven | Define schema | Edit |
| `user_consents` | Accept / Withdraw | — | Read | Define documents | Read |
| `audit_logs` | — | — | — | Read (via SoC) | Read |

\* Editable by self if `self_editable = true` in `form_schemas`.  
\** Cannot assign or modify a role with higher permissions than the actor's own role; the last active `'role_admin'` is protected by an advisory lock.

---

## 13. Cardinality & Retention Policy

### 13.1 Entity Cardinality
- `users` $\rightarrow$ `roles`: `N : 1` (single primary global role per member)
- `users` $\rightarrow$ `unit_members`: `1 : 0..N` (a member can belong to multiple squads, committees, or guilds)
- `users` $\rightarrow$ `webauthn_credentials`: `1 : 0..5`
- `users` $\rightarrow$ `user_consents`: `1 : N` (one immutable record per accepted `document_id` + `document_version`)
- `units` $\rightarrow$ `tasks`: `1 : 0..N` (checklist items embedded in `tasks.checklist JSONB`)
- `events` $\rightarrow$ `event_participants`: `1 : 0..N` (`UNIQUE (event_id, user_id)`)

### 13.2 Data Retention & GDPR Anonymization
| Data Category | Retention Window | Deletion / Anonymization Strategy |
| :--- | :--- | :--- |
| **Member Account (`users`)** | Active membership + statutory period | **GDPR Anonymization:** scrubs `first_name`, `last_name`, `email`, `handle`, `bio`, `avatar_url`, `custom_fields`, `totp_secret`, `session_token`, and IP telemetry while preserving relational integrity |
| **Legal Consents (`user_consents`)** | Statutory compliance window | Immutable cryptographic proof retained; `ip` and `user_agent` scrubbed on anonymization |
| **Governance Audit (`audit_logs`)** | 730 days (`AUDIT_RETENTION_DAYS`) | Automated daily background pruning (`startAuditMaintenance`) |
| **Verification Tokens (`verification_tokens`)** | 15 minutes – 24 hours | Expired and consumed tokens purged automatically |
| **Units, Projects, Events, Governance** | Permanent institutional archive | Soft-archived (`status = 'archived'`); never hard-deleted |

---

## 14. Relational Index Coverage

Every foreign key and high-selectivity JSONB filter across all **32 tables** is backed by an explicit B-Tree or GIN index created idempotently during `ensurePostgresInit()`:

| Table | Indexed Columns | Index Type & Purpose |
| :--- | :--- | :--- |
| `users` | `email`, `handle`, `role_id`, `status`, `custom_fields` | `UNIQUE` B-Tree on `email`/`handle`; B-Tree on `role_id`/`status`; `GIN` on `custom_fields` |
| `verification_tokens` | `user_id`, `target`, `purpose`, `expires_at` | B-Tree for fast OTP/challenge lookup and TTL cleanup |
| `invitations` | `token_hash`, `invited_by`, `status` | `UNIQUE` on `token_hash`; B-Tree on foreign keys |
| `user_consents` | `(user_id, document_id, document_version)` | Composite B-Tree for instant consent verification |
| `units` & `unit_members` | `lead_id`, `unit_type`, `(unit_id, user_id)`, `status` | Eliminates sequential scans on unit rosters and committee quorums |
| `tasks` & `task_comments` | `unit_id`, `assignee_id`, `status`, `task_id` | Optimizes Kanban board loading and comment threads |
| `events` & `event_participants` | `starts_at`, `status`, `(event_id, user_id)`, `user_id` | Supports O(1) capacity locking and member attendance counts |
| `certificates` | `verification_code`, `user_id`, `event_id` | `UNIQUE` on `verification_code` for public `/verify` lookups |
| `treasury_entries` | `unit_id`, `occurred_at`, `transfer_pair_id`, `recorded_by` | Accelerates vault balance aggregation and transfer pairing |
| `projects` & `inventory_items` | `unit_id`, `created_by`, `holder_user_id`, `asset_code` | Covers showcase filtering and hardware loan tracking |
| `governance_records` | `reference_no`, `unit_id`, `record_type`, `status` | `UNIQUE` on `reference_no`; fast committee resolution queries |
| `chat_rooms`, `chat_members`, `chat_messages` | `unit_id`, `user_id`, `(room_id, created_at DESC)`, `sender_id` | Supports cursor-paginated real-time messaging |
| `audit_logs` & `system_logs` | `created_at DESC`, `actor_id`, `module_id`, `timestamp DESC` | High-throughput SIEM histogram and forensic timeline queries |
