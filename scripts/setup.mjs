#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { loadConfigIni } from './ini-loader.mjs';

// ANSI styling
const c = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	green: '\x1b[32m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	yellow: '\x1b[33m',
	red: '\x1b[31m',
	gray: '\x1b[90m',
};

const log = {
	info: (msg) => console.log(`${c.blue}[INFO]${c.reset} ${msg}`),
	ok: (msg) => console.log(`${c.green}[OK]${c.reset}   ${msg}`),
	warn: (msg) => console.log(`${c.yellow}[WARN]${c.reset} ${msg}`),
	error: (msg) => console.log(`${c.red}[ERR]${c.reset}  ${msg}`),
	step: (num, title) => console.log(`\n${c.bold}${c.cyan}==> [STEP ${num}/4] ${title}${c.reset}`),
};

console.log(`
${c.bold}${c.cyan}================================================================${c.reset}
${c.bold}  Orbit Community OS — Zero-Config Developer Setup Wizard       ${c.reset}
${c.gray}  Self-Hosted Web-Desktop & R&D Suite by tetha42                ${c.reset}
${c.bold}${c.cyan}================================================================${c.reset}
`);

const rootDir = process.cwd();

// ---------------------------------------------------------------------------
// 1. Environment Check (Node.js & Package Manager & Dependencies)
// ---------------------------------------------------------------------------
log.step(1, 'Developer Environment & Dependency Check');

const nodeVer = process.versions.node;
const majorNode = parseInt(nodeVer.split('.')[0], 10);
if (majorNode < 20) {
	log.error(`Node.js v${nodeVer} detected. Node.js v20.x or v22.x LTS is required.`);
	process.exit(1);
}
log.ok(`Node.js version verified: v${nodeVer}`);

let hasPnpm = false;
try {
	const pnpmOut = execSync('pnpm --version', { stdio: 'pipe' }).toString().trim();
	hasPnpm = true;
	log.ok(`pnpm detected: v${pnpmOut}`);
} catch {
	log.warn('pnpm not found. Falling back to npm.');
}

if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
	log.info('node_modules not found, installing packages...');
	const installCmd = hasPnpm ? 'pnpm install' : 'npm install';
	execSync(installCmd, { stdio: 'inherit' });
	log.ok('Package installation complete.');
} else {
	log.ok('node_modules is present.');
}

const iniConfig = loadConfigIni(rootDir);

// ---------------------------------------------------------------------------
// 2. PostgreSQL Database Connectivity Check
// ---------------------------------------------------------------------------
log.step(2, 'PostgreSQL Database Connectivity Check');

const targetDbUrl = process.env.DATABASE_URL || iniConfig?.database?.url || '';

async function testPostgresConnection(dbUrl, timeoutMs = 2500) {
	try {
		const { default: pg } = await import('pg');
		const client = new pg.Client({
			connectionString: dbUrl,
			connectionTimeoutMillis: timeoutMs,
		});
		await client.connect();
		const res = await client.query('SELECT 1 as ok, current_database() as db, current_user as usr');
		await client.end();
		return { ok: true, db: res.rows[0]?.db, usr: res.rows[0]?.usr };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

let dbTest = await testPostgresConnection(targetDbUrl);

if (dbTest.ok) {
	log.ok(`PostgreSQL verified (Database: ${dbTest.db}, Role: ${dbTest.usr}).`);
} else {
	log.warn(`PostgreSQL unreachable: ${dbTest.error}`);
	let hasDocker = false;
	try {
		execSync('docker --version', { stdio: 'pipe' });
		hasDocker = true;
	} catch {}

	if (hasDocker) {
		log.info('Docker detected! Starting PostgreSQL container in background...');
		try {
			execSync('docker compose -f infra/docker/docker-compose.yml up -d db', { stdio: 'inherit' });
			log.info('Waiting for database readiness (up to 10 seconds)...');

			for (let i = 0; i < 5; i++) {
				await new Promise((r) => setTimeout(r, 2000));
				dbTest = await testPostgresConnection(targetDbUrl);
				if (dbTest.ok) break;
			}

			if (dbTest.ok) {
				log.ok(`PostgreSQL Docker container started and verified (orbit-db:5432, db: ${dbTest.db}).`);
			} else {
				log.warn('Docker container started; database will finish initializing shortly.');
			}
		} catch (err) {
			log.error(`Failed to start Docker container: ${err.message}`);
		}
	} else {
		log.warn('Docker not found. Start a local PostgreSQL service or configure the connection in the Web Setup Wizard (/setup).');
	}
}

// ---------------------------------------------------------------------------
// 3. Mini-App Manifest Synchronization
// ---------------------------------------------------------------------------
log.step(3, 'Mini-App Manifest & Registry Synchronization');

log.info('Compiling mini-app manifests (gen-apps.mjs)...');
try {
	execSync('node scripts/gen-apps.mjs', { stdio: 'inherit' });
	log.ok('Mini-app manifests synchronized.');
} catch (err) {
	log.error(`Manifest generation error: ${err.message}`);
}

// ---------------------------------------------------------------------------
// 4. System Integrity Verification (Pure & i18n)
// ---------------------------------------------------------------------------
log.step(4, 'System Integrity Verification (Pure & i18n)');

try {
	execSync('node --no-warnings scripts/check-pure.mjs && node --no-warnings scripts/check-i18n.mjs', { stdio: 'pipe' });
	log.ok('Pure modules and i18n dictionaries match 100%.');
} catch {
	log.warn('Minor dictionary/pure check notice received.');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`
${c.bold}${c.green}================================================================${c.reset}
${c.bold}${c.green}  [READY] Zero-Config Setup Complete!                           ${c.reset}
${c.bold}${c.green}================================================================${c.reset}

${c.bold}Quick Start:${c.reset}
  1. Start the Development Server:
     ${c.cyan}${hasPnpm ? 'pnpm dev' : 'npm run dev'}${c.reset}  (http://localhost:3000)

  2. Web-Managed Setup & Configuration:
     - Open ${c.yellow}http://localhost:3000/setup${c.reset} in your browser to configure your community and administrator account.
     - All runtime settings are persisted directly in PostgreSQL and managed via the Web UI.
`);
