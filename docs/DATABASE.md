# Orbit Community OS — Database Architecture & 32-Table Schema Reference (v3.0)

**Orbit Community OS** by **tetha42** uses **PostgreSQL 16** as its single, authoritative transactional data store and real-time event broker (`LISTEN/NOTIFY`). Rather than hiding SQL behind a heavy runtime ORM, Orbit pairs a type-safe domain repository architecture (`src/db/schema.ts` and `src/db/repositories/*.repo.ts`) with parameterized PostgreSQL queries (`pg`), strategic **PostgreSQL 16 `JSONB` optimizations**, transactional advisory locks, and **Zero-Config dynamic runtime pool reconfiguration (`reconfigurePgPool`)**.

---

## Table of Contents

1. [Database Engine & Connection Architecture](#1-database-engine--connection-architecture)
2. [Zero-Config Dynamic Runtime Pool Reconfiguration (`reconfigurePgPool`)](#2-zero-config-dynamic-runtime-pool-reconfiguration-reconfigurepgpool)
3. [Automatic `snake_case` $\rightarrow$ `camelCase` Row Mapping](#3-automatic-snake_case--camelcase-row-mapping)
4. [PostgreSQL 16 `JSONB` Optimizations](#4-postgresql-16-jsonb-optimizations)
5. [Consolidated 32-Table English Schema Reference](#5-consolidated-32-table-english-schema-reference)
6. [Domain Repository Layer (`src/db/repositories/*.repo.ts`)](#6-domain-repository-layer-srcdbrepositoriesrepots)
7. [Concurrency Control, Advisory Locks & Row-Level Locking](#7-concurrency-control-advisory-locks--row-level-locking)
8. [Idempotent Startup Initialization (`ensurePostgresInit`)](#8-idempotent-startup-initialization-ensurepostgresinit)
9. [Backup, Restore & Disaster Recovery Flows](#9-backup-restore--disaster-recovery-flows)

---

## 1. Database Engine & Connection Architecture

- **PostgreSQL 16 Only:** PostgreSQL is the sole persistence and real-time messaging engine (`src/db/index.ts`).
- **64-Bit Integer Timestamps (`BIGINT`):** All timestamps across all 32 tables are stored as UTC epoch milliseconds in `BIGINT` (`INT8`) columns and automatically parsed into JavaScript `number` primitives via:
  ```ts
  types.setTypeParser(types.builtins.INT8, (val: string) => parseInt(val, 10));
  ```
- **Connection Pooling (`getPgPool`):** Managed via a singleton `pg.Pool` attached to `globalThis.__pgPool` (`max` defaults to `30` connections, configurable up to `100` via `DATABASE_POOL_MAX` to support 150+ concurrent real-time chat and workspace users while leaving headroom for `LISTEN/NOTIFY` channels).

---

## 2. Zero-Config Dynamic Runtime Pool Reconfiguration (`reconfigurePgPool`)

In traditional applications, changing the database URL requires editing `.env` files and restarting containers. Orbit Community OS supports **live, zero-downtime pool hot-swapping** straight from the **Web UI Setup Wizard (`/setup`)**:

```ts
export async function reconfigurePgPool(url: string): Promise<{ ok: boolean; error?: string }> {
	const test = await testPostgresConnection(url);
	if (!test.ok) return test;

	if (globalForPg.__pgPool) {
		await globalForPg.__pgPool.end().catch(() => {});
		globalForPg.__pgPool = undefined;
	}
	process.env.DATABASE_URL = url.trim();
	CONFIG.database.url = url.trim();
	isInitialized = false;
	initPromise = null;
	await ensurePostgresInit();
	return { ok: true };
}
```

### Lifecycle During First-Run Onboarding
1. **`checkDatabaseStatus()` & `getSetupStatus()`:** Non-crashing probes called by `GET /api/setup`. If no database is configured yet, the server cleanly reports `{ ready: false, firstRun: true, step: 'database' }` so the browser can render Step 1 of `/setup`.
2. **Auto Database Detection (`GET /api/setup/auto-detect`):** Concurrently probes standard PostgreSQL ports on `localhost:5432`, Docker Compose services, and container network aliases (`orbit-db`). Discovered instances can be selected with a single click.
3. **Docker Quickstart:** If no database is detected, the Setup Wizard displays a 1-click Docker run command to spin up PostgreSQL 16 on the host in seconds:
   ```bash
   docker run --name orbit-postgres -e POSTGRES_DB=orbit -e POSTGRES_USER=orbit -e POSTGRES_PASSWORD=<your-password> -p 127.0.0.1:5432:5432 -d postgres:16-alpine
   ```
4. **`testPostgresConnection(url)`:** Spins up an isolated 1-connection pool (`SELECT 1`) with a 4-second timeout to verify credentials before mutating server state.
5. **`reconfigurePgPool(url)`:** Gracefully drains any existing pool, updates the in-memory runtime configuration, resets initialization flags, and runs `ensurePostgresInit()` to provision all 32 database tables and system roles immediately.

---

## 3. Automatic `snake_case` $\rightarrow$ `camelCase` Row Mapping

All 32 database tables and columns in Orbit v3.0 follow strict, pure English **`snake_case`** naming (`first_name`, `cohort_level`, `amount_minor`, `transfer_pair_id`, `require_2fa`, `created_at`), while TypeScript interfaces in `src/db/schema.ts` use idiomatic **`camelCase`** (`firstName`, `cohortLevel`, `amountMinor`, `transferPairId`, `require2fa`, `createdAt`).

To provide seamless ergonomics without requiring column aliases in SQL queries or maintaining legacy lookup dictionaries, `getPgPool()` and `withTransaction()` wrap `client.query` with a pure algorithmic `mapRow()` transformer:
- Every `snake_case` column identifier returned by PostgreSQL is deterministically converted into `camelCase` (`key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())`).
- Zero custom column-mapping arrays are needed at runtime.

---

## 4. PostgreSQL 16 `JSONB` Optimizations

Orbit v3.0 eliminates expensive multi-table `LEFT JOIN` chains and Entity-Attribute-Value (EAV) anti-patterns by leveraging native PostgreSQL 16 `JSONB` columns with GIN indexing where appropriate:

| `JSONB` Column | Host Table | Architectural Benefit |
| :--- | :--- | :--- |
| **`permissions JSONB`** | `roles` | Stores `Record<AppId, 'none' \| 'use' \| 'manage'>` directly on the role row, enabling atomic single-query RBAC reads and updates without joining a separate permissions table. |
| **`checklist JSONB` & `labels JSONB`** | `tasks` | Embeds sub-task checklist items (`[{ id, text, completed, position }]`) and labels inside the Kanban card row so entire boards load in a single query. |
| **`custom_fields JSONB`** | `users` | Replaces EAV tables with a GIN-indexed `JSONB` map validated against `form_schemas`, supporting arbitrary archetype-specific fields with zero schema migrations. |
| **`workspace_state JSONB`** | `users` | Persists cloud-roaming desktop preferences (wallpaper, window coordinates, pinned Dock apps, audio/brightness) directly on the user record. |
| **`translations JSONB`** | `form_schemas`, `legal_documents`, `roles`, `organization_settings` | Stores localized content maps (`Record<LocaleCode, Record<string, string>>`), allowing new languages to be contributed in a single PR without `ALTER TABLE` statements. |
| **`options JSONB` & `votes JSONB`** | `polls` | Consolidates poll choices and user votes for both real-time chat polls and formal governance proposals. |

---

## 5. Consolidated 32-Table English Schema Reference

All tables use pure English `snake_case` identifiers and English status enums (`'pending' | 'active' | 'suspended' | 'alumni' | 'rejected'`, permission levels `'none' | 'use' | 'manage'`, etc.). For field-level privacy and edit rules, see **[`docs/DATA_DICTIONARY.md`](DATA_DICTIONARY.md)**.

### 5.1 Core Identity, RBAC, Forms, Legal & Organization Layer (9 Tables)

| # | Table Name | Primary Key | Description & Key Columns |
| :--- | :--- | :--- | :--- |
| 1 | **`organization_settings`** | `id` (`'default'`) | Organization archetype (`'academic_club' \| 'dao_collective' \| 'research_lab' \| 'professional_guild'`), `slug`, `name`, `tagline_i18n JSONB`, `description_i18n JSONB`, `parent_entity`, `domain`, `logo_url`, `theme_config JSONB`, `wallpapers JSONB`, `signatories JSONB`, `membership_policy JSONB`, `smtp_config JSONB` (AES-256-GCM), `security_policy JSONB`, `default_role_id`, `updated_at` |
| 2 | **`users`** | `id` (`TEXT`) | Core member identity, auth & state: `email` (`UNIQUE`), `email_verified_at`, `password_hash`, `must_change_password`, `first_name`, `last_name`, `display_name`, `handle` (`UNIQUE`), `avatar_url`, `bio`, `track`, `cohort_level`, `skills JSONB`, `links JSONB`, `custom_fields JSONB`, `role_id`, `status` (`'pending' \| 'active' \| 'suspended' \| 'alumni' \| 'rejected'`), `xp`, `locale`, `timezone`, `directory_visibility`, `workspace_state JSONB`, `notification_prefs JSONB`, `auth_method`, `totp_secret`, `totp_enabled`, `totp_recovery_codes JSONB`, `totp_last_step`, `session_token` (SHA-256), `session_expires_at`, `last_login_ip`, `created_at`, `updated_at` |
| 3 | **`roles`** | `id` (`TEXT`) | Dynamic RBAC roles (`'role_admin'`, `'role_board'`, `'role_member'`, `'role_alumni'`): `slug`, `translations JSONB`, `color`, `permissions JSONB` (`Record<AppId, 'none' \| 'use' \| 'manage'>`), `is_system`, `is_default`, `require_2fa`, `rank`, `created_at` |
| 4 | **`webauthn_credentials`** | `id` (`TEXT`) | Registered FIDO2 / WebAuthn Passkeys: `user_id`, `public_key` (COSE), `counter`, `transports JSONB`, `device_type`, `backed_up`, `nickname`, `created_at`, `last_used_at` |
| 5 | **`verification_tokens`** | `id` (`TEXT`) | Ephemeral OTP & challenge store: `user_id`, `target`, `purpose` (`'signup_otp' \| 'password_reset' \| 'email_change' \| 'webauthn_reg' \| 'webauthn_auth'`), `token_hash` (SHA-256), `metadata JSONB`, `attempts`, `expires_at`, `consumed_at`, `created_ip`, `created_at` |
| 6 | **`invitations`** | `id` (`TEXT`) | Single-use cryptographic invitations: `token_hash` (`UNIQUE`), `email`, `first_name`, `last_name`, `handle`, `track`, `cohort_level`, `role_id`, `unit_id`, `status` (`'pending' \| 'accepted' \| 'expired' \| 'revoked'`), `invited_by`, `accepted_by`, `custom_fields JSONB`, `expires_at`, `accepted_at`, `created_at` |
| 7 | **`form_schemas`** | `field_key` (`TEXT`) | Dynamic registration & profile field schemas: `is_core`, `field_type`, `translations JSONB`, `options JSONB`, `collect_at`, `required_at`, `visibility`, `self_editable`, `admin_editable`, `is_sensitive`, `sort_order`, `is_active`, `created_at`, `updated_at` |
| 8 | **`legal_documents`** | `id` (`TEXT`) | Versioned legal documents: `slug` (`UNIQUE`), `scope`, `current_version`, `content_hash`, `is_required`, `reconsent_required`, `is_active`, `translations JSONB`, `version_history JSONB`, `published_at`, `updated_at` |
| 9 | **`user_consents`** | `id` (`TEXT`) | Immutable cryptographic consent ledger: `user_id`, `document_id`, `document_version`, `content_hash`, `locale`, `source` (`'registration' \| 'settings' \| 'reconsent'`), `ip`, `user_agent`, `accepted_at`, `withdrawn_at`, `withdrawal_reason`, `withdrawal_status`, `processed_by`, `processed_at` |

### 5.2 OAuth 2.0 & OpenID Connect Provider Layer (3 Tables)

| # | Table Name | Primary Key | Description & Key Columns |
| :--- | :--- | :--- | :--- |
| 10 | **`oauth_clients`** | `client_id` (`TEXT`) | Registered OAuth 2.0 applications: `secret_hash`, `name`, `description`, `logo_url`, `redirect_uris JSONB`, `allowed_scopes`, `created_by`, `created_at` |
| 11 | **`oauth_auth_codes`** | `code` (`TEXT`) | Short-lived (60s), single-use authorization codes with PKCE `code_challenge` and `code_challenge_method` (`'S256'`), `user_id`, `client_id`, `scopes`, `nonce`, `expires_at` |
| 12 | **`oauth_consents`** | `(user_id, client_id)` | Persisted user scope grants (`scopes`, `granted_at`) |

### 5.3 Core Infrastructure: Files, Notifications, Audit, Telemetry & Mail Outbox (5 Tables)

| # | Table Name | Primary Key | Description & Key Columns |
| :--- | :--- | :--- | :--- |
| 13 | **`files`** | `id` (`TEXT`) | Uploaded blob metadata and access control: `storage_key`, `original_name`, `mime_type`, `size_bytes`, `uploaded_by`, `is_public`, `module_scope`, `created_at` |
| 14 | **`notifications`** | `id` (`TEXT`) | 4-tier notification inbox: `user_id`, `app_id`, `kind`, `title`, `body`, `action_url`, `is_read`, `created_at` |
| 15 | **`audit_logs`** | `id` (`TEXT`) | Immutable transactional governance & mutation audit trail: `actor_id`, `actor_name`, `action`, `module_id`, `target_type`, `target_id`, `target_name`, `before_state JSONB`, `after_state JSONB`, `ip`, `created_at` |
| 16 | **`system_logs`** | `id` (`TEXT`) | High-throughput SIEM & operational telemetry: `timestamp`, `level` (`'INFO' \| 'WARN' \| 'ERROR' \| 'CRITICAL'`), `service`, `message`, `details JSONB`, `user_id`, `ip` |
| 17 | **`mail_outbox`** | `id` (`TEXT`) | Transactional email fallback queue when SMTP is offline: `target_user_id`, `recipient_email`, `subject`, `encrypted_payload` (AES-256-GCM), `purpose`, `status` (`'pending' \| 'sent' \| 'failed' \| 'rejected'`), `requested_by`, `approved_by`, `created_at`, `updated_at` |

### 5.4 Isolated Mini-App Domain Tables (15 Tables)

| # | Table Name | Owning Module | Description & Key Columns |
| :--- | :--- | :--- | :--- |
| 18 | **`units`** | `teams` / `decisions` | Execution squads, guilds, committees & councils: `id`, `slug`, `name`, `description`, `unit_type` (`'squad' \| 'committee' \| 'council' \| 'guild'`), `category`, `lead_id`, `capacity`, `join_policy` (`'open' \| 'approval' \| 'invite_only'`), `quorum`, `repo_url`, `charter_i18n JSONB`, `status` (`'active' \| 'archived' \| 'completed'`), `created_at` |
| 19 | **`unit_members`** | `teams` / `decisions` | Unit roster, applications & voting weights: `id`, `unit_id`, `user_id`, `role_title`, `status` (`'pending' \| 'active' \| 'rejected' \| 'alumni' \| 'left'`), `application_note`, `voting_weight`, `term_start`, `term_end`, `decided_by`, `decided_at`, `decision_reason`, `joined_at` |
| 20 | **`tasks`** | `teams` | Multi-column Kanban cards: `id`, `unit_id`, `title`, `description`, `status` (`'todo' \| 'in_progress' \| 'review' \| 'done'`), `priority` (`'low' \| 'medium' \| 'high' \| 'critical'`), `assignee_id`, `created_by`, `due_at`, `position`, `labels JSONB`, `checklist JSONB`, `xp_awarded`, `completed_at`, `created_at`, `updated_at` |
| 21 | **`task_comments`** | `teams` | Task discussion threads: `id`, `task_id`, `user_id`, `body`, `created_at`, `updated_at` |
| 22 | **`events`** | `events` | Community events: `id`, `slug`, `title`, `description`, `category` (`'workshop' \| 'seminar' \| 'hackathon' \| 'meeting' \| 'social' \| 'townhall'`), `location`, `starts_at`, `ends_at`, `capacity`, `status` (`'draft' \| 'published' \| 'completed' \| 'cancelled'`), `checkin_open`, `checkin_code`, `xp_reward`, `unit_id`, `owner_user_id`, `created_by`, `visibility`, `created_at` |
| 23 | **`event_participants`** | `events` | Unified RSVP & verified attendance ledger (`UNIQUE (event_id, user_id)`): `id`, `event_id`, `user_id`, `status` (`'registered' \| 'waitlisted' \| 'attended' \| 'cancelled'`), `checkin_method` (`'qr' \| 'code' \| 'manual'`), `verified_by`, `registered_at`, `attended_at` |
| 24 | **`certificates`** | `certificates` | Cryptographic certificates: `id`, `verification_code` (`UNIQUE`), `user_id`, `event_id`, `title`, `category`, `issued_by`, `pdf_url`, `metadata JSONB`, `issued_at` |
| 25 | **`treasury_entries`** | `budget` | Community & unit treasury ledger: `id`, `entry_type` (`'income' \| 'expense' \| 'transfer'`), `category`, `description`, `amount_minor` (`BIGINT`), `currency` (`'USD' \| 'EUR' \| 'TRY' \| 'USDC' \| 'ETH'`), `unit_id` (`NULL` = general vault), `transfer_pair_id`, `tx_reference`, `receipt_url`, `recorded_by`, `occurred_at`, `created_at` |
| 26 | **`projects`** | `projects` | R&D project showcase: `id`, `slug`, `title`, `summary`, `description`, `repo_url`, `live_url`, `cover_url`, `tech_stack JSONB`, `unit_id`, `owner_user_id`, `created_by`, `status` (`'planning' \| 'active' \| 'completed' \| 'archived'`), `is_featured`, `starred_user_ids JSONB`, `star_count`, `visibility`, `created_at`, `updated_at` |
| 27 | **`inventory_items`** | `inventory` | Hardware lab assets & loan ledger: `id`, `asset_code` (`UNIQUE`), `name`, `category`, `serial_number`, `location`, `status` (`'available' \| 'borrowed' \| 'maintenance' \| 'lost'`), `holder_user_id`, `borrowed_at`, `due_at`, `notes`, `loan_history JSONB`, `created_at`, `updated_at` |
| 28 | **`governance_records`** | `decisions` | Official resolutions, minutes & proposals: `id`, `reference_no` (`UNIQUE`), `record_type` (`'resolution' \| 'minutes' \| 'proposal' \| 'meeting'`), `unit_id`, `title`, `agenda JSONB`, `body`, `status` (`'draft' \| 'voting' \| 'passed' \| 'rejected' \| 'published' \| 'archived'`), `is_public`, `is_locked`, `quorum_required`, `voting_ends_at`, `attendees JSONB`, `signatures JSONB`, `attachments JSONB`, `poll_id`, `created_by`, `decided_at`, `created_at`, `updated_at` |
| 29 | **`news_posts`** | `news` | Community publishing & syndication: `id`, `slug`, `title`, `summary`, `body`, `category`, `cover_url`, `status` (`'draft' \| 'members_only' \| 'published'`), `is_pinned`, `unit_id`, `author_id`, `published_at`, `created_at`, `updated_at` |
| 30 | **`notes`** | `notes` | Personal member workspace notes: `id`, `user_id`, `title`, `body`, `color`, `folder_name`, `folder_color`, `tags JSONB`, `is_pinned`, `is_trashed`, `created_at`, `updated_at` |
| 31 | **`chat_rooms`**, **`chat_members`**, **`chat_messages`**, **`polls`** | `chat` / `mail` / `decisions` | Real-time channels, unit rooms, DMs, internal mail threads (`room_type: 'channel' \| 'unit' \| 'direct' \| 'mail_thread'`), read cursors (`last_read_at`), messages, and shared interactive `polls` (`scope_type: 'chat' \| 'governance'`) |
| 32 | **`security_blocks`**, **`security_incidents`** | `soc` | Automated WAF / Canary IP quarantines (`ip`, `mode: 'ban' \| 'whitelist'`, `threat_score`, `expires_at`) and SOAR security case files (`incident_type`, `severity`, `status`, `evidence JSONB`) |

---

## 6. Domain Repository Layer (`src/db/repositories/*.repo.ts`)

All SQL queries are encapsulated inside modular repositories in `src/db/repositories/` and re-exported through `src/db/index.ts`:

- `auth.repo.ts` & `users.repo.ts` — Session verification, password updates, TOTP & WebAuthn persistence (`verification_tokens`, `webauthn_credentials`).
- `security.repo.ts` & `logs.repo.ts` — WAF strikes, IP quarantine (`security_blocks`), SIEM telemetry (`system_logs`), and SoC incidents (`security_incidents`).
- `inspection.repo.ts` — Zero-Trust DB Studio introspection, table schemas, and sandboxed query execution.
- `members.repo.ts` & `membership.repo.ts` — Member roster (`MEMBER_ROSTER_SQL`), profile updates, invitations, and application approvals.
- `teams.repo.ts`, `committees.repo.ts` & `kanban.repo.ts` — Organizational `units`, `unit_members`, Kanban `tasks` (`checklist JSONB`), and atomic XP awards.
- `events.repo.ts` & `certificates.repo.ts` — Event lifecycles, capacity-locked `event_participants`, QR check-in, and cryptographic `certificates`.
- `budget.repo.ts` & `files.repo.ts` — Advisory-locked `treasury_entries`, inter-vault transfers (`transfer_pair_id`), and receipt ownership.
- `chat.repo.ts`, `mail.repo.ts`, `mailGroups.repo.ts` & `mailOutbox.repo.ts` — Real-time `chat_rooms`, `polls`, unread cursors, recipient groups, and encrypted `mail_outbox`.
- `projects.repo.ts`, `inventory.repo.ts`, `decisions.repo.ts`, `news.repo.ts`, `notes.repo.ts`, `settings.repo.ts`, `customization.repo.ts`, `privacy.repo.ts`, `workspacePreferences.repo.ts`, `notifications.repo.ts`, `terminal.repo.ts`.

---

## 7. Concurrency Control, Advisory Locks & Row-Level Locking

Orbit never performs unsafe "read-then-write" application-level checks on contested resources. Every concurrent mutation uses PostgreSQL transactional primitives via `withTransaction(fn)`:

| Contested Resource | PostgreSQL Locking Mechanism | Guarantee |
| :--- | :--- | :--- |
| **First-Run Admin Setup** | `pg_advisory_xact_lock(hashtext('setup.first_admin'))` | Prevents concurrent `/api/setup` requests from creating duplicate bootstrap admins |
| **Last-Admin Protection** | `pg_advisory_xact_lock(hashtext('roles.admin'))` | Serializes role changes so two admins cannot simultaneously demote each other (`409 LAST_ADMIN_PROTECTED`) |
| **Treasury Balances & Transfers** | `pg_advisory_xact_lock(hashtext('vault:<unitId\|general>'))` | Serializes balance checks and expense writes; inter-vault transfers lock both vaults in deterministic alphabetical order to prevent deadlocks |
| **Governance Reference Numbers** | `pg_advisory_xact_lock(hashtext('governance_records.reference_no'))` | Generates strictly sequential `YYYY-NNN` resolution numbers without gaps or collisions |
| **Event & Unit Capacity** | `SELECT ... FROM events WHERE id = $1 FOR UPDATE` | Locks the parent event or unit row while counting active participants before inserting a registration |
| **Hardware Asset Checkout** | `UPDATE inventory_items SET status = 'borrowed' ... WHERE id = $1 AND status = 'available' RETURNING id` | Atomic compare-and-swap ensures two members cannot borrow the same lab item simultaneously |

---

## 8. Idempotent Startup Initialization (`ensurePostgresInit`)

Orbit requires no external migration CLI (`prisma migrate` or `flyway`) to deploy or upgrade:

1. On the first database call (or immediately after `reconfigurePgPool` in `/setup`), `ensurePostgresInit()` acquires `pg_advisory_xact_lock(hashtext('orbit.schema_init'))` so multiple server workers starting concurrently never race.
2. `src/db/schema.init.ts` executes declarative, idempotent `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements across all **32 tables**.
3. Full unconditional B-Tree and GIN indexes cover 100% of foreign keys and JSONB filter paths, eliminating sequential scan and cascade lock contention hazards.
4. Core seeding functions verify system roles (`'role_admin'`, `'role_board'`, `'role_member'`, `'role_alumni'`) and default `organization_settings`.

---

## 9. Backup, Restore & Disaster Recovery Flows

### Automated & Manual SQL Backups (`make db-backup`)
Orbit includes a production backup script (`infra/scripts/db-backup.sh`) invoked via:
```bash
make db-backup
```
This runs `pg_dump` inside the `orbit-db` container (or against your configured PostgreSQL instance) and writes a timestamped SQL snapshot to `./backups/orbit_backup_<YYYYMMDD_HHMMSS>.sql`.

### Restoring from a Snapshot
```bash
# Restore into the running Docker PostgreSQL container
cat backups/orbit_backup_20261103_120000.sql | docker exec -i orbit-db psql -U orbit -d orbit
```

### Resetting a Development Database (`make db-reset`)
To wipe all tables and volumes and return the instance to a fresh Zero-Config `/setup` state:
```bash
make db-reset
```
