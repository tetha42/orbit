# System Architecture

Orbit Community OS is a modular monolith built with **Next.js 16 (App Router)**, **React 19**, **TypeScript 5.9**, and **PostgreSQL 16**. It exposes both a multi-window desktop operating system shell (with responsive mobile workspace views) and standalone public/auth/setup surfaces backed by **153** API route handlers and **42** PostgreSQL tables.

> For generated inventories, see **[`docs/generated/SURFACES.md`](generated/SURFACES.md)**, **[`docs/generated/SCHEMA.md`](generated/SCHEMA.md)**, **[`docs/generated/API.md`](generated/API.md)**, **[`AI_INDEX.json`](../AI_INDEX.json)** (`v3.1.0`), and **`.ai/shards/*.json`**. For agent-specific runtime constraints, see **[`AGENTS.md`](../AGENTS.md)**.

---

## 1. Directory Topology

| Path | Responsibility |
| :--- | :--- |
| `src/app/` | Next.js 16 App Router pages (`/`, `/setup`, `/verify`, `/checkin`, `/oauth/authorize`, etc.) and **153** REST/SSE handlers (`src/app/api/**/route.ts`) |
| `src/apps/<id>/` | Self-contained mini-apps (**18** manifests), each declaring `manifest.ts`, `<id>.contract.json`, hooks, views, and mobile views |
| `src/apps/registry.gen.ts` | Auto-generated client/server app registry and lazy loaders (`loaders.gen.ts`) compiled by `scripts/gen-apps.mjs` |
| `src/domains/<domain>/` | Self-contained multi-layer feature domains (`chatSearch`, `devices`, `drive`, `webrtc`) |
| `src/core/` | Shared platform primitives: app manifest types (`src/core/apps/manifest.ts`), permissions, desktop/window abstractions, and hooks |
| `src/components/` | Desktop shell, menu bar, dock, window compositor, notification center, context menus, and shared UI primitives |
| `src/db/` | `pg` pool & `snake_case` -> `camelCase` row mapper (`src/db/core/pool.ts`), singleflight schema init (`src/db/core/init.ts`), 42-table DDL, and domain repositories |
| `src/server/` | Server-only auth/session verification, storage quotas, security/WAF/SoC helpers, SMTP/mail dispatch, OAuth helpers, and terminal orchestration |
| `src/lib/` | Pure shared utilities (`src/lib/budget.ts`, validation, client helpers) and modular i18n bundles (`src/lib/i18n/{core,extra,features,domains}/*.ts`) |
| `src/locales/registry.ts` | Supported locale registry (`en`, `tr`), normalization, and `resolveLocalizedText()` for localized JSONB payloads |
| `src/state/`, `src/configs/`, `src/contracts/`, `src/types/` | Workspace state stores, static configs, shared API contracts, and global TypeScript declarations |
| `src/proxy.ts`, `src/instrumentation.ts` | Edge/request proxy & Next.js server startup instrumentation |
| `scripts/`, `bin/orbit` | Codegen (`gen-apps`, `gen-ai-index`, `gen-docs`), AI map/deps/impact tools, static AST gates, and unified CLI (`scripts/orbit-cli.mjs`) |
| `services/security-guard/` | Optional Go security-guard sidecar / FIM helper (`services/security-guard`) |

---

## 2. Mini-App Manifest, Contracts & i18n Auto-Discovery

Every application under `src/apps/<id>/` defines a pure, UI-free `manifest.ts` typed via `AppManifest` (`src/core/apps/manifest.ts`) and a `<id>.contract.json` file. Running `pnpm gen:apps` (or `./bin/orbit verify`) compiles all **18** manifests (17 user-facing apps including `drive` + 1 internal window `mediaviewer`) and domain i18n bundles into:

1. **`src/apps/registry.gen.ts` & `src/apps/loaders.gen.ts`** — Lazy-loaded window components, dock ordering, launcher categories, keyboard shortcuts, and menu bar items.
2. **`src/lib/i18n/domains.gen.ts`** — Auto-discovered domain translation exports from `src/lib/i18n/domains/*.ts`.
3. **`AI_INDEX.json` (`v3.1.0`, `<= 4 KB`) & `.ai/shards/*.json`** — Compact root index + **24** domain shards (`18` apps + `auth`, `core`, `devices`, `setup`, `shell`, `system`) with `tests` mappings, `exports`, `limits`, and `errorCodes`.
4. **`docs/generated/{SCHEMA,API,SURFACES}.md`** — Up-to-date Markdown inventories.

Permissions are modeled per app as `'none' | 'use' | 'manage'` on roles stored in `roles`:
- Manifests declare English `permission: { name, use, manage, everyoneOpen?, order? }`.
- Server route handlers enforce access with `requireApp(appId, level)` (or domain guards such as `verifyVaultAccess`, `requireDatabaseAdmin`, `authorizeTerminal`, and `verifyUploadAccess`).
- Real-time notifications declare app-level requirements via `manifest.notifications` so the server filters SSE/notification payloads by role permission.

---

## 3. Window Compositor, Feature Domains & Real-Time Data

