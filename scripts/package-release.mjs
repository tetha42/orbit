#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

async function main() {
	// 1. Determine version
	let version = process.argv[2];
	if (!version) {
		const pkgRaw = await fs.readFile(path.join(ROOT_DIR, 'package.json'), 'utf8');
		const pkg = JSON.parse(pkgRaw);
		version = `v${pkg.version || '1.0.0'}`;
	}
	if (!version.startsWith('v')) {
		version = `v${version}`;
	}

	console.log(`\n📦 [Release Packager] Orbit Community OS Version: ${version}`);

	const DIST_DIR = path.join(ROOT_DIR, 'dist-release');
	const DOCKER_BUNDLE_NAME = `orbit-os-${version}-docker`;
	const STANDALONE_BUNDLE_NAME = `orbit-os-${version}-standalone`;

	const STAGING_DOCKER = path.join(DIST_DIR, 'staging', DOCKER_BUNDLE_NAME);
	const STAGING_STANDALONE = path.join(DIST_DIR, 'staging', STANDALONE_BUNDLE_NAME);

	// Clean previous build
	await fs.rm(DIST_DIR, { recursive: true, force: true });
	await fs.mkdir(STAGING_DOCKER, { recursive: true });
	await fs.mkdir(STAGING_STANDALONE, { recursive: true });

	// =========================================================================
	// BUNDLE 1: Docker Deployment Bundle (Zero-Config docker-compose + Makefile)
	// =========================================================================
	console.log(`\n🔹 [Bundle 1/2] Preparing Docker deployment bundle...`);

	const standaloneCompose = `# ===========================================================================
# Orbit Community OS by tetha42 — Production Deployment Stack (Docker Compose)
# Version: ${version}
# ===========================================================================
#
# Quick Start (Zero-Config):
#   make up
#   or: docker compose up -d
#
# Host Caddy Reverse Proxy Configuration (Caddyfile):
#   orbit.example.com {
#       reverse_proxy 127.0.0.1:3000
#   }
# ===========================================================================

services:
  db:
    image: postgres:16-alpine
    container_name: orbit-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-orbit}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB:-orbit}
    ports:
      - '127.0.0.1:\${POSTGRES_PORT:-5432}:5432'
    volumes:
      - orbit-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U \${POSTGRES_USER:-orbit} -d \${POSTGRES_DB:-orbit}']
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

  app:
    image: \${ORBIT_IMAGE:-ghcr.io/tetha42/orbit}:\${PORTAL_TAG:-${version}}
    container_name: orbit-app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://\${POSTGRES_USER:-orbit}:\${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}@db:5432/\${POSTGRES_DB:-orbit}
      WEBAUTHN_ORIGIN: \${WEBAUTHN_ORIGIN:-}
      WEBAUTHN_RP_ID: \${WEBAUTHN_RP_ID:-}
      AUTH_SECRET: \${AUTH_SECRET:-}
      BOOTSTRAP_ADMIN_EMAIL: \${BOOTSTRAP_ADMIN_EMAIL:-admin@orbit.local}
      BOOTSTRAP_ADMIN_PASSWORD: \${BOOTSTRAP_ADMIN_PASSWORD:-}
      BOOTSTRAP_ADMIN_AD: \${BOOTSTRAP_ADMIN_AD:-Orbit}
      BOOTSTRAP_ADMIN_SOYAD: \${BOOTSTRAP_ADMIN_SOYAD:-Admin}
      TERMINAL_ENABLED: \${TERMINAL_ENABLED:-0}
      UPLOAD_DIR: /app/data/uploads
      ORBIT_DATA_DIR: /app/data
      ORBIT_CUSTOM_DIR: /app/data/custom
      PUBLIC_API_ALLOWED_ORIGINS: \${PUBLIC_API_ALLOWED_ORIGINS:-http://localhost:3000,http://orbit.local}
      PUBLIC_BASE_URL: \${PUBLIC_BASE_URL:-}
    ports:
      - '\${PORT:-3000}:3000'
    volumes:
      - orbit-uploads:/app/data/uploads
      - orbit-custom:/app/data/custom
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://127.0.0.1:3000/']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

volumes:
  orbit-pgdata:
  orbit-uploads:
  orbit-custom:
`;
	await fs.writeFile(path.join(STAGING_DOCKER, 'docker-compose.yml'), standaloneCompose, 'utf8');

	const standaloneMakefile = `.PHONY: help up down restart logs pull update db-shell db-backup status

CYAN  := \\033[36m
GREEN := \\033[32m
YELLOW:= \\033[33m
RESET := \\033[0m

help:
	@printf "\\n"
	@printf "  $(CYAN)[Orbit Community OS by tetha42 - Docker Operations Menu]$(RESET)\\n\\n"
	@printf "  $(GREEN)make up$(RESET)         Start stack in background (localhost:3000)\\n"
	@printf "  $(GREEN)make down$(RESET)       Stop all services safely\\n"
	@printf "  $(GREEN)make restart$(RESET)    Restart all services\\n"
	@printf "  $(GREEN)make logs$(RESET)       Follow live application and database logs\\n"
	@printf "  $(GREEN)make pull$(RESET)       Pull latest Docker image from GHCR\\n"
	@printf "  $(GREEN)make update$(RESET)     Pull latest release and restart seamlessly\\n"
	@printf "  $(GREEN)make status$(RESET)     List running container status\\n"
	@printf "  $(YELLOW)make db-shell$(RESET)   Open PostgreSQL shell (psql)\\n"
	@printf "  $(YELLOW)make db-backup$(RESET)  Create compressed database backup\\n\\n"

up:
	docker compose up -d
	@echo "✅ Orbit Community OS is running at http://localhost:3000"

down:
	docker compose down
	@echo "🛑 Services stopped."

restart:
	docker compose restart
	@echo "🔄 Services restarted."

logs:
	docker compose logs -f

pull:
	docker compose pull

update:
	docker compose pull
	docker compose up -d
	@echo "🚀 Update complete!"

status:
	docker compose ps

db-shell:
	docker exec -it orbit-db psql -U orbit -d orbit

db-backup:
	@mkdir -p backups
	@docker exec orbit-db pg_dump -U orbit orbit | gzip > backups/backup_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "💾 Backup saved to backups/ directory."
`;
	await fs.writeFile(path.join(STAGING_DOCKER, 'Makefile'), standaloneMakefile, 'utf8');

	const deployMd = `# 🚀 Orbit Community OS — Quick Deployment Guide (Docker)

**Version:** ${version}  
**Default Port:** \`3000\`  
**Configuration:** Zero-config on disk — managed via the Web Setup Wizard (\`/setup\`)

---

## ⚡ 1. Start in 10 Seconds

\`\`\`bash
make up
# or: docker compose up -d
\`\`\`

Then visit \`http://localhost:3000/setup\` to configure your community identity and administrator account.
`;
	await fs.writeFile(path.join(STAGING_DOCKER, 'DEPLOY.md'), deployMd, 'utf8');

	// Copy examples/oauth-client-node
	const examplesDest = path.join(STAGING_DOCKER, 'examples', 'oauth-client-node');
	await fs.mkdir(examplesDest, { recursive: true });
	const exampleFiles = await fs.readdir(path.join(ROOT_DIR, 'examples/oauth-client-node'));
	for (const f of exampleFiles) {
		await fs.copyFile(path.join(ROOT_DIR, 'examples/oauth-client-node', f), path.join(examplesDest, f));
	}

	// =========================================================================
	// BUNDLE 2: Standalone Pre-Built Bundle (No Docker Required)
	// =========================================================================
	console.log(`\n🔹 [Bundle 2/2] Preparing standalone build bundle (server.js + assets)...`);

	const standaloneSrc = path.join(ROOT_DIR, '.next/standalone');
	let hasStandalone = false;
	try {
		await fs.access(standaloneSrc);
		hasStandalone = true;
	} catch {
		console.log('ℹ️  .next/standalone directory not found. Building now (pnpm build)...');
		execSync('pnpm build', { cwd: ROOT_DIR, stdio: 'inherit' });
		hasStandalone = true;
	}

	if (hasStandalone) {
		execSync(`cp -r "${standaloneSrc}"/* "${STAGING_STANDALONE}"/`);
		const staticDest = path.join(STAGING_STANDALONE, '.next', 'static');
		await fs.mkdir(staticDest, { recursive: true });
		execSync(`cp -r "${path.join(ROOT_DIR, '.next/static')}"/* "${staticDest}"/`);
		execSync(`cp -r "${path.join(ROOT_DIR, 'public')}" "${STAGING_STANDALONE}"/public`);
		execSync(`cp -r "${path.join(ROOT_DIR, 'scripts')}" "${STAGING_STANDALONE}"/scripts`);

		const runStandaloneMd = `# ⚡ Orbit Community OS Standalone (Direct Node.js Execution)

This bundle includes the pre-compiled Next.js standalone server and static assets.  
Only **Node.js 20+** and a PostgreSQL instance are required.

## 🚀 Run
\`\`\`bash
export DATABASE_URL="postgresql://user:password@localhost:5432/orbit_db"
export PORT=3000
node server.js
\`\`\`
The application runs directly at \`http://127.0.0.1:3000\`.
`;
		await fs.writeFile(path.join(STAGING_STANDALONE, 'RUN_STANDALONE.md'), runStandaloneMd, 'utf8');
	}

	// =========================================================================
	// ARCHIVING (.tar.gz and .zip)
	// =========================================================================
	const filesToHash = [];

	const dockerTar = path.join(DIST_DIR, `${DOCKER_BUNDLE_NAME}.tar.gz`);
	console.log(`🗜️  Archiving: ${path.basename(dockerTar)}...`);
	execSync(`tar -czf "${dockerTar}" -C "${path.join(DIST_DIR, 'staging')}" "${DOCKER_BUNDLE_NAME}"`);
	filesToHash.push(dockerTar);

	const standaloneTar = path.join(DIST_DIR, `${STANDALONE_BUNDLE_NAME}.tar.gz`);
	console.log(`🗜️  Archiving: ${path.basename(standaloneTar)}...`);
	execSync(`tar -czf "${standaloneTar}" -C "${path.join(DIST_DIR, 'staging')}" "${STANDALONE_BUNDLE_NAME}"`);
	filesToHash.push(standaloneTar);

	try {
		execSync('which zip', { stdio: 'ignore' });
		const dockerZip = path.join(DIST_DIR, `${DOCKER_BUNDLE_NAME}.zip`);
		const standaloneZip = path.join(DIST_DIR, `${STANDALONE_BUNDLE_NAME}.zip`);
		execSync(`cd "${path.join(DIST_DIR, 'staging')}" && zip -rq "${dockerZip}" "${DOCKER_BUNDLE_NAME}"`);
		execSync(`cd "${path.join(DIST_DIR, 'staging')}" && zip -rq "${standaloneZip}" "${STANDALONE_BUNDLE_NAME}"`);
		filesToHash.push(dockerZip, standaloneZip);
	} catch {
		console.log('ℹ️  `zip` command not found; generated .tar.gz archives only.');
	}

	let checksumContent = '';
	for (const f of filesToHash) {
		const buf = await fs.readFile(f);
		const hash = crypto.createHash('sha256').update(buf).digest('hex');
		checksumContent += `${hash}  ${path.basename(f)}\n`;
	}

	const shaFile = path.join(DIST_DIR, `checksums-${version}.sha256`);
	await fs.writeFile(shaFile, checksumContent, 'utf8');

	await fs.rm(path.join(DIST_DIR, 'staging'), { recursive: true, force: true });

	console.log('\n✨ [Release Packager] All release bundles created successfully!');
	console.log('----------------------------------------------------------------------');
	for (const f of filesToHash) {
		const stat = await fs.stat(f);
		console.log(`• ${path.basename(f)} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
	}
	console.log(`• ${path.basename(shaFile)}`);
	console.log('----------------------------------------------------------------------\n');
}

main().catch((err) => {
	console.error('Packaging error:', err);
	process.exit(1);
});
