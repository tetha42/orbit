# Orbit Community OS — Documentation Index & Governance Guide

Welcome to the official engineering, operational, and user documentation for **Orbit Community OS** by **tetha42**. This file serves as the single entry point to all technical specifications under `docs/`, defining reading paths, document governance, and verification rules.

---

## 1. Golden Rule: Code Is the Source of Truth

Whenever documentation and source code diverge, **the code is authoritative** and the documentation must be updated in the same pull request. Before documenting file paths, application counts, or database schemas, verify them directly against the repository:

```bash
# Count registered mini-applications (15)
find src/apps -maxdepth 2 -name manifest.ts | wc -l

# List all mini-application manifests
ls src/apps/*/manifest.ts

# Count PostgreSQL tables initialized at runtime (45)
grep -rhoE 'CREATE TABLE IF NOT EXISTS [a-zA-Z0-9_]+' src | awk '{print $NF}' | sort -u | wc -l

# Inspect top-level source directories
find src -maxdepth 2 -type d | sort
```

### Core Documentation Principles

1. **Zero Config Files Mentality:** Never instruct users or operators to manually create `.env` or `config.ini` files to get started. Orbit Community OS is designed to be cloned, built, started (`docker compose up -d --build` or `npm install && npm run build && npm start` or `make up`), and configured entirely via the **Web UI Setup Wizard (`/setup`)** and **System Settings**.
2. **Generated Files Are Never Edited by Hand:** `src/apps/registry.gen.ts` and `src/apps/loaders.gen.ts` are automatically compiled from `src/apps/*/manifest.ts` via `scripts/gen-apps.mjs` (`npm run gen:apps`).
3. **Zero Secrets in Documentation:** Never commit real passwords, live TOTP seeds, private keys, or session cookies in documentation examples.

---

## 2. Canonical Documentation Inventory

The `docs/` directory is organized into **10 canonical reference documents**:

| Document | Scope & Purpose | Target Audience |
| :--- | :--- | :--- |
| **[`README.md`](../README.md)** | Flagship project overview, 15 mini-apps summary, Zero-Config quick start, RBAC model, and CLI reference | Everyone |
| **[`docs/README.md`](README.md)** | Documentation index, reading paths, architectural snapshot, and governance policy | Contributors & Maintainers |
| **[`docs/ARCHITECTURE.md`](ARCHITECTURE.md)** | Full-stack architecture, App Router & modular mini-app registry, in-memory SWR (`useJsonResource`), 60/120fps window compositor, Zero-Config runtime configuration (`sistem_ayarlari` + in-memory state), and directory structure | Software Engineers & Architects |
| **[`docs/API.md`](API.md)** | REST & SSE API contracts, `/api/setup` onboarding endpoints, OAuth 2.0 Identity Provider endpoints, SoC telemetry & SOAR playbooks, Events, Certificates, Finance, and standard response envelopes | Frontend, Backend & Integration Engineers |
| **[`docs/AUTH_SECURITY.md`](AUTH_SECURITY.md)** | Authentication lifecycle (Argon2id/bcrypt, `HttpOnly` cookies, TOTP 2FA, WebAuthn Passkeys), Global Legal Compliance (Terms of Service, GDPR Privacy Policy, Cookie Policy), Autonomous SoC Defense, DEFCON levels, Canary Honeypots, and FIM | Security Engineers & Auditors |
| **[`docs/DATABASE.md`](DATABASE.md)** | PostgreSQL 16 schema reference (45 tables), dynamic runtime pool reconfiguration (`reconfigurePgPool`), advisory & row-level locking patterns, idempotent startup migrations, and backup/restore workflows | Database Administrators & Backend Engineers |
| **[`docs/DEPLOYMENT.md`](DEPLOYMENT.md)** | Zero-Config self-hosting with Docker Compose, bare-metal Node.js/PM2, reverse proxy configurations (Nginx & Caddy), TLS/WebAuthn requirements, and first-run web onboarding at `/setup` | DevOps & Systems Administrators |
| **[`docs/DEVELOPMENT.md`](DEVELOPMENT.md)** | Developer onboarding, Makefile targets, creating new mini-apps (`manifest.ts`), i18n localization (`en` primary, `tr` secondary), context menu hooks (`useContextMenu`), and verification gates (`npm run verify`) | Core Contributors & Plugin Authors |
| **[`docs/OPERATIONS.md`](OPERATIONS.md)** | Day-2 operations, Autonomous SoC Studio monitoring, DEFCON lockdown recovery, database maintenance, audit retention, and health checks (`/api/health`) | Site Reliability Engineers (SRE) & Operators |
| **[`docs/UI_AND_DESIGN.md`](UI_AND_DESIGN.md)** | Dual design language specification: (1) Workspace Desktop Shell & Mini-Apps (adaptive light/dark glass & flat studio surfaces) and (2) Standalone & Static Surfaces (high-contrast monochrome flat surfaces for `/setup`, `/verify`, `/checkin`, `/oauth/authorize`, offline, and error boundaries) | UI/UX Designers & Frontend Engineers |
| **[`docs/USER_GUIDE.md`](USER_GUIDE.md)** | End-user and administrator handbook covering registration with global Member ID / Handle, desktop navigation, all 15 mini-apps, and community governance | Community Members, Leads & Administrators |

