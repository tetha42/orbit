// Resetting a database for the suites that need an empty one.
//
// This is the only place that runs DROP DATABASE, and it only does so for the
// throw-away PostgreSQL container (127.0.0.1:55432, user "test"). The developer's
// real database (localhost:5432/kulup) is refused here, in code, whatever the
// caller or the environment says.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const TEST_HOST = '127.0.0.1';
const TEST_PORT = '55432';
const TEST_USER = 'test';

/** Throws unless `url` points at a database inside the test container. Returns its parts. */
export function assertTestDatabase(url) {
	let u;
	try {
		u = new URL(url);
	} catch {
		throw new Error('DATABASE_URL is not a valid URL; refusing to reset it.');
	}
	const name = decodeURIComponent(u.pathname.slice(1));
	const where = `${u.hostname}:${u.port || '5432'}/${name}`;
	if (u.hostname !== TEST_HOST || u.port !== TEST_PORT || decodeURIComponent(u.username) !== TEST_USER) {
		throw new Error(`Refusing to reset ${where}: only the test container (${TEST_USER}@${TEST_HOST}:${TEST_PORT}) may be dropped.`);
	}
	if (!/^[A-Za-z0-9_]+$/.test(name) || ['postgres', 'kulup', 'template0', 'template1'].includes(name)) {
		throw new Error(`Refusing to reset ${where}: not a throw-away database name.`);
	}
	return { name, admin: Object.assign(new URL(url), { pathname: '/postgres' }).toString() };
}

/** DROP + CREATE the database named in `url`, leaving it empty. */
export async function resetDatabase(url) {
	const { name, admin } = assertTestDatabase(url);
	const client = new Client({ connectionString: admin });
	await client.connect();
	try {
		await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
		await client.query(`CREATE DATABASE "${name}"`);
	} finally {
		await client.end();
	}
}

/** Clones an already-migrated/seeded test database (`templateUrl`) into `targetUrl`. */
export async function cloneDatabase(templateUrl, targetUrl) {
	const src = assertTestDatabase(templateUrl);
	const dst = assertTestDatabase(targetUrl);
	const client = new Client({ connectionString: dst.admin });
	await client.connect();
	try {
		await client.query(
			`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
			[src.name]
		);
		await client.query(`DROP DATABASE IF EXISTS "${dst.name}" WITH (FORCE)`);
		await client.query(`CREATE DATABASE "${dst.name}" TEMPLATE "${src.name}"`);
	} finally {
		await client.end();
	}
}

/** Drops a temporary test database created during sharded E2E runs. */
export async function dropDatabase(url) {
	const { name, admin } = assertTestDatabase(url);
	const client = new Client({ connectionString: admin });
	await client.connect();
	try {
		await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
	} finally {
		await client.end();
	}
}

/** Reads active fixture session tokens from `users` so workers skip initial TOTP waits. */
export async function readActiveSessionTokens(url) {
	assertTestDatabase(url);
	const client = new Client({ connectionString: url });
	await client.connect();
	try {
		const res = await client.query(`SELECT email, session_token FROM users WHERE session_token IS NOT NULL`);
		const tokens = new Map();
		for (const row of res.rows) {
			if (row.email && row.session_token) tokens.set(String(row.email).toLowerCase(), String(row.session_token));
		}
		return tokens;
	} finally {
		await client.end();
	}
}

/**
 * Forgets every member's roamed workspace (open windows, dock order) in `url`.
 *
 * The workspace roams through `users.workspace_state`, so without this a suite would inherit
 * the previous suite's maximised window — which covers the Dock and makes the next suite's
 * first click on a dock icon time out. Suites are otherwise independent; give them a clean
 * desktop each.
 */
export async function clearWorkspaceStates(url) {
	assertTestDatabase(url);
	const client = new Client({ connectionString: url });
	await client.connect();
	try {
		await client.query("UPDATE users SET workspace_state = '{}'::jsonb");
	} finally {
		await client.end();
	}
}

/** The same server, another database: `t_e2e` → `t_e2e_2fa`. */
export function siblingDatabase(url, suffix) {
	const u = new URL(url);
	u.pathname = `/${decodeURIComponent(u.pathname.slice(1))}_${suffix}`;
	return u.toString();
}
