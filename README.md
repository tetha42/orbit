# Orbit Community OS

![CI](https://img.shields.io/github/actions/workflow/status/tetha42/orbit/ci-cd.yml?branch=main&label=CI)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)

**Engineered from the ground up by [tetha42](https://github.com/tetha42)**
**Orbit Community OS** is a flagship open-source, self-hosted digital community operating system and collaborative web-desktop suite built for developer collectives, research labs, decentralized organizations (DAOs), academic societies, and professional guilds. Built on **Next.js 16 (App Router)**, **React 19**, and **PostgreSQL 16**, Orbit delivers a hardware-accelerated multi-window desktop shell alongside **17 application manifests (16 user-facing workspace applications + 1 internal `mediaviewer`)**, an **Autonomous Security Operations Center (SoC Pro Studio)** with automated **SOAR defense playbooks**, a built-in **OAuth 2.0 / OIDC Identity Provider**, cryptographic document and certificate verification, and real-time event check-in.

---

## Core Philosophy: Zero Config Files

Orbit Community OS is architected with a **Zero Config Files** philosophy:

- **No `.env` or `config.ini` files required in your repository:** You never need to copy template files, generate random hex secrets by hand, or edit configuration files before starting the server.
- **Clone, Build, Run, and Onboard in the Browser:** Launch the stack with `docker compose up -d --build` (or `npm install && npm run build && npm start` / `make up`), open your browser, and complete the interactive **Web UI Setup Wizard (`/setup`)**.
- **Universal Organization Archetypes:** Select your community's archetype (`academic_club`, `dao_collective`, `research_lab`, or `professional_guild`) during `/setup` to tailor terminology, tracks, cohort levels, and governance defaults with zero code changes.
- **Runtime Database & System Reconfiguration:** Configure your PostgreSQL connection (`reconfigurePgPool`), studio and organization identity, initial super-administrator account, encrypted SMTP relay, OAuth 2.0 clients, security webhooks, and granular role permissions directly from the browser at runtime via `organization_settings` and in-memory state synchronization.

---

## Key Capabilities & Architecture Highlights

| Layer | Technology & Engineering Design |
| :--- | :--- |
| **Runtime & Framework** | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5.9, Node.js 22+ |
| **Primary Data Store** | PostgreSQL 16 (Consolidated **32-table pure English `snake_case` schema**, `JSONB` optimizations, dynamic pool hot-swapping via `reconfigurePgPool`) |
| **Client Data & Caching** | In-memory Stale-While-Revalidate (`useJsonResource` with 25s freshness TTL) + concurrent request deduplication |
| **Window Compositor** | 60/120fps W3C Pointer Events window manager, 8-directional resizing, `content-visibility: hidden` offscreen culling, GPU layer promotion (`will-change`, `contain: strict`) |
| **Real-Time Event Bus** | PostgreSQL `LISTEN/NOTIFY` + 3 dedicated Server-Sent Events (SSE) streams (`orbit_events`, `chat_events`, `soc_stream`) with `requestAnimationFrame` backpressure buffering |
| **Identity & Authentication** | Argon2id / bcrypt password hashing, `HttpOnly` session cookies (`orbit_session`) with at-rest SHA-256 token hashing, Pass-the-Cookie IP binding shield, TOTP 2FA (`otplib`), and FIDO2 / WebAuthn Passkeys (`@simplewebauthn`) |
| **Autonomous Cyber Defense** | SoC Pro Studio, DEFCON 1–5 posture control, automated SOAR playbooks, AI & Recon Canary honeypots, Go-powered File Integrity Monitoring (FIM), and Zero-Trust DB Studio (`x-db-token`) |
| **OAuth 2.0 Identity Provider** | RFC 6749 Authorization Code Flow with PKCE (`S256`), OpenID Connect discovery (`/.well-known/openid-configuration`), JWKS endpoint, and scoped consent screen (`/oauth/authorize`) |
| **Zero-Friction Localization** | Registry-driven i18n (`src/locales/registry.ts`) + PostgreSQL `translations JSONB` allowing new languages to be added in a single PR without touching SQL or React components |
| **Design Language** | Dual-surface architecture: (1) Adaptive Light/Dark Glass & Flat Studio Desktop Shell, and (2) High-Contrast Monochrome Flat Surfaces for standalone utilities (`/setup`, `/verify`, `/checkin`, `/oauth/authorize`) |

---

## The 17 Application Manifests (16 User-Facing + 1 Internal)

Every application in Orbit Community OS is an isolated embedded microservice under `src/apps/<id>/` governed by a declarative `manifest.ts` contract:

1. **SoC Pro Studio (`soc`):**
   - Split-view security command center with live DEFCON 1–5 threat posture and one-click Emergency Lockdown.
   - Real-time Threat Radar, AI/Recon Canary honeypot fleet telemetry, and SIEM Forensic Log Analyzer with 24-hour histograms and multi-operator filtering.
   - Blue Team File Integrity Monitoring (FIM) with unified diff inspection and active Web Application Firewall (WAF) rule management.
   - Automated SOAR Playbooks for session termination, IP quarantine, Linux PTY shell kill-switch, and Zero-Trust database access freeze.
   - Integrated Security Testbench for OAuth 2.0 PKCE simulation, WAF payload testing, and endpoint diagnostics.
2. **Events (`events`):**
   - End-to-end event lifecycle management, capacity tracking (`event_participants`), RSVP self-cancellation, and live QR / 6-digit short-code attendance check-in (`/checkin`).
3. **Teams & R&D Hub (`teams`):**
   - Organizational unit directory (`units`: squads, guilds, committees, councils), membership applications (`unit_members`), multi-column Kanban task boards (`tasks` with `checklist JSONB`), task comments, XP rewards, and dedicated unit treasury ledgers.
4. **Member Directory (`members`):**
   - Global member roster with Member ID / Handle search, role assignment, profile cards, custom field governance (`form_schemas`), attendance metrics, and direct SoC security posture links.
5. **Budget & Treasury (`budget`):**
   - Double-entry-inspired community treasury and per-unit sub-ledgers (`treasury_entries`), atomic inter-vault allocations (`transfer_pair_id`), receipt uploads with MIME verification, and immutable audit trails.
6. **Zero-Trust Database Studio (`database`):**
   - Interactive SQL runner, schema visualizer, table inspector, and data exporter across all 32 PostgreSQL tables protected by a 2FA-verified, short-lived `x-db-token` and server-side query guard.
7. **Terminal (`terminal`):**
   - Sandboxed Linux PTY shell emulator (`@xterm/xterm`) with real-time SOAR session monitoring and instant kill-switch integration.
8. **Chat (`chat`):**
   - Real-time messaging across community channels, unit rooms, 1-on-1 direct messages, and group chats with interactive polls (`polls`), reactions, typing indicators, and a 4-tier notification pipeline.
9. **Mail (`mail`):**
   - Internal community mail threads, role/unit recipient groups, and official broadcast announcements backed by AES-256-GCM encrypted SMTP relay settings and `mail_outbox`.
10. **Projects (`projects`):**
    - Community R&D showcase linking repositories, live deployments, technology tags (`tech_stack JSONB`), unit attributions, and member stars (`starred_user_ids JSONB`).
11. **Inventory (`inventory`):**
    - Hardware lab and asset tracking (`inventory_items` with `LAB-*` asset codes), loan checkouts, due-date alerts, and embedded `loan_history JSONB` workflows.
12. **Certificates (`certificates`):**
    - Cryptographic achievement and participation certificates with instant PDF generation and public verification at `/verify`.
13. **News (`news`):**
    - Multi-tier community publishing (`news_posts`: `'draft' | 'members_only' | 'published'`) with Markdown support and public REST syndication.
14. **Notes (`notes`):**
    - Personal workspace notes with color-coded folders, tags, pinning, and trash recovery.
15. **Governance & Committees (`decisions`):**
    - Committee and council directory, voting weights, meetings, proposals, and official resolutions (`governance_records`) with quorum and poll tracking.
16. **System Settings (`settings`):**
    - Granular RBAC role designer, Organization Archetype & identity configuration (`organization_settings`), dynamic form builder (`form_schemas`), legal document versioning (`legal_documents`), OAuth 2.0 application registry, SMTP configuration, wallpaper/theme studio, and Passkey & 2FA enrollment.
17. **Media Viewer (`mediaviewer` — Internal Utility Window):**
    - Internal system window for inspecting images, PDFs, receipts, and media attachments within the desktop workspace.

---

## Zero-Config Quick Start

Orbit Community OS requires **no configuration files** to start. Clone the repository, launch the application, and configure everything from your browser.

### Option A: Docker Compose (Recommended for Production & Self-Hosting)

```bash
git clone https://github.com/tetha42/orbit.git
cd orbit
docker compose up -d --build
```

Open `http://localhost:3000` (or `http://localhost`). Orbit automatically detects an uninitialized instance and launches the **Web UI Setup Wizard (`/setup`)**.

### Option B: Local Node.js / pnpm Runtime

```bash
git clone https://github.com/tetha42/orbit.git
cd orbit
npm install
npm run build
npm start
```

*(For active development with hot-reloading, run `make dev` or `pnpm dev` and visit `http://localhost:3000`.)*

### First-Run Web Onboarding (`/setup`)

When you first access Orbit Community OS in your browser, the 5-step Zero-Config Setup Wizard guides you through:

1. **Database Connection & Auto-Detection:** Orbit automatically detects running PostgreSQL instances (Docker Compose, Docker network, baremetal host). If no database exists, the wizard provides a 1-click Docker command to spin up PostgreSQL in seconds. Custom URIs can be entered and tested live via `POST /api/setup/test-db`, binding the pool and running all schema initializations without rebooting.
2. **Organization Archetype, Identity & Proxy Helper:** Choose your archetype (`academic_club`, `dao_collective`, `research_lab`, or `professional_guild`), set your Studio/Parent Entity name (default: `tetha42`), Organization name (`Orbit Community`), and primary domain (`orbit.example.com`). The built-in **Reverse Proxy Assistant** outputs copy-ready and downloadable Nginx and Caddy configs pre-tuned for SSE event streaming (`proxy_buffering off; chunked_transfer_encoding off;`).
3. **Initial Super-Administrator:** Create the primary administrator account (minimum 12-character password, hashed with bcrypt cost 12) and automatically establish an authenticated `HttpOnly` session (`orbit_session`).
4. **SMTP & Notification Relay (Optional):** Configure outbound SMTP credentials (encrypted at rest using AES-256-GCM in `organization_settings.smtp_config`) or skip and configure later in **Settings → System**.
5. **Instant Workspace Launch:** Orbit persists your runtime settings into `organization_settings`, seeds the default community channel, and transitions directly into the desktop workspace.

---

## Granular Role-Based Access Control (RBAC)

Roles in Orbit are dynamic database records (`roles.permissions JSONB`)—never hardcoded enums. Every role assigns one of three pure English permission levels to each of the 16 user-facing mini-apps:

| Permission Level | Behavior Across UI, Search, Notifications & API |
| :--- | :--- |
| **None (`'none'`)** | The application does not exist for the member: hidden from the Dock, Launcher, and Spotlight; excluded from search results and notifications; API endpoints return `403 Forbidden`. |
| **Use (`'use'`)** | Standard member access: view content, RSVP to events, join units, borrow lab equipment, participate in chat, and vote on proposals. |
| **Manage (`'manage'`)** | Administrative privileges for that specific domain: create/edit records, approve applications, issue certificates, manage budgets, or execute SOAR playbooks. |

- **Privilege Escalation Prevention:** No member or role manager can create, edit, or assign a role that grants higher permissions on *any* mini-app than the actor currently holds.
- **Last-Admin Protection:** Protected by PostgreSQL transaction advisory locks (`pg_advisory_xact_lock`), the last active administrator (`'role_admin'`) cannot be demoted, deactivated, or deleted.
- **Mandatory 2FA Enforcement:** Roles flagged with mandatory 2FA (`require_2fa = true`) restrict the user exclusively to the **Settings** app (`403 2FA_SETUP_REQUIRED` on all other APIs) until TOTP or a WebAuthn Passkey is enrolled.

---

## Repository Architecture

```text
src/
├── app/                  # Next.js 16 App Router (Standalone pages & REST/SSE API routes)
│   ├── api/              # Domain API endpoints (/api/auth, /api/soc, /api/oauth, /api/setup, ...)
│   ├── checkin/          # Standalone high-contrast event QR & short-code check-in (/checkin)
│   ├── oauth/            # OAuth 2.0 / OIDC authorization & consent screen (/oauth/authorize)
│   ├── setup/            # Zero-Config Web UI Setup Wizard (/setup)
│   └── verify/           # Public cryptographic document & certificate verification (/verify)
├── apps/                 # 17 self-contained mini-applications (16 user-facing + 1 mediaviewer)
│   ├── budget/           # Treasury & unit sub-ledgers
│   ├── certificates/     # Certificate studio & PDF generator
│   ├── chat/             # Real-time channels, DMs, and polls
│   ├── database/         # Zero-Trust DB Studio
│   ├── decisions/        # Governance, committees, meetings & resolutions
│   ├── events/           # Event management & QR check-in
│   ├── inventory/        # Hardware & asset tracking
│   ├── mail/             # Internal mail & broadcast announcements
│   ├── mediaviewer/      # Internal media & document preview window
│   ├── members/          # Member directory & role assignment
│   ├── news/             # Community news & public syndication
│   ├── notes/            # Personal workspace notes
│   ├── projects/         # R&D project showcase
│   ├── settings/         # System settings, RBAC, forms, legal & OAuth apps
│   ├── soc/              # Autonomous SoC Pro Studio & SOAR playbooks
│   ├── teams/            # Organizational units & Kanban task boards
│   └── terminal/         # Sandboxed Linux PTY terminal
├── components/           # Desktop shell (TopBar, Dock, WindowManager, MobileLauncher, Auth)
├── core/                 # Shared kernel hooks (permissions, session, windows, data SWR, i18n, theme)
├── db/                   # PostgreSQL connection pool, schema.init.ts & repositories
│   └── repositories/     # 26 modular PostgreSQL domain repositories (*.repo.ts)
├── locales/              # Multi-language registry (registry.ts) & core locale bundles
├── lib/                  # Auth guards, WAF, SOAR playbooks, rate limiters, crypto & helpers
├── state/                # Thin workspace state aggregator (workspaceStore.tsx)
└── proxy.ts              # Edge WAF inspection & AI/Recon Canary honeypot fleet
```

---

## Makefile & CLI Reference

Run `make help` to inspect all developer and operator workflows:

| Command | Description |
| :--- | :--- |
| `make up` / `make compose-up` | Build and launch PostgreSQL + Orbit Community OS via Docker Compose |
| `make down` / `make compose-down` | Gracefully stop all running Docker Compose services |
| `make logs` / `make compose-logs` | Stream real-time container logs |
| `make dev` | Start the local Next.js 16 Turbopack development server on `:3000` |
| `make build` | Generate mini-app registries and build the production Next.js bundle |
| `make verify` | Run the full verification gate: `gen:apps` + `tsc --noEmit` + `eslint` + `check-pure` + `check-i18n` + `check-tokens` |
| `make test-e2e` | Run end-to-end security, RBAC, and workspace simulation suites |
| `make db-up` | Start only the PostgreSQL 16 container on `:5432` |
| `make db-shell` | Open an interactive `psql` shell inside the PostgreSQL container |
| `make db-backup` | Dump a timestamped SQL backup into `backups/` |
| `make db-reset` | Destroy and recreate a clean PostgreSQL volume |
| `make release TAG=v3.0.0` | Create a signed, verified Git release tag and trigger CI/CD |

---

## Documentation Index

All canonical documentation lives in [`docs/`](docs/README.md):

- **[`docs/README.md`](docs/README.md)** — Documentation index, reading paths, and governance guide.
- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — Full-stack architecture, modular mini-app registry, 60/120fps window compositor, SWR data layer, and Zero-Config runtime state.
- **[`docs/DATABASE.md`](docs/DATABASE.md)** — PostgreSQL 16 schema reference (32 consolidated tables), `JSONB` optimizations, automatic `snake_case` $\rightarrow$ `camelCase` mapping, `reconfigurePgPool`, and advisory locks.
- **[`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md)** — Field-level data dictionary covering all 32 tables, 4 Organization Archetypes, visibility rules, and index coverage.
- **[`docs/DATA_MODEL_ROADMAP.md`](docs/DATA_MODEL_ROADMAP.md)** — Universal Community OS data platform architecture, unit/committee model, and `translations JSONB` design.
- **[`docs/API.md`](docs/API.md)** — REST & SSE API reference, `/api/setup` onboarding, OAuth 2.0 endpoints, SoC telemetry, Events, Certificates, Treasury, and response envelopes.
- **[`docs/AUTH_SECURITY.md`](docs/AUTH_SECURITY.md)** — Authentication lifecycle, global legal compliance (Terms of Service, GDPR Privacy Policy, Cookie Policy), Autonomous SoC defense, DEFCON levels, Canary Honeypots, and FIM.
- **[`docs/USER_DATA_SECURITY.md`](docs/USER_DATA_SECURITY.md)** — `users` security inventory, invitation lifecycle, password reset, `mail_outbox`, Passkey/2FA behavior, and audit trails.
- **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** — Zero-Config self-hosting with Docker Compose, bare-metal Node.js/PM2, Nginx/Caddy reverse proxies, and first-run web onboarding at `/setup`.
- **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** — Developer onboarding, Embedded Microservice Mini-App Architecture, Zero-Friction 1-PR Localization Guide (`src/locales/registry.ts`), and verification gates.
- **[`docs/OPERATIONS.md`](docs/OPERATIONS.md)** — Day-2 operations, SoC Studio monitoring, DEFCON lockdown recovery, database maintenance, and `/api/healthz` checks.
- **[`docs/UI_AND_DESIGN.md`](docs/UI_AND_DESIGN.md)** — Dual design language specification: Adaptive Desktop Shell & Mini-Apps vs. Standalone High-Contrast Monochrome Flat Surfaces.
- **[`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)** — Complete end-user and administrator handbook covering registration with Member ID / Handle, desktop navigation, all 16 user-facing mini-apps, and community governance.

---

## License & Credits

Crafted and maintained by **tetha42**. Released as open-source software under the Apache 2.0 License for digital communities worldwide.
