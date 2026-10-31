# Orbit Community OS — Zero-Config Self-Hosting & Production Deployment Guide

**Orbit Community OS** by **tetha42** is engineered for frictionless self-hosting. It requires **zero `.env` or `config.ini` files** in the repository to build or boot. Operators simply clone the repository, start the containers or Node.js process, and complete all configuration—PostgreSQL connection binding, Studio & Community identity, initial super-administrator creation, SMTP relay encryption, and OAuth 2.0 setup—directly from the **Web UI Setup Wizard (`/setup`)** and **System Settings**.

---

## Table of Contents

1. [Deployment Philosophy: Zero Config Files](#1-deployment-philosophy-zero-config-files)
2. [Option A: Docker Compose Deployment (Recommended)](#2-option-a-docker-compose-deployment-recommended)
3. [Option B: Bare-Metal Node.js 22+ & PM2 Deployment](#3-option-b-bare-metal-nodejs-22--pm2-deployment)
4. [First-Run Web Onboarding (`/setup`)](#4-first-run-web-onboarding-setup)
5. [Reverse Proxy Configuration (Caddy & Nginx)](#5-reverse-proxy-configuration-caddy--nginx)
6. [TLS, HTTPS & WebAuthn Passkey Requirements](#6-tls-https--webauthn-passkey-requirements)
7. [Persistent Storage & Volume Architecture](#7-persistent-storage--volume-architecture)
8. [Zero-Downtime Upgrades & Container Registry Releases](#8-zero-downtime-upgrades--container-registry-releases)

---

## 1. Deployment Philosophy: Zero Config Files

Traditional self-hosted platforms force operators to manually copy `.env.example` files, generate cryptographic hex secrets via CLI tools, and debug environment variable typos before the server will even start.

Orbit Community OS eliminates this friction:
- **Boot Without Pre-Existing Config Files:** If no database is configured or reachable on first boot, Orbit starts cleanly and serves the interactive **Setup Wizard (`/setup`)**.
- **Runtime Pool Binding (`reconfigurePgPool`):** The PostgreSQL connection string entered in the Setup Wizard is tested live (`SELECT 1`), bound to the running Node.js pool, and immediately used to initialize all 45 database tables.
- **Database-Persisted System Configuration (`sistem_ayarlari`):** Studio name (`tetha42`), Community name (`Orbit Community`), primary domain, leadership titles, default member role, and AES-256-GCM encrypted SMTP credentials live directly inside PostgreSQL and can be updated anytime from **System Settings**.

---

## 2. Option A: Docker Compose Deployment (Recommended)

The root [`docker-compose.yml`](../docker-compose.yml) (and [`infra/docker/docker-compose.yml`](../infra/docker/docker-compose.yml)) provisions a production-ready **PostgreSQL 16 Alpine** database (`orbit-db`) and the **Orbit Community OS** server (`orbit-app`) with built-in health checks and persistent volumes.

### Step 1: Clone & Launch
```bash
git clone https://github.com/tetha42/orbit.git
cd orbit
docker compose up -d --build
```
*(Alternatively, use the Makefile shortcut: `make up`.)*

### Step 2: Verify Container Health
```bash
docker compose ps
```
Both `orbit-db` (`pg_isready` healthcheck) and `orbit-app` (`http://127.0.0.1:3000/` healthcheck) will transition to `healthy` within seconds.

### Step 3: Complete Onboarding in the Browser
Navigate to `http://localhost:3000` (or your public domain) to finish setup in the browser at `/setup`.

---

## 3. Option B: Bare-Metal Node.js 22+ & PM2 Deployment

If you prefer running Orbit directly on a Linux host alongside an existing PostgreSQL 16 server:

### Prerequisites
- **Node.js:** `v22.x` LTS or newer
- **Package Manager:** `npm` or `pnpm` (`v10+`)
- **Database:** PostgreSQL 16 running locally or over a private VPC

### Step 1: Install, Build & Start
```bash
git clone https://github.com/tetha42/orbit.git
cd orbit

# Install dependencies, generate app registries, and build production bundle
npm install
npm run build

# Start production server on port 3000
npm start
```

### Step 2: Daemonize with PM2 (Production Process Manager)
```bash
npm install -g pm2
pm2 start npm --name "orbit-os" -- start
pm2 save
pm2 startup
```

---

## 4. First-Run Web Onboarding (`/setup`)

When visiting a fresh instance at `/` or `/setup` (`/kurulum`), Orbit presents a high-contrast, standalone **5-Step Setup Wizard**:

1. **Step 1 — PostgreSQL Database Connection & Auto-Detection:**
   - **Auto Database Detection:** Orbit automatically probes whether PostgreSQL is running locally on the host, inside Docker Compose, or over internal container networks (`orbit-db`). If detected, click **"Use This DB"** to connect instantly.
   - **Docker Database Quickstart:** If no PostgreSQL instance exists, the wizard provides a 1-click copyable Docker command to spin up an isolated PostgreSQL 16 container:
     ```bash
     docker run --name orbit-postgres -e POSTGRES_DB=orbit -e POSTGRES_USER=orbit -e POSTGRES_PASSWORD=<your-password> -p 127.0.0.1:5432:5432 -d postgres:16-alpine
     ```
   - **Custom Connection URI:** Alternatively, enter any custom PostgreSQL connection URI and click **Test Database Connection** (`POST /api/setup/test-db`) to verify connectivity.
2. **Step 2 — Studio & Community Identity + Reverse Proxy Assistant:**
   - Configure **Studio Name** (default: `tetha42`), **Community Name** (default: `Orbit Community`), and **Primary Domain (FQDN)** (e.g., `orbit.example.com`).
   - **Interactive Reverse Proxy Assistant:** Click **"Domain & Reverse Proxy Assistant"** in the wizard to view, copy, or download pre-tuned **Nginx** and **Caddy** configurations. These configurations include mandatory SSE streaming rules (`proxy_buffering off; chunked_transfer_encoding off;`) and WebSocket upgrade headers.
3. **Step 3 — Initial Super-Administrator:**
   - Enter the administrator's First Name, Last Name, Email Address, and a strong password (minimum 12 characters).
4. **Step 4 — Outbound SMTP Relay (Optional):**
   - Provide your SMTP host, port (`465` or `587`), username, password, and sender address (credentials are AES-256-GCM encrypted in `system_settings`), or skip to configure later in **System Settings → Mail & SMTP**.
5. **Step 5 — Complete & Launch Desktop:**
   - Clicking **Complete Setup** initializes all 45 tables, creates the `Admin` account under a transactional advisory lock, seeds the default `Orbit General` chat room, sets an `HttpOnly` session cookie, and transitions straight into the Orbit Web-Desktop.
   - **Enroll 2FA Immediately:** Because the built-in `Admin` role enforces mandatory 2FA (`ikiAdimZorunlu = 1`), open **System Settings → Security** upon first login to enroll a TOTP authenticator app or FIDO2 Passkey.

---

## 5. Reverse Proxy Configuration (Caddy & Nginx)

Orbit Community OS uses three long-lived **Server-Sent Events (SSE)** streams (`/api/olaylar`, `/api/chat/stream`, and `/api/soc/stream`). Your reverse proxy **must disable response buffering** on SSE routes and forward accurate client IP headers (`X-Real-IP` / `X-Forwarded-For`) so the **Pass-the-Cookie IP Shield** and **SoC Threat Radar** see real client addresses.

### Option 1: Caddy (`infra/docker/Caddyfile` — Automatic Let's Encrypt HTTPS)

Caddy automatically provisions and renews Let's Encrypt TLS certificates and disables buffering on event streams:

```caddyfile
orbit.example.com {
	request_body {
		max_size 10MB
	}

	# Disable proxy buffering for real-time SSE streams
	handle /api/olaylar* {
		reverse_proxy 127.0.0.1:3000 {
			flush_interval -1
			header_up Host {host}
			header_up X-Real-IP {client_ip}
			header_up X-Forwarded-Proto {scheme}
		}
	}

	handle {
		encode zstd gzip
		reverse_proxy 127.0.0.1:3000 {
			header_up Host {host}
			header_up X-Real-IP {client_ip}
			header_up X-Forwarded-Proto {scheme}
		}
	}

	header {
		X-Content-Type-Options "nosniff"
		X-Frame-Options "SAMEORIGIN"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(self), microphone=(), geolocation=()"
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		-Server
	}
}
```

### Option 2: Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name orbit.example.com;

    ssl_certificate     /etc/letsencrypt/live/orbit.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/orbit.example.com/privkey.pem;

    client_max_body_size 10M;

    # Real-Time SSE Endpoints (No Buffering)
    location ~ ^/api/(olaylar|chat/stream|soc/stream) {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 86400s;
    }

    # Standard Application & API Traffic
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. TLS, HTTPS & WebAuthn Passkey Requirements

1. **HTTPS Is Mandatory in Production:** Browser security specifications require a secure context (`https://` or `http://localhost`) for **WebAuthn Passkeys**, **Camera QR Scanning** (`/checkin`), and **`Secure` Session Cookies**.
2. **Relying Party Automatic Resolution:** Orbit automatically derives the WebAuthn Relying Party ID (`rpID`) and Expected Origin from the incoming `Host` / `X-Forwarded-Proto` headers or the primary domain configured in `/setup` (`sistem_ayarlari.kulup_domain`).

---

## 7. Persistent Storage & Volume Architecture

| Data Asset | Container Path / Volume | Backup Strategy |
| :--- | :--- | :--- |
| **PostgreSQL 16 Database** | `/var/lib/postgresql/data` (`orbit-pgdata` volume) | `make db-backup` (`pg_dump` SQL snapshots in `./backups/`) |
| **Uploaded Receipts & Avatars** | `/app/data/uploads` (`orbit-uploads` volume / `./data/uploads`) | Incremental filesystem or volume snapshot |
| **Custom Branding & Wallpapers** | `/app/data/custom` (`orbit-custom` volume / `./data/custom`) | Volume snapshot; metadata lives in `system_settings`, `custom_wallpapers`, `legal_documents`, `form_fields` and `member_field_values` |
| **Client Window Layout & Theme** | Browser `IndexedDB` (`macos_workspace_db`) & `localStorage` | Ephemeral client UI state (zero sensitive domain data) |

---

## 8. Zero-Downtime Upgrades & Container Registry Releases

To update a running Docker Compose deployment to the latest release published by **tetha42**:

```bash
# 1. Create a pre-upgrade SQL backup
make db-backup

# 2. Pull the latest container image and recreate the app container
make update
# (Equivalent to: docker compose pull && docker compose up -d)
```

### Customisation persistence

Production customisations are split deliberately:

- **Structured configuration** (site identity, legal documents, custom member fields, custom wallpapers, member field values) lives in PostgreSQL and therefore travels with the `orbit-pgdata` volume.
- **Binary customisations** (uploaded site icon and custom wallpaper images) live under `ORBIT_CUSTOM_DIR` (`/app/data/custom` in Docker), mounted as the `orbit-custom` named volume.
- If a custom image or setting is absent, the application falls back to the compile-time defaults shipped in the image. A redeploy therefore never overwrites operator customisations.

On startup, `ensurePostgresInit()` automatically applies any new idempotent schema additions (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) while preserving all existing community data.
