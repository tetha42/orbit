# Orbit Community OS — Documentation Index & Governance Guide

Welcome to the official engineering, operational, and user documentation for **Orbit Community OS** by **tetha42**. This file serves as the single entry point to all technical specifications under `docs/`, defining reading paths, document governance, and verification rules.

---

## 1. Golden Rule: Code Is the Source of Truth

Whenever documentation and source code diverge, **the code is authoritative** and the documentation must be updated in the same pull request. Before documenting file paths, application counts, or database schemas, verify them directly against the repository:

```bash
# Count registered mini-application manifests (17: 16 user-facing + 1 internal mediaviewer)
find src/apps -maxdepth 2 -name manifest.ts | wc -l

# List all mini-application manifests
ls src/apps/*/manifest.ts

# List all modular domain repositories
ls src/db/repositories/*.repo.ts

# Inspect top-level source directories
find src -maxdepth 2 -type d | sort
```

### Core Documentation Principles

1. **Zero Config Files Mentality:** Never instruct users or operators to manually create `.env` or `config.ini` files to get started. Orbit Community OS is designed to be cloned, built, started (`docker compose up -d --build` or `npm install && npm run build && npm start` or `make up`), and configured entirely via the **Web UI Setup Wizard (`/setup`)** and **System Settings**.
2. **Generated Files Are Never Edited by Hand:** `src/apps/registry.gen.ts` and `src/apps/loaders.gen.ts` are automatically compiled from `src/apps/*/manifest.ts` via `scripts/gen-apps.mjs` (`npm run gen:apps`).
3. **Zero Secrets in Documentation:** Never commit real passwords, live TOTP seeds, private keys, or session cookies in documentation examples.

---

## 2. Canonical Documentation Inventory

The `docs/` directory is organized into canonical reference documents:

| Document | Scope & Purpose | Target Audience |
| :--- | :--- | :--- |
| **[`README.md`](../README.md)** | Flagship project overview, 17 app manifests (16 user-facing + 1 internal `mediaviewer`), Zero-Config quick start, RBAC model, and CLI reference | Everyone |
| **[`docs/README.md`](README.md)** | Documentation index, reading paths, architectural snapshot, and governance policy | Contributors & Maintainers |
| **[`docs/ARCHITECTURE.md`](ARCHITECTURE.md)** | Full-stack architecture, App Router & Embedded Microservice mini-app registry, in-memory SWR (`useJsonResource`), 60/120fps window compositor, Zero-Config runtime configuration (`organization_settings` + in-memory state), and directory structure | Software Engineers & Architects |
| **[`docs/DATABASE.md`](DATABASE.md)** | PostgreSQL 16 schema reference (32 consolidated pure English `snake_case` tables), `JSONB` optimizations, automatic `snake_case` $\rightarrow$ `camelCase` mapping, dynamic runtime pool reconfiguration (`reconfigurePgPool`), and advisory locking | Database Administrators & Backend Engineers |
| **[`docs/DATA_DICTIONARY.md`](DATA_DICTIONARY.md)** | Field-level data dictionary: 4 Organization Archetypes, ownership, visibility, edit authority, cardinality, retention, and index coverage across all 32 tables | Backend, Security & Compliance Engineers |
| **[`docs/DATA_MODEL_ROADMAP.md`](DATA_MODEL_ROADMAP.md)** | Universal Community OS data platform architecture, unit/committee model, embedded microservice boundaries, and `translations JSONB` localization design | Product, Backend & Data Engineers |
| **[`docs/API.md`](API.md)** | REST & SSE API contracts, `/api/setup` onboarding endpoints, OAuth 2.0 Identity Provider endpoints, SoC telemetry & SOAR playbooks, Events, Certificates, Treasury, and standard response envelopes | Frontend, Backend & Integration Engineers |
| **[`docs/AUTH_SECURITY.md`](AUTH_SECURITY.md)** | Authentication lifecycle (Argon2id/bcrypt, `HttpOnly` `orbit_session` cookies, TOTP 2FA, WebAuthn Passkeys), Global Legal Compliance (Terms of Service, GDPR Privacy Policy, Cookie Policy), Autonomous SoC Defense, DEFCON levels, Canary Honeypots, and FIM | Security Engineers & Auditors |
| **[`docs/USER_DATA_SECURITY.md`](USER_DATA_SECURITY.md)** | `users` security inventory, cryptographic invitation lifecycle, password reset, `mail_outbox` approval queue, Passkey/2FA behavior, and PWA fullscreen | Security, Privacy & Support Engineers |
| **[`docs/ARCHITECTURE_AUDIT.md`](ARCHITECTURE_AUDIT.md)** | End-to-end architecture, data-flow, and app-by-app audit report | Architects, Maintainers & Auditors |
| **[`docs/APP_SURFACE_INDEX.md`](APP_SURFACE_INDEX.md)** | Generated button/onClick/input/API surface index per mini-app | QA, Frontend & Product Engineers |
| **[`docs/DEPLOYMENT.md`](DEPLOYMENT.md)** | Zero-Config self-hosting with Docker Compose, bare-metal Node.js/PM2, reverse proxy configurations (Nginx & Caddy), TLS/WebAuthn requirements, and first-run web onboarding at `/setup` | DevOps & Systems Administrators |
| **[`docs/DEVELOPMENT.md`](DEVELOPMENT.md)** | Developer onboarding, Makefile targets, Embedded Microservice Mini-App Architecture (`manifest.ts`), Zero-Friction 1-PR Localization Guide (`src/locales/registry.ts`), `useContextMenu` hooks, and verification gates (`npm run verify`) | Core Contributors & Plugin Authors |
| **[`docs/OPERATIONS.md`](OPERATIONS.md)** | Day-2 operations, Autonomous SoC Studio monitoring, DEFCON lockdown recovery, database maintenance, audit retention, and health checks (`/api/healthz` & `/api/setup`) | Site Reliability Engineers (SRE) & Operators |
| **[`docs/UI_AND_DESIGN.md`](UI_AND_DESIGN.md)** | Dual design language specification: (1) Workspace Desktop Shell & Mini-Apps (adaptive light/dark glass & flat studio surfaces) and (2) Standalone & Static Surfaces (high-contrast monochrome flat surfaces for `/setup`, `/verify`, `/checkin`, `/oauth/authorize`, offline, and error boundaries) | UI/UX Designers & Frontend Engineers |
| **[`docs/USER_GUIDE.md`](USER_GUIDE.md)** | End-user and administrator handbook covering registration with global Member ID / Handle, desktop navigation, all 16 user-facing mini-apps, and community governance | Community Members, Leads & Administrators |

