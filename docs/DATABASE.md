# Orbit Community OS — Database Architecture & Schema Reference

**Orbit Community OS** by **tetha42** uses **PostgreSQL 16** as its single, authoritative transactional data store and real-time event broker. Rather than hiding SQL behind a heavy runtime abstraction, Orbit pairs a type-safe, Drizzle-compatible domain repository architecture (`src/db/schema.ts` and `src/server/db/domains/*.repo.ts`) with raw parameterized PostgreSQL queries (`pg`), transactional advisory locks, and **Zero-Config dynamic runtime pool reconfiguration (`reconfigurePgPool`)**.

---

## Table of Contents

1. [Database Engine & Connection Architecture](#1-database-engine--connection-architecture)
2. [Zero-Config Dynamic Runtime Pool Reconfiguration (`reconfigurePgPool`)](#2-zero-config-dynamic-runtime-pool-reconfiguration-reconfigurepgpool)
3. [Identifier Casing & The `CAMEL_CASE_COLUMNS` Mapper](#3-identifier-casing--the-camel_case_columns-mapper)
4. [Complete 45-Table Schema Reference](#4-complete-45-table-schema-reference)
5. [Domain Repository Layer (`src/server/db/domains/*.repo.ts`)](#5-domain-repository-layer-srcserverdbdomainsrepots)
6. [Concurrency Control, Advisory Locks & Row-Level Locking](#6-concurrency-control-advisory-locks--row-level-locking)
7. [Idempotent Startup Migrations (`ensurePostgresInit`)](#7-idempotent-startup-migrations-ensurepostgresinit)
8. [Backup, Restore & Disaster Recovery Flows](#8-backup-restore--disaster-recovery-flows)

---

## 1. Database Engine & Connection Architecture

- **PostgreSQL 16 Only:** PostgreSQL is the sole persistence engine (`src/db/index.ts`).
- **64-Bit Integer Timestamps (`BIGINT`):** All timestamps across all 45 tables are stored as UTC epoch milliseconds in `BIGINT` (`INT8`) columns and automatically parsed into JavaScript `number` primitives via:
  ```ts
  types.setTypeParser(types.builtins.INT8, (val: string) => parseInt(val, 10));
  ```
- **Connection Pooling (`getPgPool`):** Managed via a singleton `pg.Pool` attached to `globalThis.__pgPool` (`max` defaults to `30` connections, configurable up to `100` to support 150+ concurrent real-time chat and workspace users while leaving headroom for `LISTEN/NOTIFY` channels).

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
1. **`checkDatabaseStatus()`:** Non-crashing probe called by `GET /api/setup`. If no database is configured yet, it cleanly reports `{ connected: false, configured: false }` so the browser can render Step 1 of `/setup`.
2. **Auto Database Detection (`GET /api/setup/auto-detect`):** Concurrently probes standard PostgreSQL ports on `localhost:5432`, Docker Compose services, and container network aliases (`orbit-db`). Discovered instances can be selected with a single click.
3. **Docker Quickstart:** If no database is detected, the Setup Wizard displays a 1-click Docker run command to spin up PostgreSQL 16 on the host in seconds:
   ```bash
   docker run --name orbit-postgres -e POSTGRES_DB=orbit -e POSTGRES_USER=orbit -e POSTGRES_PASSWORD=orbit_secret_2026 -p 5432:5432 -d postgres:16-alpine
   ```
4. **`testPostgresConnection(url)`:** Spins up an isolated 1-connection pool (`SELECT 1`) with a 4-second timeout to verify credentials before mutating server state.
5. **`reconfigurePgPool(url)`:** Gracefully drains any existing pool, updates the in-memory runtime configuration, resets initialization flags, and runs `ensurePostgresInit()` to provision all database tables and system roles immediately.

---

## 3. Identifier Casing & The `CAMEL_CASE_COLUMNS` Mapper

PostgreSQL folds unquoted SQL column identifiers to lowercase, whereas TypeScript domain interfaces in `src/db/schema.ts` use `camelCase`.

To ensure seamless ergonomics without requiring quotes around every column in every `SELECT` query, `getPgPool()` and `withTransaction()` wrap `client.query` with `mapRow()`, which:
1. Automatically translates standard snake_case column names (`first_name`, `created_at`, `password_hash`, `role_id`) into `camelCase` (`firstName`, `createdAt`, `passwordHash`, `roleId`).
2. Maps legacy unquoted column names back to their canonical `camelCase` TypeScript property names using `CAMEL_CASE_COLUMNS` (`src/db/index.ts`).

---

## 4. Complete Schema Reference: English Base Tables & Legacy Views

In Orbit Community OS, all foundational database tables and columns are defined natively in **English**. For zero-friction compatibility, PostgreSQL updatable views (`kullanicilar`, `roller`, `takimlar`, `guvenlik_engelleri`, `sistem_ayarlari`, etc.) map 1-to-1 to the base tables.

### 4.1 Identity, Authentication, RBAC & System Settings (8 Tables)
| Base Table Name | Legacy View | Description & Key Columns |
| :--- | :--- | :--- |
| `users` | `kullanicilar` | Core member accounts: `id`, `first_name`, `last_name`, `email` (`UNIQUE`), `password_hash`, `handle` (Global Member ID), `department`, `grade`, `role_id`, `xp`, `status` (`aktif`, `beklemede`, `reddedildi`, `mezun`), `session_token` (SHA-256), `session_expires_at`, `last_login_ip`, `totp_secret`, `totp_enabled`, `totp_recovery_codes`, `totp_last_step` |
| `roles` | `roller` | Dynamic RBAC role definitions: `id`, `name`, `color`, `description`, `is_system` (`1` for immutable `rol_admin`), `require_2fa` (`1` enforces mandatory 2FA), `created_at` |
| `role_permissions` | `rol_izinleri` | Per-app permission matrix: maps `role_id` and `app_id` to permission level (`level`: `kullan` or `yonet`) |
| `webauthn_credentials` | — | Registered FIDO2 / WebAuthn Passkeys: `id`, `kullaniciId`, `publicKey` (COSE), `counter` (clone detection), `transports`, `deviceType`, `backedUp`, `nickname` |
| `webauthn_challenges` | — | Ephemeral cryptographic challenges (`id`, `challenge`, `type`: `kayit` \| `giris`) |
| `email_verifications` | `eposta_dogrulama` | Verification & password-reset tokens with expiration timestamps: `email`, `code`, `type`, `expires_at`, `created_at` |
| `system_settings` | `sistem_ayarlari` | Key-value configuration store: Studio entity (`universite` = `tetha42`), Community name (`kulup_adi` = `Orbit Community`), Domain (`kulup_domain`), AES-256-GCM encrypted SMTP settings (`smtp_*`), default member role (`varsayilan_rol_id`) |
| `schema_migrations` | — | Ledger of executed one-time data migrations (`runMigrationStep`) |

### 4.2 Security, Autonomous Defense & Audit Logs (3 Tables)
| Base Table Name | Legacy View | Description & Key Columns |
| :--- | :--- | :--- |
| `security_blocks` | `guvenlik_engelleri` | Automated WAF / IPS quarantine ledger: `ip`, `status` (`ban` / `whitelist`), `reason`, `threat_score`, `violations`, `expires_at`, `created_at`, `updated_at` |
| `system_logs` | `sistem_loglari` | High-throughput system and security telemetry: `id`, `timestamp`, `level`, `service`, `message`, `details` (`JSONB`), `user_id`, `ip` |
| `audit_logs` | `denetim_kaydi` | Immutable governance and administrative audit trail: `id`, `timestamp`, `actor_id`, `actor_name`, `action`, `target_type`, `target_id`, `target_name`, `before`, `after`, `ip` |

### 4.2 OAuth 2.0 & OpenID Connect Provider (3 Tables)
| Table Name | Primary Key | Description & Key Columns |
| :--- | :--- | :--- |
| `oauth_clients` | `clientId` (`TEXT`) | Registered third-party OAuth 2.0 applications: `secretHash`, `ad`, `aciklama`, `redirectUris` (JSON), `allowedScopes`, `olusturanId` |
| `oauth_auth_codes` | `code` (`TEXT`) | Short-lived (60s), single-use authorization codes with PKCE `codeChallenge` and `codeChallengeMethod` (`S256`) |
| `oauth_consents` | `(kullaniciId, clientId)` | Persisted user scope grants (`scopes`, `onayTarihi`) |

### 4.3 Autonomous SoC, SIEM, WAF & Governance Audit (4 Tables)
| Table Name | Primary Key | Description & Key Columns |
| :--- | :--- | :--- |
| `sistem_loglari` | `id` (`TEXT`) | High-volume SIEM telemetry log store: `servis`, `seviye` (`INFO`, `WARN`, `ERROR`, `CRITICAL`), `mesaj`, `detay` (JSONB), `ip`, `kullaniciId`, `zaman` |
| `soc_incidents` | `id` (`TEXT`) | Security incidents and SOAR case files: `baslik`, `kategori`, `ciddiyet`, `durum`, `kaynakIp`, `hedefKullaniciId`, `atananId`, `notlar` |
| `guvenlik_engelleri` | `ip` (`TEXT`) | Active WAF & Canary honeypot IP quarantines: `sebep`, `tehditPuani`, `bitisTarihi`, `olusturma` |
| `denetim_kaydi` | `id` (`TEXT`) | Immutable transactional governance audit trail: `yapanId`, `yapanAd`, `islem`, `hedefTur`, `hedefId`, `hedefAd`, `onceki` (JSONB), `sonraki` (JSONB), `ip`, `zaman` |

### 4.4 R&D Teams & Kanban Task Engine (7 Tables)
| Table Name | Primary Key | Description & Key Columns |
| :--- | :--- | :--- |
| `takimlar` | `id` (`TEXT`) | R&D squads & working groups: `ad`, `slug`, `kategori`, `liderId`, `kontenjan`, `repoUrl`, `durum`, `katilimTuru` (`acik` \| `onayli`) |
| `takim_uyeleri` | `id` (`TEXT`) | Squad roster & pending applications: `takimId`, `kullaniciId`, `takimRolu`, `durum` (`aktif` \| `basvurdu`), `basvuruNotu` |
| `takim_basvuru_kararlari` | `id` (`TEXT`) | Historical log of approved/rejected squad applications |
| `takim_gorevleri` | `id` (`TEXT`) | Multi-column Kanban cards: `takimId`, `baslik`, `durum` (`beklemede`, `suruyor`, `inceleme`, `tamamlandi`), `oncelik`, `atananUyeId`, `teslimTarihi`, `sira`, `etiketler`, `xpVerildi` |
| `takim_gorev_maddeleri` | `id` (`TEXT`) | Sub-task checklist items (`gorevId`, `metin`, `tamamMi`, `sira`) |
| `takim_gorev_yorumlari` | `id` (`TEXT`) | Task discussion threads (`gorevId`, `kullaniciId`, `icerik`) |
| `takim_gorev_aktivite` | `id` (`TEXT`) | Structured task activity timeline (`olusturuldu`, `tasindi`, `atandi`, `madde_tamamlandi`, `yorum`) |

### 4.5 Events, QR Check-In & Cryptographic Certificates (4 Tables)
| Table Name | Primary Key | Description & Key Columns |
| :--- | :--- | :--- |
| `etkinlikler` | `id` (`TEXT`) | Community events: `slug`, `baslik`, `tur` (`atolye`, `seminer`, `yarisma`, `toplanti`), `konum`, `baslangic`, `bitis`, `kapasite`, `durum`, `yoklamaAcik` |
| `etkinlik_kayitlari` | `(etkinlikId, kullaniciId)` | Event RSVPs & registrations (supports self-cancellation prior to attendance) |
| `yoklamalar` | `id` (`TEXT`) | Verified event attendance records (`etkinlikId`, `kullaniciId`, `yontem`: `qr` \| `manuel`, `katilimZamani`) |
| `sertifikalar` | `id` (`TEXT`) | Cryptographic certificates (`dogrulamaKodu` `UNIQUE`, `kullaniciId`, `etkinlikId`, `baslik`, `kategori`, `verilisTarihi`, `pdfUrl`) |

### 4.6 Real-Time Chat, Polls & Internal Mail (9 Tables)
| Table Name | Primary Key | Description & Key Columns |
| :--- | :--- | :--- |
| `sohbet_odalari` | `id` (`TEXT`) | Chat rooms (`tur`: `genel`, `takim`, `ozel` 1-on-1 or Group DM; `takimId`; `ad`) |
| `sohbet_uyeleri` | `(odaId, kullaniciId)` | Room membership and per-user read cursor (`sonOkuma` epoch ms) |
| `sohbet_mesajlari` | `id` (`TEXT`) | Chat messages, replies, attachments, reactions, and soft-delete timestamps (`silinmeTarihi`) |
| `sohbet_anketleri` | `id` (`TEXT`) | In-chat interactive polls (`odaId`, `soru`, `cokluSecim`, `sonlanmaTarihi`) |
| `sohbet_anket_secenekleri` | `id` (`TEXT`) | Poll option rows (`anketId`, `metin`, `sira`) |
| `sohbet_anket_oylari` | `(anketId, secenekId, kullaniciId)` | Cast poll votes |
| `mesaj_konulari` | `id` (`TEXT`) | Internal Mail conversation threads (`konu`, `olusturanId`, `olusturma`) |
| `mesajlar` | `id` (`TEXT`) | Individual messages within a mail thread (`konuId`, `gonderenId`, `icerik`) |
| `mesaj_alicilari` | `(konuId, kullaniciId)` | Thread participants, read state (`okundu`), and archive/trash flags |

### 4.7 Treasury, Projects, Hardware Lab, News, Governance & Notes (10 Tables)
| Table Name | Primary Key | Description & Key Columns |
| :--- | :--- | :--- |
| `butce_kayitlari` | `id` (`TEXT`) | Community & team treasury ledger entries: `tarih`, `tur` (`gelir` \| `gider`), `kategori`, `tutarKurus` (minor currency units), `takimId` (`NULL` = general vault), `aktarimId` (paired inter-vault transfer ID), `fisFotoUrl` |
| `dosyalar` | `ad` (`TEXT`) | Metadata and access control for uploaded receipts and avatars (`yukleyenId`, `mime`, `boyut`, `herkeseAcik`) |
| `projeler` | `id` (`TEXT`) | R&D project showcase (`slug`, `baslik`, `ozet`, `aciklama`, `repoUrl`, `canliUrl`, `teknolojiler`, `takimId`, `durum`, `oneCikan`) |
| `proje_begenileri` | `(projeId, kullaniciId)` | Member stars on showcase projects |
| `envanter` | `id` (`TEXT`) | Hardware lab assets (`kod`, `ad`, `kategori`, `durum`: `saglam`, `oduncte`, `arizali`, `bakimda`, `oduncAlanId`, `iadeTarihi`, `seriNo`) |
| `envanter_hareketleri` | `id` (`TEXT`) | Historical checkout, extension, and return ledger for hardware assets |
| `tutanaklar_kararlar` | `id` (`TEXT`) | Official governance resolutions & documents (`kararNo` `YYYYnnn`, `belgeTuru`, `baslik`, `gundem`, `icerik`, `kamuyaAcikMi`, `kilitliMi`) |
| `haberler` | `id` (`TEXT`) | Community news & announcements (`slug`, `baslik`, `ozet`, `icerik`, `yayinDurumu`: `taslak` \| `uyeler` \| `yayinda`) |
| `kullanici_notlari` | `id` (`TEXT`) | Personal member notes (`kullaniciId`, `baslik`, `icerik`, `renk`, `sabitliMi`, `klasorId`, `copteMi`) |
| `kullanici_not_klasorleri` | `id` (`TEXT`) | Personal note folders (`kullaniciId`, `ad`, `renk`, `sira`) |

---

## 5. Domain Repository Layer (`src/server/db/domains/*.repo.ts`)

All SQL queries are organized by domain inside `src/server/db/domains/` and re-exported through `src/db/index.ts`:

- `auth.repo.ts` & `users.repo.ts` — Session verification, password updates, TOTP & WebAuthn persistence.
- `security.repo.ts` & `logs.repo.ts` — WAF strikes, IP quarantine (`guvenlik_engelleri`), SIEM telemetry (`sistem_loglari`), and SoC incidents (`soc_incidents`).
- `inspection.repo.ts` — Zero-Trust DB Studio introspection, table schemas, and sandboxed query execution.
- `members.repo.ts` — Member roster (`UYE_ROSTER_SQL`), profile updates, and application approvals.
- `teams.repo.ts` & `kanban.repo.ts` — R&D squads, Kanban boards, task checklists, and atomic XP awards.
- `events.repo.ts` & `certificates.repo.ts` — Event lifecycles, capacity-locked RSVPs, QR attendance, and cryptographic certificates.
- `budget.repo.ts` & `files.repo.ts` — Advisory-locked treasury ledgers, inter-vault transfers, and receipt ownership.
- `chat.repo.ts` & `mail.repo.ts` — Real-time chat rooms, polls, unread cursors, and internal mail.
- `projects.repo.ts`, `inventory.repo.ts`, `decisions.repo.ts`, `news.repo.ts`, `notes.repo.ts`, `settings.repo.ts`, `notifications.repo.ts`.

---

## 6. Concurrency Control, Advisory Locks & Row-Level Locking

Orbit never performs unsafe "read-then-write" application-level checks on contested resources. Every concurrent mutation uses PostgreSQL transactional primitives via `withTransaction(fn)`:

| Contested Resource | PostgreSQL Locking Mechanism | Guarantee |
| :--- | :--- | :--- |
| **First-Run Admin Setup** | `pg_advisory_xact_lock(hashtext('setup.first_admin'))` | Prevents concurrent `/api/kurulum` requests from creating duplicate bootstrap admins |
| **Last-Admin Protection** | `pg_advisory_xact_lock(hashtext('roller.admin'))` | Serializes role changes so two admins cannot simultaneously demote each other (`409 son-admin`) |
| **Treasury Balances & Transfers** | `pg_advisory_xact_lock(hashtext('kasa:<takimId\|genel>'))` | Serializes balance checks and expense writes; inter-vault transfers lock both vaults in deterministic alphabetical order to prevent deadlocks |
| **Governance Resolution Numbers** | `pg_advisory_xact_lock(hashtext('tutanaklar_kararlar.kararNo'))` | Generates strictly sequential `YYYYnnn` resolution numbers without gaps or collisions |
| **Event & Squad Capacity** | `SELECT ... FROM etkinlikler WHERE id = $1 FOR UPDATE` | Locks the parent event or squad row while counting current participants before inserting a registration |
| **Hardware Asset Checkout** | `UPDATE envanter SET durum = 'oduncte' ... WHERE id = $1 AND durum = 'saglam' RETURNING id` | Atomic compare-and-swap ensures two members cannot borrow the same lab item simultaneously |

---

## 7. Idempotent Startup Migrations (`ensurePostgresInit`)

Orbit requires no external migration CLI (`prisma migrate` or `flyway`) to deploy or upgrade:

1. On the first database call (or immediately after `reconfigurePgPool` in `/setup`), `ensurePostgresInit()` acquires `pg_advisory_xact_lock(hashtext('roller.sema'))` so multiple server workers starting concurrently never race.
2. `runSchemaMigrations(client)` (`src/server/db/schema.init.ts`) executes idempotent `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS` statements across all 45 tables.
3. Versioned one-time data transformations execute once via `runMigrationStep(client, migrationId, fn)` and record completion in `schema_migrations`.
4. `ensureRoleSchema`, `ensureAuditSchema`, `ensureMailSchema`, and `ensureOAuthSchema` verify core system tables and seed the immutable `rol_admin` role.

---

## 8. Backup, Restore & Disaster Recovery Flows

### Automated & Manual SQL Backups (`make db-backup`)
Orbit includes a production backup script (`infra/scripts/db-backup.sh`) invoked via:
```bash
make db-backup
```
This runs `pg_dump` inside the `orbit-db` container (or against your configured PostgreSQL instance) and writes a compressed, timestamped SQL snapshot to `./backups/orbit_backup_<YYYYMMDD_HHMMSS>.sql`.

### Restoring from a Snapshot
```bash
# Restore into the running Docker PostgreSQL container
cat backups/orbit_backup_20261025_120000.sql | docker exec -i orbit-db psql -U orbit -d orbit
```

### Resetting a Development Database (`make db-reset`)
To wipe all tables and volumes and return the instance to a fresh Zero-Config `/setup` state:
```bash
make db-reset
```
