# Orbit Community OS — User & Administrator Guide

Welcome to **Orbit Community OS** by **tetha42**—your collaborative web-desktop and digital community operating system. This handbook walks community members, R&D squad leads, and administrators through registration, desktop navigation, all **15 integrated mini-applications**, and community governance.

---

## Table of Contents

1. [Getting Started: Registration, Member ID / Handle & Sign-In](#1-getting-started-registration-member-id--handle--sign-in)
2. [Navigating the Orbit Web-Desktop & Mobile Shell](#2-navigating-the-orbit-web-desktop--mobile-shell)
3. [Guide to All 15 Mini-Applications](#3-guide-to-all-15-mini-applications)
   - [3.1 SoC Pro Studio (`soc`)](#31-soc-pro-studio-soc)
   - [3.2 Events & QR Check-In (`events`)](#32-events--qr-check-in-events)
   - [3.3 R&D Teams & Kanban Boards (`teams`)](#33-rd-teams--kanban-boards-teams)
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
   - [3.15 System Settings (`settings`)](#315-system-settings-settings)
4. [Community Governance, Roles & Audit Transparency](#4-community-governance-roles--audit-transparency)
5. [Standalone Public Portals (`/setup`, `/verify`, `/checkin`, `/oauth/authorize`)](#5-standalone-public-portals-setup-verify-checkin-oauthauthorize)

---

## 1. Getting Started: Registration, Member ID / Handle & Sign-In

### First-Run Instance Setup (`/setup`)
If you are the founder or systems operator launching a brand-new Orbit Community OS instance, visiting `/` automatically opens the **5-Step Web UI Setup Wizard (`/setup`)**, where you connect PostgreSQL, define your Studio (`tetha42`) and Community identity, and create the initial super-administrator account with zero configuration files required.

### Member Registration
Prospective members can apply for membership directly from the sign-in portal (`/`):
1. Click **Create Account / Apply for Membership**.
2. Complete your profile details:
   - **First Name & Last Name**
   - **Email Address**
   - **Member ID / Handle:** Your unique community handle or identifier (e.g., `@ada`, `ORB-4021`, or contributor ID).
   - **Discipline / Engineering Track & Experience Level:** Select your primary focus area (e.g., *Distributed Systems, Cybersecurity, AI & Machine Learning, Embedded & Robotics, Frontend Architecture*).
   - **Password:** Choose a strong password (minimum 12 characters recommended).
3. Review and accept the **Community Charter / Terms of Service** and **GDPR Privacy Policy**, then submit your application.
4. Once approved by a community administrator (or immediately if auto-enrollment is configured), you can sign in and access all applications granted to your role.

### Enrolling Two-Factor Authentication (TOTP 2FA) & Passkeys
- Open **System Settings → Security & 2FA**.
- **Authenticator App (TOTP):** Scan the QR code using 1Password, Apple Passwords, Google Authenticator, or Authy, enter the 6-digit code, and save your **8 single-use recovery codes** in a safe place.
- **Passkeys (WebAuthn / FIDO2):** Click **Register Passkey** to bind Touch ID, Face ID, Windows Hello, or a hardware YubiKey for one-tap passwordless sign-in.
- *Note:* If your assigned role mandates 2FA (such as `Admin` or `Core Board`), Orbit restricts workspace access solely to **System Settings** until you enable 2FA.

---

## 2. Navigating the Orbit Web-Desktop & Mobile Shell

### Desktop Interface
- **Application Dock (Bottom):** Click any icon to launch or focus its window. Hovering over an icon prefetches the application in the background for zero-latency launch. Unread badges appear automatically on apps like **Chat** and **Mail**.
- **TopBar (Top):**
  - **Left:** Orbit system menu (Lock Screen, Refresh All Data, About, Sign Out) and contextual menus for the currently focused application.
  - **Right:** Language switcher (`EN` / `TR`), Spotlight Search (`⌘K` / `Ctrl+K`), Sound & Theme quick controls, and the **Notification Center** bell.
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

## 3. Guide to All 15 Mini-Applications

Note that your Dock and Launcher only display applications where your role grants at least **Use (`kullan`)** or **Manage (`yonet`)** access.

### 3.1 SoC Pro Studio (`soc`)
The autonomous cybersecurity command center for community infrastructure:
- **Threat Radar & DEFCON Control:** Monitor real-time attack telemetry and adjust readiness between **DEFCON 5** (Normal) and **DEFCON 1** (Emergency Lockdown).
- **SIEM Log Analyzer:** Filter `sistem_loglari` by service (`security`, `auth`, `waf`), severity, IP address, or time window, and export forensic dossiers.
- **Blue Team / FIM:** Run Go-powered File Integrity Monitoring scans and inspect unified diffs of any modified system files.
- **SOAR Playbooks:** One-click session revocation, Linux PTY terminal termination, Zero-Trust DB access freeze, and IP quarantine management.
- **Testbench Lab:** Simulate OAuth 2.0 PKCE flows, WAF payloads, and health diagnostics.

### 3.2 Events & QR Check-In (`events`)
- **Members (`kullan`):** Browse upcoming workshops, seminars, hackathons, and general assemblies; RSVP with one click (or self-cancel your registration if your plans change); check in at the venue by scanning the event QR code or entering the 6-digit short code at `/checkin`.
- **Managers (`yonet`):** Create and publish events, set capacity limits, open live QR / 6-digit check-in screens, and record manual attendance.

### 3.3 R&D Teams & Kanban Boards (`teams`)
- **Squad Discovery:** Explore active engineering and research squads, view open seats (`kontenjan`), and submit membership applications with a personal note.
- **Multi-Column Kanban Board:** Create tasks across *Backlog (`beklemede`)*, *In Progress (`suruyor`)*, *Review (`inceleme`)*, and *Done (`tamamlandi`)*.
- **Task Details & XP:** Open any card to manage sub-task checklists, post comments, inspect the activity timeline, and earn **XP** automatically when tasks reach completion.
- **Team Sub-Treasury:** Squad leads can manage their team's dedicated budget ledger directly.

### 3.4 Member Directory (`members`)
- **Members (`kullan`):** Search the active community roster by name, **Member ID / Handle**, discipline, or squad; view member profiles, XP rankings, and attendance counts.
- **Managers (`yonet`):** Review and approve/reject pending membership applications, assign roles, update member statuses (`aktif` / `mezun`), and export roster reports.

### 3.5 Budget & Treasury Ledgers (`budget`)
- **Transparent Community Finance:** Tracks both the **General Community Vault** and individual **R&D Team Sub-Vaults**.
- **Members (`kullan`):** Inspect income and expense entries, category breakdowns, and inter-vault allocations in read-only mode.
- **Managers (`yonet`) & Team Leads:** Record income/expense transactions, attach receipt images/PDFs (`fisFotoUrl`), and transfer funds atomically between the General Vault and Team Sub-Vaults.

### 3.6 Zero-Trust Database Studio (`database`)
- Restricted to administrators with `database: yonet` and protected by a secondary live 2FA challenge (`x-db-token`).
- Browse all 45 PostgreSQL tables, inspect column types and foreign keys, edit rows safely, run parameterized SQL queries, and review the dedicated database audit log.

### 3.7 Sandboxed Linux Terminal (`terminal`)
- Full Xterm.js pseudo-terminal connected to a sandboxed shell environment for authorized infrastructure operators (`terminal: kullan` / `yonet`).
- Integrated with SoC Pro Studio so active shell sessions can be monitored and terminated immediately if anomalous activity is detected.

### 3.8 Real-Time Chat (`chat`)
- **Channels & Rooms:** Participate in community-wide channels (`Orbit General`), R&D team rooms, 1-on-1 Direct Messages, and Group DMs.
- **Rich Collaboration:** Create interactive multi-option polls, react with emojis, reply to threads, forward messages, and see live typing indicators.
- **4-Tier Notifications:** Unread messages light up the TopBar Notification Bell, increment the Dock badge, play subtle audio alerts, and deep-link straight to the conversation when clicked.

### 3.9 Internal Mail & Broadcasts (`mail`)
- Send and receive structured internal mail threads across community members or role groups, and dispatch official broadcast announcements backed by the community's encrypted SMTP relay.

### 3.10 R&D Projects Showcase (`projects`)
- Browse community-built open-source repositories, research papers, and live demos; filter by technology stack; star favorite projects; and link projects directly to the R&D Teams that engineered them.

### 3.11 Hardware Lab & Inventory (`inventory`)
- Catalog community hardware assets (development boards, sensors, GPUs, test equipment) with unique asset codes (e.g., `LAB-RPI-004`).
- Request equipment loans, track due dates (`iadeTarihi`), extend active loans, and log returns or maintenance states.

### 3.12 Cryptographic Certificates (`certificates`)
- View and download high-resolution PDF certificates issued for event participation, hackathon victories, or R&D contributions.
- Every certificate carries a unique verification code (e.g., `ORB-2026-X9A-4021`) and QR code that anyone can verify publicly at `/verify`.

### 3.13 Community News (`news`)
- Read official community announcements, release notes, and engineering blog posts.
- Managers can author Markdown articles with three visibility tiers: **Draft (`taslak`)**, **Members Only (`uyeler`)**, and **Public (`yayinda` — syndicated via `/api/public/v1/news`)**.

### 3.14 Personal Workspace Notes (`notes`)
- Create personal Markdown notes, organize them into color-coded folders, pin important checklists to the top, and restore deleted notes from the trash.

### 3.15 System Settings (`settings`)
- **Personal Tabs (Available to Everyone):** Profile & Avatar, Password, TOTP 2FA & FIDO2 Passkeys, Theme & Wallpaper Studio (Light/Dark/System, 6 Accent Colors, Frosted Glass toggle, Reduced Motion), Audio Preferences, and Language (`English` / `Turkish`).
- **Administrative Tabs (`settings: yonet`):**
  - **Community Identity:** Configure Studio name (`tetha42`), Community name, Primary Domain, and signatory titles live at runtime.
  - **Roles & Permissions (RBAC Designer):** Create custom roles with custom badge colors, toggle mandatory 2FA, and assign `None` / `Use` / `Manage` across all 15 mini-apps.
  - **OAuth 2.0 Applications:** Register third-party apps (`client_id`, `client_secret`, `redirect_uris`, scopes) for "Sign in with Orbit".
  - **Mail & SMTP Relay:** Configure AES-256-GCM encrypted SMTP server settings and send test emails.
  - **Governance Audit Log (`denetim_kaydi`):** Inspect the complete before/after history of every administrative action.

---

## 4. Community Governance, Roles & Audit Transparency

### Official Resolutions & Governance Ledger (`kararlar`)
Community boards can draft, number (`YYYYnnn`), lock, and publish official governance resolutions and meeting minutes. Publicly verifiable resolutions can also be validated via `/verify`.

### Role Hierarchy & Safety Guardrails
- **Custom Roles Without Code:** Administrators can create any number of custom roles (e.g., *Core Maintainer, R&D Lead, Security Analyst, Treasury Auditor, Member, Contributor*).
- **Zero Privilege Escalation:** You can never create a role or assign a permission level higher than what your own role holds.
- **Last-Admin Safety Lock:** Orbit prevents the last active administrator from being demoted, deactivated, or deleted.

---

## 5. Standalone Public Portals (`/setup`, `/verify`, `/checkin`, `/oauth/authorize`)

Orbit provides four clean, high-contrast standalone portals accessible without loading the full desktop shell:

1. **`/setup` (`/kurulum`):** First-run Zero-Config Setup Wizard (automatically locks once initial setup is complete).
2. **`/verify` (`/dogrula`):** Public verification portal where employers, institutions, or community members can enter a certificate or governance document code (`/dogrula/ORB-2026-...`) to verify its cryptographic authenticity.
3. **`/checkin` (`/yoklama`):** Fast mobile/desktop event attendance portal for scanning event QR codes or entering 6-digit check-in codes.
4. **`/oauth/authorize`:** Standards-compliant OAuth 2.0 / OIDC authorization screen allowing members to sign in to external community tools using their Orbit identity.