---

## 3. Recommended Reading Paths

### For Self-Hosters & Infrastructure Operators
1. **[`README.md`](../README.md)** — Understand the core capabilities and Zero-Config onboarding flow.
2. **[`docs/DEPLOYMENT.md`](DEPLOYMENT.md)** — Launch the stack via Docker Compose or Node.js/PM2 and complete the `/setup` wizard.
3. **[`docs/OPERATIONS.md`](OPERATIONS.md)** — Monitor health checks, manage SoC DEFCON levels, and schedule automated PostgreSQL backups.
4. **[`docs/AUTH_SECURITY.md`](AUTH_SECURITY.md)** — Configure TOTP 2FA policies, WebAuthn Passkeys, and security webhooks.

### For Software Engineers & Contributors
1. **[`docs/ARCHITECTURE.md`](ARCHITECTURE.md)** — Learn the modular monolith design, `src/core/*` shared hooks, and SSE real-time channels.
2. **[`docs/DEVELOPMENT.md`](DEVELOPMENT.md)** — Set up your local development loop, build an isolated mini-app, add a new language in 1 PR, and run `npm run verify`.
3. **[`docs/UI_AND_DESIGN.md`](UI_AND_DESIGN.md)** — Follow the dual design system rules and CSS token conventions.
4. **[`docs/DATABASE.md`](DATABASE.md)** & **[`docs/API.md`](API.md)** — Write domain repositories (`src/db/repositories/*.repo.ts`) and secure API routes (`requireApp`).

### For Community Administrators & Members
1. **[`docs/USER_GUIDE.md`](USER_GUIDE.md)** — Master the desktop interface, Member ID / Handle registration, organizational units, Kanban boards, Event QR check-ins, and RBAC role management.

---

## 4. Architectural Snapshot at a Glance

- **Studio & Product:** **Orbit Community OS** engineered from the ground up by **tetha42**.
- **Repository Topology:** Single-package modular monolith (`package.json`, Next.js 16 App Router, React 19, TypeScript 5.9).
- **Mini-Application Architecture:** 17 isolated application manifests under `src/apps/<id>/` (16 user-facing workspace apps + 1 internal `mediaviewer`), each exporting a strict `AppManifest` (`manifest.ts`) that drives the Dock, Launcher, Spotlight, TopBar menus, RBAC permission matrix, and notification routing.
- **Database Engine:** PostgreSQL 16 (`pg` pool) with 32 consolidated English `snake_case` tables, `JSONB` optimizations, runtime pool hot-swapping (`reconfigurePgPool`), transactional advisory locks (`pg_advisory_xact_lock`), and `LISTEN/NOTIFY` real-time pub/sub.
- **Zero-Config Runtime State:** All community branding, archetype templates, SMTP relays, default roles, and security switches live in PostgreSQL (`organization_settings`) synchronized with in-memory runtime configuration—requiring zero `.env` or `config.ini` files to deploy.

---

## 5. Documentation Maintenance & Quality Standards

When adding or updating documentation in `docs/`:

1. **100% Idiomatic English:** All headings, prose, tables, architecture diagrams, and code comments across `README.md` and `docs/*.md` must be written in clear, professional English.
2. **Relative Markdown Links:** Use relative paths for intra-repository documentation links (e.g., `[ARCHITECTURE.md](ARCHITECTURE.md)`) so links work seamlessly in both GitHub and local Markdown viewers.
3. **Verification Before Commit:** Always run `npm run verify` (or `make verify`) before committing changes to ensure all mini-app manifests, TypeScript types, i18n dictionaries, and CSS design tokens remain in sync.
