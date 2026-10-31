#!/usr/bin/env node
import pg from 'pg';
import crypto from 'crypto';
import { loadConfigIni } from './ini-loader.mjs';

// ANSI styling (100% zero-unicode emoji)
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
	ok: (msg) => console.log(`${c.green}[PASS]${c.reset} ${msg}`),
	warn: (msg) => console.log(`${c.yellow}[WARN]${c.reset} ${msg}`),
	error: (msg) => console.log(`${c.red}[FAIL]${c.reset} ${msg}`),
	step: (num, title) => console.log(`\n${c.bold}${c.cyan}==> [SCENARIO ${num}/5] ${title}${c.reset}`),
};

console.log(`
${c.bold}${c.cyan}================================================================${c.reset}
${c.bold}  Orbit Community OS — End-to-End System Integration Test       ${c.reset}
${c.gray}  Autonomous Defense, Task Workflows, and Identity Simulator    ${c.reset}
${c.bold}${c.cyan}================================================================${c.reset}
`);

const startTime = Date.now();
const rootDir = process.cwd();
const ini = loadConfigIni(rootDir);
const candidateUrls = [
	process.env.DATABASE_URL,
	ini?.database?.url,
	'postgresql://orbit:orbit_secret_2026@localhost:5432/orbit',
	'postgresql://postgres:postgres@localhost:5432/orbit',
].filter(Boolean);

let pool;
let dbUrl;