- **Lazy Window Loading:** Mini-app components are dynamically imported only when a window opens (`manifest.component`), keeping the initial shell bundle within `scripts/check-bundle-budget.mjs`.
- **Desktop & Mobile Parity:** Each app provides a desktop view inside a managed window alongside responsive mobile tabs (`*MobileView.tsx`) on narrow viewports.
- **Cloud Drive & Quota Accounting:** `src/domains/drive/` implements folders, chunked file uploads (`/api/drive/upload/{init,chunk,complete}`), member/role sharing, and hierarchical `storage_quotas` (global, role, and member overrides). Media downloads (`/api/uploads/[name]`) support HTTP Range (`206 Partial Content`) streaming, and **Notes** (`notes`) supports embedded images with automatic orphan file & quota cleanup.
- **Chat Search & WebRTC Voice Calls:** `src/domains/chatSearch/` powers server-side message search (`/api/chat/search`), while `src/domains/webrtc/` handles room voice call state, ICE config, and SDP/ICE signaling (`/api/chat/call*`).
- **Device Sessions & Mobile Approval:** `src/domains/devices/` tracks `user_sessions`, `device_login_approvals`, and `push_subscriptions` to enforce single-session mobile + up to 4 concurrent desktops, E-Devlet 2-digit number matching, 6-digit codes, QR link approvals, and optional VAPID Web Push with Service Worker Notification fallback.
- **Deep Linking & SSE:** Query parameters (`/?app=news&id=<id>`, `/?app=events&id=<id>`) route through `NotificationClickBridge`. Workspace updates (`/api/stream`), chat rooms (`/api/chat/stream`), SoC telemetry (`/api/soc/stream`), and terminal output (`/api/terminal/stream`) use Server-Sent Events bounded by `src/server/sse/streamQuota.ts`.

---

## 4. Database Architecture & PostgreSQL 16 Runtime (`src/db/`)

Orbit uses **PostgreSQL 16** directly via the `pg` driver without a heavyweight ORM:

- **`INT8` -> `number` & `snake_case` -> `camelCase` (`src/db/core/pool.ts`):** OID `20` (`INT8`) parses to JS `number`, and `mapRow()` / `mapRows()` convert SQL column names into canonical TypeScript camelCase properties.
- **Singleflight + Cross-Process Advisory Lock (`src/db/core/init.ts`):** `ensurePostgresInit()` acquires a local singleflight promise and PostgreSQL advisory lock (`orbit.schema.init`), idempotently creating all **42** tables, columns, and safe indexes (`CREATE INDEX IF NOT EXISTS`). `reconfigurePgPool()` enables live pool binding during `/setup` without restarting Node.js.
- **Transactions & Concurrency:** Multi-statement mutations and quota/vault adjustments run inside `withTransaction` (with `pg_advisory_xact_lock` where needed). Multi-instance cache invalidations propagate via `publishEvent` (`pg_notify`) + `registerEventHandler`.
- **Parameterized SQL & Explicit Selects:** All SQL uses positional `$1, $2, ...` bindings and explicit column selection on tables holding hashes or secrets (`users.password_hash`).

### Domain Table Overview (42 PostgreSQL Tables)

| Domain | Tables |
| :--- | :--- |
| **Identity, Auth & Devices** | `users`, `roles`, `user_sessions`, `device_login_approvals`, `push_subscriptions`, `webauthn_credentials`, `verification_tokens`, `invitations`, `oauth_clients` |
| **Platform Configuration & Files** | `system_settings`, `legal_documents`, `form_fields`, `files`, `notifications` |
| **Cloud Drive & Storage Quotas** | `drive_folders`, `drive_items`, `drive_shares`, `storage_quotas` |
| **Community, Finance & Operations** | `budget_records`, `decisions`, `news`, `inventory`, `user_notes`, `projects`, `teams`, `team_members`, `team_tasks`, `events`, `event_participants`, `certificates` |
| **Messaging, Voice Calls & Mail** | `chat_rooms`, `chat_members`, `chat_messages`, `chat_polls`, `chat_calls`, `chat_call_signals`, `mail_outbox` |
| **Security, SoC & Audit** | `security_blocks`, `security_rules`, `soc_incidents`, `system_logs`, `audit_logs` |

---

## 5. API Guard & Verification Model

All **153** App Router route handlers under `src/app/api/**/route.ts` follow Next.js 16 async `params`/`searchParams` contracts and enforce layered guards (`verifyAuth`, `authenticate`, `authenticateEnrolled`, `requireApp`, `requireAdmin`, `requireDatabaseAdmin`, `verifyVaultAccess`, `authorizeTerminal`). Every state-changing route (`POST`/`PUT`/`PATCH`/`DELETE`) is statically verified for `withAudit(...)` coverage by `scripts/verify-ast.mjs`, while contract suites under `tests/contract/*.test.mjs` verify schemas, guards, quotas, and domain behaviors against PostgreSQL. Full operational and hardening details live in **[`docs/OPS_AND_SECURITY.md`](OPS_AND_SECURITY.md)**.