---

## 3. Recommended Reading Paths

### For Self-Hosters & Infrastructure Operators
1. **[`README.md`](../README.md)** — Understand the core capabilities and Zero-Config onboarding flow.
2. **[`docs/DEPLOYMENT.md`](DEPLOYMENT.md)** — Launch the stack via Docker Compose or Node.js/PM2 and complete the `/setup` wizard.
3. **[`docs/OPERATIONS.md`](OPERATIONS.md)** — Monitor health checks, manage SoC DEFCON levels, and schedule automated PostgreSQL backups.
4. **[`docs/AUTH_SECURITY.md`](AUTH_SECURITY.md)** — Configure TOTP 2FA policies, WebAuthn Passkeys, and security webhooks.

### For Software Engineers & Contributors
1. **[`docs/ARCHITECTURE.md`](ARCHITECTURE.md)** — Learn the modular monolith design, `src/core/*` shared hooks, and SSE real-time channels.
2. **[`docs/DEVELOPMENT.md`](DEVELOPMENT.md)** — Set up your local development loop, build a new mini-app, and run `npm run verify`.
3. **[`docs/UI_AND_DESIGN.md`](UI_AND_DESIGN.md)** — Follow the dual design system rules and CSS token conventions.
4. **[`docs/DATABASE.md`](DATABASE.md)** & **[`docs/API.md`](API.md)** — Write domain repositories (`src/server/db/domains/*.repo.ts`) and secure API routes (`requireApp`).

### For Community Administrators & Members
1. **[`docs/USER_GUIDE.md`](USER_GUIDE.md)** — Master the desktop interface, Member ID / Handle registration, R&D teams, Kanban boards, Event QR check-ins, and RBAC role management.

---

## 4. Architectural Snapshot at a Glance

- **Studio & Product:** **Orbit Community OS** engineered from the ground up by **tetha42**.
- **Repository Topology:** Single-package modular monolith (`package.json`, Next.js 16 App Router, React 19, TypeScript 5.9).
- **Mini-Application Architecture:** 15 isolated feature modules under `src/apps/<id>/`, each exporting a strict `AppManifest` (`manifest.ts`) that drives the Dock, Launcher, Spotlight, TopBar menus, RBAC permission matrix, and notification routing.
- **Database Engine:** PostgreSQL 16 (`pg` pool) with 45 tables, runtime pool hot-swapping (`reconfigurePgPool`), transactional advisory locks (`pg_advisory_xact_lock`), and `LISTEN/NOTIFY` real-time pub/sub.
- **Zero-Config Runtime State:** All community branding, SMTP relays, default roles, and security switches live in PostgreSQL (`sistem_ayarlari`) synchronized with in-memory runtime configuration—requiring zero `.env` or `config.ini` files to deploy.

---

## 5. Documentation Maintenance & Quality Standards

When adding or updating documentation in `docs/`:

1. **100% Idiomatic English:** All headings, prose, tables, architecture diagrams, and code comments across `README.md` and `docs/*.md` must be written in clear, professional English.
2. **Relative Markdown Links:** Use relative paths for intra-repository documentation links (e.g., `[ARCHITECTURE.md](ARCHITECTURE.md)`) so links work seamlessly in both GitHub and local Markdown viewers.
3. **Verification Before Commit:** Always run `npm run verify` (or `make verify`) before committing changes to ensure all mini-app manifests, TypeScript types, i18n dictionaries, and CSS design tokens remain in sync.