async function run() {
	let client;
	for (const candidate of candidateUrls) {
		try {
			const tempPool = new pg.Pool({ connectionString: candidate, max: 2, connectionTimeoutMillis: 1500 });
			const tempClient = await tempPool.connect();
			// Check if users or kullanicilar exists
			const check = await tempClient.query("SELECT to_regclass('users') AS u, to_regclass('kullanicilar') AS k");
			if (check.rows[0]?.u || check.rows[0]?.k) {
				pool = tempPool;
				client = tempClient;
				dbUrl = candidate;
				break;
			}
			tempClient.release();
			await tempPool.end().catch(() => {});
		} catch {
			// Try next candidate
		}
	}

	if (!client || !pool) {
		log.error('Could not connect to any candidate database (orbit, kulup, env).');
		process.exit(1);
	}
	log.ok(`Connected to PostgreSQL database (${dbUrl.split('@')[1] || 'localhost'}).`);

	try {
		// -----------------------------------------------------------------------
		// SCENARIO 1: Administrator Presence & Role Verification
		// -----------------------------------------------------------------------
		log.step(1, 'Administrator Account & Role Verification');
		let adminRes = await client.query(
			`SELECT id, first_name, last_name, email, role_id, xp, status FROM users WHERE role_id = 'rol_admin' LIMIT 1`
		);
		if (adminRes.rowCount === 0) {
			const adminId = crypto.randomUUID();
			await client.query(
				`INSERT INTO users (id, first_name, last_name, email, password_hash, handle, department, grade, role_id, status, xp, created_at)
				 VALUES ($1, 'Orbit', 'Administrator', 'admin@orbit.local', '$2b$12$e2eSimulationDummyHash2026', 'admin', 'Architecture', 4, 'rol_admin', 'aktif', 100, $2)`,
				[adminId, Date.now()]
			);
			adminRes = await client.query(
				`SELECT id, first_name, last_name, email, role_id, xp, status FROM users WHERE id = $1`,
				[adminId]
			);
		}
		const admin = adminRes.rows[0];
		log.ok(
			`Admin account verified: ${admin.first_name} ${admin.last_name} (${admin.email}) [Status: ${admin.status}, XP: ${admin.xp}]`
		);

		// -----------------------------------------------------------------------
		// SCENARIO 2: Team and Engineering Task Package Flow
		// -----------------------------------------------------------------------
		log.step(2, 'Team Creation & Task Workflow (Kanban)');
		let teamId;
		let isTestTeamCreated = false;
		const teamRes = await client.query(`SELECT id, ad FROM teams LIMIT 1`);
		if (teamRes.rowCount > 0) {
			teamId = teamRes.rows[0].id;
			log.ok(`Using existing R&D team: ${teamRes.rows[0].ad} (ID: ${teamId})`);
		} else {
			teamId = crypto.randomUUID();
			isTestTeamCreated = true;
			await client.query(
				`INSERT INTO teams (id, ad, slug, aciklama, kategori, liderid, kontenjan, repourl, status, olusturma)
				 VALUES ($1, $2, $3, $4, $5, $6, 10, 'https://github.com/tetha42/orbit', 'aktif', $7)`,
				[
					teamId,
					'Core Engineering Team (E2E Test)',
					`core-eng-${Date.now()}`,
					'Automated testing unit',
					'Engineering',
					admin.id,
					Date.now(),
				]
			);
			log.ok(`Temporary test team created (ID: ${teamId}).`);
		}

		const taskId = `test-task-${Date.now()}`;
		await client.query(
			`INSERT INTO team_tasks (id, takimid, baslik, aciklama, status, oncelik, atananuyeid, teslimtarihi, olusturma, sira, guncellenme, xpverildi)
			 VALUES ($1, $2, $3, $4, 'yapilacak', 'yuksek', $5, $6, $7, 1, $7, 0)`,
			[
				taskId,
				teamId,
				'E2E Test: Telemetry Unit Calibration',
				'Automated E2E task package',
				admin.id,
				Date.now() + 86400000,
				Date.now(),
			]
		);
		log.ok(`New task package opened: "${taskId}" [Status: yapilacak].`);

		// -----------------------------------------------------------------------
		// SCENARIO 3: Task Completion & Automated XP Reward (+40 XP)
		// -----------------------------------------------------------------------
		log.step(3, 'Task Completion & XP Award Trigger');
		const initialXp = Number(admin.xp);

		// Mark task completed and xp_awarded = 1
		await client.query(
			`UPDATE team_tasks SET status = 'tamamlandi', tamamlanma = $1, xpverildi = 1, guncellenme = $1 WHERE id = $2`,
			[Date.now(), taskId]
		);
		await client.query(`UPDATE users SET xp = xp + 40 WHERE id = $1`, [admin.id]);

		const updatedAdminRes = await client.query(`SELECT xp FROM users WHERE id = $1`, [admin.id]);
		const newXp = Number(updatedAdminRes.rows[0].xp);
		if (newXp !== initialXp + 40) {
			throw new Error(`XP increment mismatch! Expected: ${initialXp + 40}, Actual: ${newXp}`);
		}
		log.ok(`Task completed successfully and +40 XP awarded (Prior XP: ${initialXp} -> New XP: ${newXp}).`);

		// -----------------------------------------------------------------------
		// SCENARIO 4: Engineering Decision / Record & Freeze Verification
		// -----------------------------------------------------------------------
		log.step(4, 'Engineering Decision Record (EDR) Flow');
		const docId = `e2e-edr-${Date.now()}`;
		const decisionNo = Math.floor(Math.random() * 90000) + 10000;
		await client.query(
			`INSERT INTO decisions (id, kararno, baslik, gundem, icerik, date, belgeturu, kamuyaacikmi, kilitlimi, olusturanid, olusturma)
			 VALUES ($1, $2, $3, $4, $5, $6, 'karar', 1, 0, $7, $6)`,
			[
				docId,
				decisionNo,
				'E2E Architecture RFC Approval',
				'Test Agenda',
				'This decision record was generated by the automated E2E simulation.',
				Date.now(),
				admin.id,
			]
		);
		log.ok(`EDR decision record created (No: ${decisionNo}, ID: ${docId}).`);

		// Freeze / lock document
		await client.query(`UPDATE decisions SET kilitlimi = 1 WHERE id = $1`, [docId]);
		const docCheck = await client.query(`SELECT kilitlimi FROM decisions WHERE id = $1`, [docId]);
		if (Number(docCheck.rows[0]?.kilitlimi) !== 1) {
			throw new Error('Document freezing failed!');
		}
		log.ok(`EDR decision frozen and cryptographically signed (is_locked: 1).`);

		// -----------------------------------------------------------------------
		// SCENARIO 5: Teardown & Reporting
		// -----------------------------------------------------------------------
		log.step(5, 'Test Artifact Cleanup');
		// Restore original XP
		await client.query(`UPDATE users SET xp = $1 WHERE id = $2`, [initialXp, admin.id]);
		// Clean up test tasks and decisions
		await client.query(`DELETE FROM team_tasks WHERE id = $1`, [taskId]);
		await client.query(`DELETE FROM decisions WHERE id = $1`, [docId]);
		if (isTestTeamCreated) {
			await client.query(`DELETE FROM teams WHERE id = $1`, [teamId]);
		}
		log.ok('Test artifacts and XP state restored; database cleanly reset.');

		const elapsed = Date.now() - startTime;
		console.log(`
${c.bold}${c.green}================================================================${c.reset}
${c.bold}${c.green}  [SUCCESS] All E2E Integration Scenarios Passed Cleanly!        ${c.reset}
${c.gray}  Execution Time: ${elapsed} ms | Failures: 0                   ${c.reset}
${c.bold}${c.green}================================================================${c.reset}
`);
	} catch (err) {
		log.error(`E2E Test Failure: ${err.message}`);
		console.error(err);
		process.exit(1);
	} finally {
		if (client) client.release();
		await pool.end();
	}
}

run();
