# Orbit Community OS — End-to-End Architecture, Data & Functional Audit (v3.0)

**Scope:** `src/apps/*` (17 manifests: 16 user-facing + 1 internal `mediaviewer`), `src/app/api/*`, `src/db/repositories/*.repo.ts`, `src/db/*`, window/DE compositor layer, hybrid local-cloud persistence, identity/RBAC, 32-table consolidated PostgreSQL 16 schema, and CI/CD verification gates.

---

## 1. Executive Summary

Orbit Community OS v3.0 completes the architectural consolidation from its historical dual-language schema into a **Zero-Backward-Compatibility, 100% English `snake_case` Data & Microservice Platform**:

| Dimension | v3.0 Architectural State |
| :--- | :--- |
| **Application Surface** | **17 Manifests** (`src/apps/*/manifest.ts`): 16 user-facing workspace applications + 1 internal `mediaviewer` window |
| **Database Architecture** | **32 Consolidated PostgreSQL 16 Tables** with strategic `JSONB` optimizations (`roles.permissions`, `tasks.checklist`, `users.custom_fields`, `users.workspace_state`, `translations JSONB`) and 100% foreign-key B-Tree/GIN index coverage |
| **Row Mapping** | Pure algorithmic `snake_case` $\rightarrow$ `camelCase` transformation in `mapRow()` (`src/db/index.ts`) with zero runtime compatibility dictionaries or legacy SQL views |
| **Organization Archetypes** | Universal data model supporting `'academic_club'`, `'dao_collective'`, `'research_lab'`, and `'professional_guild'` via `organization_settings` |
| **Localization Engine** | Registry-driven i18n (`src/locales/registry.ts`) + `translations JSONB` enabling 1-PR language contributions without touching SQL or React components |
| **Desktop State Roaming** | Hybrid local `IndexedDB` + cloud `users.workspace_state JSONB` synchronization across devices |

---

## 2. System Topology

```text
Next.js 16 App Router
├── src/app/api/*                 REST & SSE route handlers (/api/setup, /api/auth, /api/soc, ...)
├── src/apps/*                    17 isolated mini-app modules (manifest.ts + UI + locales)
├── src/core
│   ├── apps                      manifest/registry/loader contracts
│   ├── windows                   60/120fps pointer-events window state & commands
│   ├── session                   authenticated identity & RBAC client state
│   ├── shell / theme / sound     desktop environment shell (orbit_theme, orbit_sound)
│   ├── persistence               hybrid IndexedDB + cloud workspace roaming
│   ├── notifications             triple-stream SSE + SWR invalidation
│   └── permissions               pure RBAC lattice ('none' | 'use' | 'manage')
├── src/db/repositories           26 modular domain repositories (*.repo.ts)
├── src/db                        connection pool, schema.init.ts (32 tables), audit, roles
└── PostgreSQL 16                 32 pure English snake_case tables + LISTEN/NOTIFY + advisory locks
```

---

## 3. Source-of-Truth Matrix

| Domain | Canonical Source | Repository / Service Owner | Synchronization & Integrity Guarantee |
| :--- | :--- | :--- | :--- |
| **Organization Identity & Policy** | `organization_settings` | `src/db/repositories/settings.repo.ts`, `customization.repo.ts` | Synced to runtime config on boot and live-updated via Settings API |
| **Identity, Auth & Membership** | `users` | `src/db/repositories/users.repo.ts`, `members.repo.ts`, `auth.repo.ts` | Single authoritative table with `custom_fields JSONB` and `workspace_state JSONB` |
| **Roles & App Permissions** | `roles` (`permissions JSONB`) | `src/db/roles.ts` | Atomic JSONB permission matrix (`'none' \| 'use' \| 'manage'`); invalidated via SSE |
| **Dynamic Form Schemas** | `form_schemas` (`translations JSONB`) | `src/db/repositories/customization.repo.ts` | Governs registration and profile fields (`collect_at`, `required_at`, `visibility`) |
| **Legal Documents & Consent** | `legal_documents`, `user_consents` | `src/db/repositories/customization.repo.ts`, `privacy.repo.ts` | Immutable `version_history JSONB` and SHA-256 `content_hash` evidence per acceptance |
| **Organizational Units** | `units`, `unit_members` | `src/db/repositories/teams.repo.ts`, `committees.repo.ts` | Unifies `'squad'`, `'guild'`, `'committee'`, and `'council'` units with voting weights |
| **Kanban Execution** | `tasks` (`checklist JSONB`), `task_comments` | `src/db/repositories/kanban.repo.ts` | Single-query board loading and atomic XP awards on completion |
| **Governance & Proposals** | `governance_records`, `polls` | `src/db/repositories/decisions.repo.ts` | Advisory-locked sequential `reference_no` and public verification at `/verify` |
| **Events & Check-In** | `events`, `event_participants` | `src/db/repositories/events.repo.ts` | Unified registration & attendance lifecycle (`'registered' \| 'waitlisted' \| 'attended' \| 'cancelled'`) |
| **Treasury & Sub-Vaults** | `treasury_entries` | `src/db/repositories/budget.repo.ts` | Advisory-locked vault balances (`amount_minor`) and paired transfers (`transfer_pair_id`) |
| **Transactional Email Outbox** | `mail_outbox` | `src/db/repositories/mailOutbox.repo.ts` | AES-256-GCM encrypted fallback queue when SMTP is unconfigured |
| **Security & Governance Audit** | `audit_logs`, `system_logs`, `security_blocks`, `security_incidents` | `src/db/audit.ts`, `src/db/repositories/security.repo.ts`, `logs.repo.ts` | Transactional mutation auditing and real-time SIEM/SOAR streaming |

---

## 4. Verification & Quality Gates

All architectural invariants are enforced automatically by `npm run verify` (`make verify`):
1. **`scripts/gen-apps.mjs`**: Validates all 17 `manifest.ts` contracts and compiles `registry.gen.ts` and `loaders.gen.ts`.
2. **`tsc --noEmit`**: Enforces strict TypeScript 5.9 typing across all client components, API routes, and repositories.
3. **`eslint .`**: Enforces React 19 and module boundary rules.
4. **`scripts/check-pure.mjs`**: Runs unit assertions on RBAC permission math, field policies, theme boot scripts, and zero cross-app import isolation.
5. **`scripts/check-i18n.mjs`**: Verifies 100% translation key parity across all locales in `src/locales/registry.ts`.
6. **`scripts/check-tokens.mjs`**: Enforces semantic CSS custom property usage.
7. **`scripts/check-audit-coverage.mjs`**: Verifies transactional `audit_logs` coverage across mutating API routes.
