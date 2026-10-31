# Orbit Community OS — Day-2 Operations, SoC Monitoring & SRE Runbook

This runbook covers Day-2 operations for **Orbit Community OS** by **tetha42**: continuous security monitoring with **SoC Pro Studio**, DEFCON 1–5 posture management, Emergency Lockdown recovery, File Integrity Monitoring (FIM) baseline maintenance, database health checks, and backup/restore procedures.

---

## Table of Contents

1. [Health Checks & Readiness Probes (`/api/healthz` & `/api/kurulum`)](#1-health-checks--readiness-probes-apihealthz--apikurulum)
2. [Autonomous SoC Pro Studio Monitoring](#2-autonomous-soc-pro-studio-monitoring)
3. [DEFCON 1–5 Posture Management & Emergency Lockdown Recovery](#3-defcon-15-posture-management--emergency-lockdown-recovery)
4. [SOAR Incident Response Playbooks](#4-soar-incident-response-playbooks)
5. [File Integrity Monitoring (FIM) Operations](#5-file-integrity-monitoring-fim-operations)
6. [Database Maintenance, Pool Tuning & Audit Retention](#6-database-maintenance-pool-tuning--audit-retention)
7. [Backup, Restore & Disaster Recovery Runbook](#7-backup-restore--disaster-recovery-runbook)
8. [Troubleshooting Common Operational Scenarios](#8-troubleshooting-common-operational-scenarios)

---

## 1. Health Checks & Readiness Probes (`/api/healthz` & `/api/kurulum`)

### Container & Load Balancer Liveness Probe
Docker Compose (`docker-compose.yml`), Kubernetes, and reverse proxies monitor instance availability via HTTP probes against port `3000`:

```bash
# Check HTTP health & database connectivity
curl -fsS http://127.0.0.1:3000/api/healthz | jq .

# Inspect database connectivity & setup readiness
curl -s http://127.0.0.1:3000/api/kurulum | jq .
```

### Readiness Response Payload (`GET /api/kurulum`)
```json
{
  "hazir": true,
  "step": "ready",
  "dbStatus": {
    "connected": true,
    "configured": true,
    "databaseName": "orbit"
  },
  "brand": {
    "studioName": "tetha42",
    "communityName": "Orbit Community",
    "domain": "orbit.local"
  }
}
```
- When `hazir: true` and `dbStatus.connected: true`, PostgreSQL 16 is online, all 45 schema tables are initialized, and at least one active `Admin` account exists.
- Inside **SoC Pro Studio → Testbench Lab**, operators can also trigger the **System Health & Security Diagnostic Suite** (`POST /api/soc/testbench`) to verify PostgreSQL pool latency, SSE stream delivery, WAF signature engines, and OAuth 2.0 cryptographic keys.

---

## 2. Autonomous SoC Pro Studio Monitoring

Operators with `soc: kullan` or `soc: yonet` permissions can open **SoC Pro Studio** from the Dock to monitor community infrastructure in real time:

1. **Live Threat Radar & SIEM Stream (`/api/soc/stream`):**
   - Displays a 24-hour threat histogram, active IP quarantines (`guvenlik_engelleri`), authentication anomalies (`SESSION_IP_MISMATCH`), and WAF blocks (`sistem_loglari`).
   - High-frequency telemetry bursts are automatically buffered via `requestAnimationFrame` (`SocContext.tsx`) so the operator UI remains responsive at 60/120fps even during active attack waves.
2. **AI & Recon Canary Honeypot Telemetry:**
   - Tracks automated scanners and rogue bots probing deceptive paths (`/.env`, `/wp-login.php`, `/.git/config`). Any IP hitting a Canary route receives an automatic 100-point threat score and instant quarantine.
3. **Outbound Security Webhooks (`WebhookModal.tsx`):**
   - Operators can configure real-time Discord, Slack, or generic JSON webhooks (`src/lib/server/securityWebhook.ts`) to receive out-of-band alerts whenever a critical incident, Canary trigger, or DEFCON change occurs.
4. **Forensic Dossier Export (`/api/soc/export`):**
   - Export filtered SIEM logs and incident timelines as structured JSON or CSV reports for post-incident review.

---

## 3. DEFCON 1–5 Posture Management & Emergency Lockdown Recovery

### Adjusting DEFCON Levels
From the **SoC Pro Studio** top command bar, administrators (`soc: yonet`) can transition the workspace between **DEFCON 5** (Normal) and **DEFCON 1** (Emergency Lockdown) via `POST /api/soc/playbooks` (`action: 'set_defcon'`).

### What Happens During Emergency Lockdown (DEFCON 1)
When an operator triggers **Emergency Lockdown**:
- All non-administrator sessions are restricted.
- Public member registrations (`/api/auth/register`) and non-essential write endpoints are suspended.
- Active Linux PTY terminal sessions are terminated.
- An immediate SSE broadcast (`orbit_events`) notifies connected clients of the security posture change.

### Recovering from Emergency Lockdown
1. Sign in with an `Admin` account (authenticated via TOTP 2FA or FIDO2 Passkey).
2. Open **SoC Pro Studio** from the Dock.
3. Review open cases in **Incident Manager** (`soc_incidents`) and verify that offending IP addresses are quarantined in **WAF & IP Quarantine**.
4. Click **Lift Lockdown / Restore DEFCON 5** in the SoC toolbar (or send `POST /api/soc/playbooks` with `{ "action": "set_defcon", "level": 5, "lockdown": false }`).

---

## 4. SOAR Incident Response Playbooks

When a compromised account or malicious actor is identified, operators can execute one-click **SOAR Playbooks** (`src/lib/server/soarPlaybooks.ts`) directly from a member's profile card or the SoC Incident view:

| Playbook Action | Operational Effect | Recovery / Reversal |
| :--- | :--- | :--- |
| **Freeze User Session (`revoke_user_sessions`)** | Nullifies `kullanicilar.aktifOturumToken` and pushes `oturum-sonlandi` via SSE to close all active browser tabs | User must re-authenticate with password + 2FA/Passkey |
| **Kill PTY Shells (`kill_terminal_sessions`)** | Sends `SIGKILL` to all active Linux pseudo-terminal processes owned by the user | User must open a new Terminal session (if authorized) |
| **Freeze DB Studio Access (`freeze_db_access`)** | Revokes active `x-db-token` and blocks the account from authenticating into Zero-Trust DB Studio | Execute `unfreeze_db_access` playbook in SoC Pro Studio |
| **Quarantine IP (`ban_ip`)** | Inserts IP into `guvenlik_engelleri` with expiration timestamp | Click **Unban IP** (`unban_ip`) in SoC Pro Studio → IP Quarantine |

---

## 5. File Integrity Monitoring (FIM) Operations

Orbit includes a standalone Go scanner (`tools/bin/fim-scanner`, source at `tools/fim/main.go`) that verifies SHA-256 checksums of application code against `tools/fim/baseline.json`.

### Running an On-Demand FIM Scan
1. Open **SoC Pro Studio → Blue Team / FIM**.
2. Click **Run Integrity Scan** (`POST /api/soc/inspection`).
3. Inspect any modified, added, or deleted files using the built-in **Unified Diff Inspector**.

### Updating the FIM Baseline After Legitimate Deployments
Whenever you deploy legitimate code changes in bare-metal environments, regenerate the cryptographic baseline:
```bash
npm run build:fim
```

---

## 6. Database Maintenance, Pool Tuning & Audit Retention

### Connection Pool Sizing
By default, `getPgPool()` (`src/db/index.ts`) maintains up to `30` concurrent PostgreSQL connections (`idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`), which comfortably serves 150+ concurrent SSE and REST users. To adjust the pool ceiling for high-density deployments, set `DATABASE_POOL_MAX` (clamped between `5` and `100`), ensuring it remains below PostgreSQL's `max_connections`.

### Automated Governance Audit Retention (`denetimBakiminiBaslat`)
- `src/db/audit.ts` automatically runs a daily background cleanup task that purges `denetim_kaydi` rows older than **730 days** (configurable via `AUDIT_RETENTION_DAYS`, minimum `30` days).
- Interactive SQL inspection can be performed safely via **DB Studio** (requires 2FA `x-db-token`) or via CLI:
  ```bash
  make db-shell
  ```

---

## 7. Backup, Restore & Disaster Recovery Runbook

### Creating a Production Database Backup
Run the built-in backup target before any major upgrade or role restructuring:
```bash
make db-backup
```
This creates a timestamped SQL dump inside `./backups/` (`infra/scripts/db-backup.sh`).

### Backing Up Uploaded Receipts & Media
Uploaded treasury receipts (`fisFotoUrl`) and profile photos reside in `/app/data/uploads` (the `orbit-uploads` Docker volume or `./data/uploads` on bare metal):
```bash
tar -czf backups/orbit_uploads_$(date +%Y%m%d_%H%M%S).tar.gz data/uploads/
```

### Full Disaster Recovery Procedure
1. Launch a clean Orbit stack: `make up` (or `docker compose up -d`).
2. Restore the PostgreSQL dump into `orbit-db`:
   ```bash
   cat backups/orbit_backup_<TIMESTAMP>.sql | docker exec -i orbit-db psql -U orbit -d orbit
   ```
3. Extract the uploads archive into `./data/uploads` (or the `orbit-uploads` volume).
4. Restart the application container so in-memory caches sync with the restored database:
   ```bash
   docker compose restart app
   ```

---

## 8. Troubleshooting Common Operational Scenarios

### 1. Administrator Locked Out due to IP Change (`401 SESSION_IP_MISMATCH`)
- **Cause:** The **Pass-the-Cookie Shield** detected that the client's network IP changed mid-session (e.g., switching from Wi-Fi to cellular VPN) and automatically invalidated the session token.
- **Resolution:** Simply sign in again at `/`. A fresh login binds the new session token to your current IP address.

### 2. Administrator Cannot Open Mini-Apps (`403 2FA_SETUP_REQUIRED`)
- **Cause:** The user's role (`Admin` or a custom role with `ikiAdimZorunlu = 1`) mandates Two-Factor Authentication, which has not yet been activated on the account.
- **Resolution:** Open **System Settings** (always accessible even when 2FA is pending), navigate to **Security & 2FA**, and enroll a TOTP authenticator app or FIDO2 Passkey.

### 3. Developer / Operator IP Accidentally Quarantined by Canary Honeypot
- **Cause:** Probing `/.env` or `/wp-login.php` during security testing triggered an automatic 100-point Canary quarantine in `guvenlik_engelleri`.
- **Resolution:** Another administrator can unban the IP in **SoC Pro Studio → WAF & Quarantine**, or an operator with host shell access can clear the IP directly via `make db-shell`:
  ```sql
  DELETE FROM guvenlik_engelleri WHERE ip = '<YOUR_IP_ADDRESS>';
  ```
