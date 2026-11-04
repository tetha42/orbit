# Orbit Community OS — User & Administrator Guide (v3.0)

Welcome to **Orbit Community OS** by **tetha42**—your collaborative web-desktop and digital community operating system. This handbook walks community members, unit leads, and administrators through registration, Organization Archetypes, desktop navigation, all **16 user-facing workspace applications** (plus the internal `mediaviewer`), and community governance.

---

## Table of Contents

1. [Getting Started: Archetypes, Registration, Handle & Sign-In](#1-getting-started-archetypes-registration-handle--sign-in)
2. [Navigating the Orbit Web-Desktop & Mobile Shell](#2-navigating-the-orbit-web-desktop--mobile-shell)
3. [Guide to All 16 User-Facing Mini-Applications](#3-guide-to-all-16-user-facing-mini-applications)
   - [3.1 SoC Pro Studio (`soc`)](#31-soc-pro-studio-soc)
   - [3.2 Events & QR Check-In (`events`)](#32-events--qr-check-in-events)
   - [3.3 Teams, Units & Kanban Boards (`teams`)](#33-teams-units--kanban-boards-teams)
   - [3.4 Member Directory (`members`)](#34-member-directory-members)
   - [3.5 Budget & Treasury Ledgers (`budget`)](#35-budget--treasury-ledgers-budget)
   - [3.6 Zero-Trust Database Studio (`database`)](#36-zero-trust-database-studio-database)
   - [3.7 Sandboxed Linux Terminal (`terminal`)](#37-sandboxed-linux-terminal-terminal)
   - [3.8 Real-Time Chat (`chat`)](#38-real-time-chat-chat)
   - [3.9 Internal Mail & Broadcasts (`mail`)](#39-internal-mail--broadcasts-mail)
   - [3.10 R&D Projects Showcase (`projects`)](#310-rd-projects-showcase-projects)
   - [3.11 Hardware Lab & Inventory (`inventory`)](#311-hardware-lab--inventory-inventory)
   - [3.12 Cryptographic Certificates (`certificates`)](#312-cryptographic-certificates-certificates)
   - [3.13 Community News (`news`)](#313-community-news-news)
   - [3.14 Personal Workspace Notes (`notes`)](#314-personal-workspace-notes-notes)
   - [3.15 Governance & Committees (`decisions`)](#315-governance--committees-decisions)
   - [3.16 System Settings (`settings`)](#316-system-settings-settings)
4. [Community Governance, Roles & Audit Transparency](#4-community-governance-roles--audit-transparency)
5. [Standalone Public Portals (`/setup`, `/verify`, `/checkin`, `/oauth/authorize`)](#5-standalone-public-portals-setup-verify-checkin-oauthauthorize)

---

## 1. Getting Started: Archetypes, Registration, Handle & Sign-In

### First-Run Instance Setup (`/setup`)
If you are the founder or systems operator launching a brand-new Orbit Community OS instance, visiting `/` automatically opens the **5-Step Web UI Setup Wizard (`/setup`)**, where you connect PostgreSQL, select your **Organization Archetype** (`academic_club`, `dao_collective`, `research_lab`, or `professional_guild`), define your Parent Entity (`tetha42`) and Organization identity (`organization_settings`), and create the initial super-administrator account with zero configuration files required.

### Member Registration
Prospective members can apply for membership directly from the sign-in portal (`/`):
1. Click **Create Account / Apply for Membership**.
2. Complete your profile details:
   - **First Name & Last Name**
   - **Email Address**
   - **Member ID / Handle (`handle`):** Your unique identifier (e.g., Student ID, `@ada`, ENS / wallet handle, or researcher ID depending on the organization archetype).
   - **Track & Cohort Level (`track`, `cohort_level`):** Select your primary discipline/guild and cohort level (e.g., *Distributed Systems, Cybersecurity, AI & Machine Learning, Protocol Engineering*).
   - **Password:** Choose a strong password (minimum 12 characters recommended).
3. Review and accept the required **Community Charter / Terms of Service** and **GDPR Privacy Policy** (`user_consents`), then submit your application.
4. Once approved by a community administrator (`status = 'active'`), you can sign in and access all applications granted to your role.

### Enrolling Two-Factor Authentication (TOTP 2FA) & Passkeys
- Open **System Settings → Security & 2FA**.
- **Authenticator App (TOTP):** Scan the QR code using 1Password, Apple Passwords, Google Authenticator, or Authy, enter the 6-digit code, and save your **8 single-use recovery codes** in a safe place.
- **Passkeys (WebAuthn / FIDO2):** Click **Register Passkey** to bind Touch ID, Face ID, Windows Hello, or a hardware YubiKey for one-tap passwordless sign-in.
- *Note:* If your assigned role mandates 2FA (`require_2fa = true`, such as `'role_admin'`), Orbit restricts workspace access solely to **System Settings** until you enable 2FA.

---

## 2. Navigating the Orbit Web-Desktop & Mobile Shell

### Desktop Interface
- **Application Dock (Bottom):** Click any icon to launch or focus its window. Hovering over an icon prefetches the application in the background for zero-latency launch. Unread badges appear automatically on apps like **Chat** and **Mail**.
- **TopBar (Top):**
  - **Left:** Orbit system menu (Lock Screen, Refresh All Data, About, Sign Out) and contextual menus for the currently focused application.
  - **Right:** Multi-language locale switcher (`src/locales/registry.ts`), Spotlight Search (`⌘K` / `Ctrl+K`), Sound & Theme quick controls, and the **Notification Center** bell.
- **Window Management:**
  - Drag any window by its titlebar; resize from any of the 8 edges or corners.
  - Use the titlebar controls to **Close**, **Minimize to Dock**, or **Maximize**. When a window is maximized, the Dock automatically hides and reappears when you move your cursor to the bottom edge of the screen.
- **Context Menus:** Right-click on the desktop canvas, Dock icons, or items inside mini-apps (or long-press for `500ms` on touchscreens) to open contextual actions.

### Mobile & Tablet Interface
On smartphones and compact touchscreens, Orbit automatically renders the **Mobile Launcher**:
- Tap any app icon on the home grid to open it full-screen.
- Use the bottom navigation bar to switch apps, return to the home grid, or open notifications.
- Contextual actions open in smooth slide-up **Action Sheets**.

---

## 3. Guide to All 16 User-Facing Mini-Applications

Your Dock and Launcher only display applications where your role (`roles.permissions JSONB`) grants at least **Use (`'use'`)** or **Manage (`'manage'`)** access. *(Orbit also includes a 17th internal manifest, `mediaviewer`, which opens automatically when previewing images, receipts, and PDFs).*

### 3.1 SoC Pro Studio (`soc`)
The autonomous cybersecurity command center for community infrastructure:
- **Threat Radar & DEFCON Control:** Monitor real-time attack telemetry and adjust readiness between **DEFCON 5** (Normal) and **DEFCON 1** (Emergency Lockdown).
- **SIEM Log Analyzer:** Filter `system_logs` by service (`security`, `auth`, `waf`), severity, IP address, or time window, and export forensic dossiers.
- **Forensics & Change History (`audit_logs`):** Inspect the complete before/after audit trail of all administrative mutations across the platform.
- **Blue Team / FIM:** Run Go-powered File Integrity Monitoring scans and inspect unified diffs of any modified system files.
- **SOAR Playbooks:** One-click session revocation, Linux PTY terminal termination, Zero-Trust DB access freeze, and IP quarantine management (`security_blocks`).

### 3.2 Events & QR Check-In (`events`)
- **Members (`'use'`):** Browse upcoming workshops, seminars, hackathons, meetings, and townhalls; RSVP with one click (`event_participants`) or self-cancel your registration; check in at the venue by scanning the event QR code or entering the 6-digit short code at `/checkin`.
- **Managers (`'manage'`):** Create and publish events, set capacity limits, open live QR / 6-digit check-in screens, and record manual attendance.

### 3.3 Teams, Units & Kanban Boards (`teams`)
- **Unit Discovery (`units`):** Explore active squads, working groups, guilds, and committees; view open capacity and submit membership applications (`unit_members`) with a personal motivation note.
- **Multi-Column Kanban Board (`tasks`):** Manage tasks across *To Do (`'todo'`)*, *In Progress (`'in_progress'`)*, *Review (`'review'`)*, and *Done (`'done'`).*
- **Checklists, Comments & XP:** Open any task card to manage embedded checklists (`checklist JSONB`), post discussion comments (`task_comments`), and earn **XP** automatically when tasks reach `'done'`.
- **Unit Sub-Treasury:** Unit leads can manage their unit's dedicated budget ledger directly.

### 3.4 Member Directory (`members`)
- **Members (`'use'`):** Search the active community roster by name, **Handle**, track, cohort level, or unit; view member profiles, XP rankings, and attendance counts.
- **Managers (`'manage'`):** Review and approve/reject pending membership applications, generate single-use cryptographic invitations (`invitations`), assign roles, and update member statuses (`'pending' | 'active' | 'suspended' | 'alumni' | 'rejected'`).

### 3.5 Budget & Treasury Ledgers (`budget`)
- **Transparent Community Finance (`treasury_entries`):** Tracks both the **General Community Vault** (`unit_id = NULL`) and individual **Unit Sub-Vaults**.
- **Members (`'use'`):** Inspect income and expense entries (`amount_minor`), currency breakdowns (`USD`, `EUR`, `TRY`, `USDC`, `ETH`), and inter-vault allocations in read-only mode.
- **Managers (`'manage'`) & Unit Leads:** Record income/expense transactions, attach receipt images/PDFs (`receipt_url`), and transfer funds atomically between vaults (`transfer_pair_id`).

### 3.6 Zero-Trust Database Studio (`database`)
- Restricted to administrators with `database: 'manage'` and protected by a secondary live 2FA/Passkey challenge (`x-db-token`).
- Browse all 32 PostgreSQL tables, inspect column types and foreign keys, edit rows safely, run parameterized SQL queries, and review the dedicated database audit log.

### 3.7 Sandboxed Linux Terminal (`terminal`)
- Full Xterm.js pseudo-terminal connected to a sandboxed shell environment for authorized infrastructure operators (`terminal: 'use'` / `'manage'`).
- Integrated with SoC Pro Studio so active shell sessions can be monitored and terminated immediately if anomalous activity is detected.

### 3.8 Real-Time Chat (`chat`)
- **Channels & Rooms (`chat_rooms`):** Participate in community-wide channels (`'channel'`), unit rooms (`'unit'`), 1-on-1 Direct Messages, and Group DMs (`'direct'`).
- **Rich Collaboration:** Create interactive multi-option polls (`polls`), react with emojis, reply to threads, forward messages, and see live typing indicators.
- **4-Tier Notifications:** Unread messages light up the TopBar Notification Bell, increment the Dock badge, play subtle audio alerts, and deep-link straight to the conversation when clicked.

### 3.9 Internal Mail & Broadcasts (`mail`)
- Send and receive structured internal mail threads across community members, roles, or units (`getMailRecipientGroups`), approve queued transactional emails in `mail_outbox`, and dispatch official broadcast announcements backed by the community's encrypted SMTP relay.

### 3.10 R&D Projects Showcase (`projects`)
- Browse community-built open-source repositories, research papers, and live demos; filter by technology stack (`tech_stack JSONB`); star favorite projects (`starred_user_ids JSONB`); and link projects directly to the units that engineered them.

### 3.11 Hardware Lab & Inventory (`inventory`)
- Catalog community hardware assets (`inventory_items`: development boards, sensors, GPUs, test equipment) with unique asset codes (e.g., `LAB-RPI-004`).
- Request equipment loans (`status = 'borrowed'`), track due dates (`due_at`), and inspect the chronological checkout ledger (`loan_history JSONB`).

### 3.12 Cryptographic Certificates (`certificates`)
- View and download high-resolution PDF certificates issued for event participation, hackathon victories, or R&D contributions.
- Every certificate carries a unique `verification_code` (e.g., `ORB-2026-X9A-4021`) and QR code that anyone can verify publicly at `/verify`.

### 3.13 Community News (`news`)
- Read official community announcements, release notes, and engineering blog posts (`news_posts`).
- Managers can author Markdown articles with three visibility tiers: **Draft (`'draft'`)**, **Members Only (`'members_only'`)**, and **Published (`'published'` — syndicated via `/api/public/v1/news`)**.

### 3.14 Personal Workspace Notes (`notes`)
- Create personal Markdown notes, organize them into color-coded folders (`folder_name`, `folder_color`), tag and pin important checklists, and restore deleted notes from the trash.

### 3.15 Governance & Committees (`decisions`)
- Manage decision-making bodies (`units` with `unit_type IN ('committee', 'council')`), configure member voting weights (`unit_members.voting_weight`) and quorums, schedule meetings, launch governance polls (`polls` with `scope_type = 'governance'`), and publish official resolutions and minutes (`governance_records`).

### 3.16 System Settings (`settings`)
- **Personal Tabs (Available to Everyone):** Profile & Avatar, Password, TOTP 2FA & FIDO2 Passkeys, Legal Consent History & Data Export (`user_consents`), Theme & Wallpaper Studio (`orbit_theme`), Audio Preferences (`orbit_sound`), and Language (`orbit_locale`).
- **Administrative Tabs (`settings: 'manage'`):**
  - **Organization Identity:** Configure Archetype, Parent Entity (`tetha42`), Organization Name, Primary Domain, and signatory titles in `organization_settings`.
  - **Membership Policy & Form Designer:** Configure registration modes, cooldowns, and custom fields (`form_schemas` with `translations JSONB`).
  - **Legal Documents:** Manage versioned Terms, Privacy Policy, and Charters (`legal_documents` with automatic `version_history JSONB` archiving).
  - **Roles & Permissions (RBAC Designer):** Create custom roles (`roles`), toggle mandatory 2FA (`require_2fa`), and assign `'none' | 'use' | 'manage'` across all 16 user-facing mini-apps.
  - **OAuth 2.0 Applications:** Register third-party apps (`oauth_clients`) for "Sign in with Orbit".
  - **Mail & SMTP Relay:** Configure AES-256-GCM encrypted SMTP server settings (`organization_settings.smtp_config`) and send test emails.

---

## 4. Community Governance, Roles & Audit Transparency

### Official Resolutions & Governance Ledger (`governance_records`)
Committees, councils, and boards can draft, number (`reference_no` e.g., `2026-001`), lock (`is_locked = true`), and publish official governance resolutions, proposals, and meeting minutes. Publicly verifiable resolutions (`is_public = true`) can be validated by anyone at `/verify`.

### Role Hierarchy & Safety Guardrails
- **Custom Roles Without Code:** Administrators can create any number of custom roles (e.g., *Core Maintainer, Squad Lead, Security Analyst, Treasury Auditor, Member, Alumni*).
- **Zero Privilege Escalation:** You can never create a role or assign a permission level higher than what your own role holds.
- **Last-Admin Safety Lock:** Orbit prevents the last active `'role_admin'` from being demoted, deactivated, or deleted.

---

## 5. Standalone Public Portals (`/setup`, `/verify`, `/checkin`, `/oauth/authorize`)

Orbit provides four clean, high-contrast standalone portals accessible without loading the full desktop shell:

1. **`/setup`:** First-run Zero-Config Setup Wizard (automatically locks once initial setup is complete).
2. **`/verify`:** Public verification portal where employers, institutions, or community members can enter a certificate `verification_code` or governance `reference_no` (`/verify/ORB-2026-...`) to verify its cryptographic authenticity.
3. **`/checkin`:** Fast mobile/desktop event attendance portal for scanning event QR codes or entering 6-digit check-in codes.
4. **`/oauth/authorize`:** Standards-compliant OAuth 2.0 / OIDC authorization screen allowing members to sign in to external community tools using their Orbit identity.
