# Orbit Community OS

![CI](https://img.shields.io/github/actions/workflow/status/tetha42/orbit/ci-cd.yml?branch=main&label=CI)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)

**Engineered from the ground up by [tetha42](https://github.com/tetha42)**
**Orbit Community OS** is a flagship open-source, self-hosted digital community operating system and collaborative web-desktop suite built for developer collectives, research labs, decentralized organizations (DAOs), and engineering communities. Built on **Next.js 16 (App Router)**, **React 19**, and **PostgreSQL 16**, Orbit delivers a hardware-accelerated multi-window desktop shell alongside **16 user-facing workspace applications** plus an internal media preview window, an **Autonomous Security Operations Center (SoC Pro Studio)** with automated **SOAR defense playbooks**, a built-in **OAuth 2.0 / OIDC Identity Provider**, cryptographic document and certificate verification, and real-time event check-in.

---

## Core Philosophy: Zero Config Files

Orbit Community OS is architected with a **Zero Config Files** philosophy:

- **No `.env` or `config.ini` files required in your repository:** You never need to copy template files, generate random hex secrets by hand, or edit configuration files before starting the server.
- **Clone, Build, Run, and Onboard in the Browser:** Launch the stack with `docker compose up -d --build` (or `npm install && npm run build && npm start` / `make up`), open your browser, and complete the interactive **Web UI Setup Wizard (`/setup`)**.
- **Runtime Database & System Reconfiguration:** Configure your PostgreSQL connection (`reconfigurePgPool`), studio and community identity, initial super-administrator account, encrypted SMTP relay, OAuth 2.0 clients, security webhooks, and granular role permissions directly from the browser at runtime via `sistem_ayarlari` and in-memory state synchronization.

---

## Key Capabilities & Architecture Highlights

| Layer | Technology & Engineering Design |
| :--- | :--- |
| **Runtime & Framework** | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5.9, Node.js 22+ |
| **Primary Data Store** | PostgreSQL 16 (`pg` connection pool with dynamic runtime reconfiguration via `reconfigurePgPool`) |
| **Client Data & Caching** | In-memory Stale-While-Revalidate (`useJsonResource` with 25s freshness TTL) + concurrent request deduplication |
| **Window Compositor** | 60/120fps W3C Pointer Events window manager, 8-directional resizing, `content-visibility: hidden` offscreen culling, GPU layer promotion (`will-change`, `contain: strict`) |
| **Real-Time Event Bus** | PostgreSQL `LISTEN/NOTIFY` + 3 dedicated Server-Sent Events (SSE) streams (`orbit_events`, `chat_events`, `soc_stream`) with `requestAnimationFrame` backpressure buffering |
| **Identity & Authentication** | Argon2id / bcrypt password hashing, `HttpOnly` session cookies with at-rest SHA-256 token hashing, Pass-the-Cookie IP binding shield, TOTP 2FA (`otplib`), and FIDO2 / WebAuthn Passkeys (`@simplewebauthn`) |
| **Autonomous Cyber Defense** | SoC Pro Studio, DEFCON 1–5 posture control, automated SOAR playbooks, AI & Recon Canary honeypots, Go-powered File Integrity Monitoring (FIM), and Zero-Trust DB Studio (`x-db-token`) |
| **OAuth 2.0 Identity Provider** | RFC 6749 Authorization Code Flow with PKCE (`S256`), OpenID Connect discovery (`/.well-known/openid-configuration`), JWKS endpoint, and scoped consent screen (`/oauth/authorize`) |
| **Design Language** | Dual-surface architecture: (1) Adaptive Light/Dark Glass & Flat Studio Desktop Shell, and (2) High-Contrast Monochrome Flat Surfaces for standalone utilities (`/setup`, `/verify`, `/checkin`, `/oauth/authorize`) |

---

## The 16 User-Facing Mini-Apps

Every application in Orbit Community OS is a self-contained module under `src/apps/<id>/` governed by a declarative `manifest.ts` contract:

1. **SoC Pro Studio (`soc`):**
   - Split-view security command center with live DEFCON 1–5 threat posture and one-click Emergency Lockdown.
   - Real-time Threat Radar, AI/Recon Canary honeypot fleet telemetry, and SIEM Forensic Log Analyzer with 24-hour histograms and multi-operator filtering.
   - Blue Team File Integrity Monitoring (FIM) with unified diff inspection and active Web Application Firewall (WAF) rule management.
   - Automated SOAR Playbooks for session termination, IP quarantine, Linux PTY shell kill-switch, and Zero-Trust database access freeze.
   - Integrated Security Testbench for OAuth 2.0 PKCE simulation, WAF payload testing, and endpoint diagnostics.
2. **Events (`events`):**
   - End-to-end event lifecycle management, capacity tracking, RSVP self-cancellation, and live QR / 6-digit short-code attendance check-in (`/checkin`).
3. **Teams & R&D Hub (`teams`):**
   - Research and engineering squad directory, membership applications, multi-column Kanban task boards with checklists, activity logs, XP rewards, and dedicated team treasury ledgers.
4. **Member Directory (`members`):**
   - Global member roster with Member ID / Handle search, role assignment, profile cards, attendance metrics, and direct SoC security posture links.
5. **Budget & Treasury (`budget`):**
   - Double-entry-inspired community treasury and per-team sub-ledgers, inter-vault allocations (`aktarimId`), receipt uploads with MIME verification, and immutable audit trails.
6. **Zero-Trust Database Studio (`database`):**
   - Interactive SQL runner, schema visualizer, table inspector, and data exporter protected by a 2FA-verified, short-lived `x-db-token` and server-side query guard.
7. **Terminal (`terminal`):**
   - Sandboxed Linux PTY shell emulator (`@xterm/xterm`) with real-time SOAR session monitoring and instant kill-switch integration.
8. **Chat (`chat`):**
   - Real-time messaging across community channels, R&D team rooms, 1-on-1 direct messages, and group chats with polls, reactions, typing indicators, and a 4-tier notification pipeline.
9. **Mail (`mail`):**
   - Internal community mail threads and official broadcast announcements backed by AES-256-GCM encrypted SMTP relay settings.
10. **Projects (`projects`):**
    - Community R&D showcase linking repositories, live deployments, technology tags, team attributions, and member stars.
11. **Inventory (`inventory`):**
    - Hardware lab and asset tracking (`LAB-*` codes), loan checkouts, due-date alerts, and return workflows.
12. **Certificates (`certificates`):**
    - Cryptographic achievement and participation certificates with instant PDF generation and public verification at `/verify`.
13. **News (`news`):**
    - Multi-tier community publishing (`draft`, `members-only`, `public`) with Markdown support and public REST syndication.
14. **Notes (`notes`):**
    - Personal encrypted-at-rest workspace notes with color-coded folders, pinning, and trash recovery.
15. **Governance & Committees (`decisions`):**
    - Committee directory, chair/member voting rights, meetings and decisions with quorum/vote records.
16. **System Settings (`settings`):**
    - Granular RBAC role designer, Studio & Community identity configuration, OAuth 2.0 application registry, SMTP configuration, wallpaper/theme studio, Passkey & 2FA enrollment, and full audit history.

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
2. **Studio & Community Identity + Proxy Helper:** Set your Studio name (default: `tetha42`), Community name (`Orbit Community`), and primary domain (`orbit.example.com`). The built-in **Reverse Proxy Assistant** outputs copy-ready and downloadable Nginx and Caddy configs pre-tuned for SSE event streaming (`proxy_buffering off; chunked_transfer_encoding off;`).
3. **Initial Super-Administrator:** Create the primary administrator account (minimum 12-character password, hashed with bcrypt cost 12) and automatically establish an authenticated `HttpOnly` session.
4. **SMTP & Notification Relay (Optional):** Configure outbound SMTP credentials (encrypted at rest using AES-256-GCM in `system_settings`) or skip and configure later in **Settings → System**.
5. **Instant Workspace Launch:** Orbit persists your runtime settings into the database, seeds the default community channel, and transitions directly into the desktop workspace.

---

## Granular Role-Based Access Control (RBAC)

Roles in Orbit are dynamic database records—never hardcoded enums. Every role assigns one of three permission levels to each of the 16 mini-apps:

| Permission Level | Behavior Across UI, Search, Notifications & API |
| :--- | :--- |
| **None (`yok`)** | The application does not exist for the member: hidden from the Dock, Launcher, and Spotlight; excluded from search results and notifications; API endpoints return `403 Forbidden`. |
| **Use (`kullan`)** | Standard member access: view content, RSVP to events, join teams, borrow lab equipment, participate in chat, and submit proposals. |
| **Manage (`yonet`)** | Administrative privileges for that specific domain: create/edit records, approve applications, issue certificates, manage budgets, or execute SOAR playbooks. |

- **Privilege Escalation Prevention:** No member or role manager can create, edit, or assign a role that grants higher permissions on *any* mini-app than the actor currently holds.
- **Last-Admin Protection:** Protected by PostgreSQL transaction advisory locks (`pg_advisory_xact_lock`), the last active administrator cannot be demoted, deactivated, or deleted.
- **Mandatory 2FA Enforcement:** Roles flagged with mandatory 2FA (`ikiAdimZorunlu`) restrict the user exclusively to the **Settings** app (`403 2FA_SETUP_REQUIRED` on all other APIs) until TOTP or a WebAuthn Passkey is enrolled.

---

## Repository Architecture

```text
src/
├── app/                  # Next.js 16 App Router (Standalone pages & REST/SSE API routes)
│   ├── api/              # Domain API endpoints (/api/auth, /api/soc, /api/oauth, /api/kurulum, ...)
│   ├── dogrula/          # Public cryptographic document & certificate verification (/verify)
│   ├── kurulum/          # Zero-Config Web UI Setup Wizard (/setup)
│   ├── oauth/            # OAuth 2.0 / OIDC authorization & consent screen (/oauth/authorize)
│   └── yoklama/          # Standalone high-contrast event QR & short-code check-in (/checkin)
├── apps/                 # 15 self-contained mini-applications (<id>/manifest.ts + index.tsx)
│   ├── budget/           # Treasury & team sub-ledgers
│   ├── certificates/     # Certificate studio & PDF generator
│   ├── chat/             # Real-time channels, DMs, and polls
│   ├── database/         # Zero-Trust DB Studio
│   ├── events/           # Event management & QR check-in
│   ├── inventory/        # Hardware & asset tracking
│   ├── mail/             # Internal mail & broadcast announcements
│   ├── members/          # Member directory & role assignment
│   ├── news/             # Community news & public syndication
│   ├── notes/            # Personal workspace notes
│   ├── projects/         # R&D project showcase
│   ├── settings/         # System settings, RBAC, OAuth apps & audit logs
│   ├── soc/              # Autonomous SoC Pro Studio & SOAR playbooks
│   ├── teams/            # R&D squads & Kanban task boards
│   └── terminal/         # Sandboxed Linux PTY terminal
├── components/           # Desktop shell (TopBar, Dock, WindowManager, MobileLauncher, Auth)
├── core/                 # Shared kernel hooks (permissions, session, windows, data SWR, i18n, theme)
├── db/                   # PostgreSQL connection pool, runtime reconfiguration & core schemas
├── server/db/domains/    # 20 domain-specific PostgreSQL repositories (*.repo.ts)
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
| `make release TAG=v2.0.0` | Create a signed, verified Git release tag and trigger CI/CD |

---

## Documentation Index

All canonical documentation lives in [`docs/`](docs/README.md):

- **[`docs/README.md`](docs/README.md)** — Documentation index, reading paths, and governance guide.
- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — Full-stack architecture, modular mini-app registry, 60/120fps window compositor, SWR data layer, and Zero-Config runtime state.
- **[`docs/API.md`](docs/API.md)** — REST & SSE API reference, `/api/setup` onboarding, OAuth 2.0 endpoints, SoC telemetry, Events, Certificates, Finance, and response envelopes.
- **[`docs/AUTH_SECURITY.md`](docs/AUTH_SECURITY.md)** — Authentication lifecycle, global legal compliance (Terms of Service, GDPR Privacy Policy, Cookie Policy), Autonomous SoC defense, DEFCON levels, Canary Honeypots, and FIM.
- **[`docs/DATABASE.md`](docs/DATABASE.md)** — PostgreSQL schema reference (45 tables), dynamic runtime pool reconfiguration (`reconfigurePgPool`), concurrency locks, idempotent migrations, and backup/restore flows.
- **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** — Zero-Config self-hosting with Docker Compose, bare-metal Node.js/PM2, Nginx/Caddy reverse proxies, and first-run web onboarding at `/setup`.
- **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** — Developer onboarding, Makefile targets, building new mini-apps, i18n localization (`en` primary, `tr` secondary), `useContextMenu` hooks, and verification gates.
- **[`docs/OPERATIONS.md`](docs/OPERATIONS.md)** — Day-2 operations, SoC Studio monitoring, DEFCON lockdown recovery, database maintenance, and `/api/healthz` checks.
- **[`docs/UI_AND_DESIGN.md`](docs/UI_AND_DESIGN.md)** — Dual design language specification: Adaptive Desktop Shell & Mini-Apps vs. Standalone High-Contrast Monochrome Flat Surfaces.
- **[`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)** — Complete end-user and administrator handbook covering registration with Member ID / Handle, desktop navigation, all 16 mini-apps, and community governance.

---

## License & Credits

Crafted and maintained by **tetha42**. Released as open-source software for digital communities worldwide.
