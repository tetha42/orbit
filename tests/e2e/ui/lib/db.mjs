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

/** The same server, another database: `t_e2e` → `t_e2e_2fa`. */
export function siblingDatabase(url, suffix) {
	const u = new URL(url);
	u.pathname = `/${decodeURIComponent(u.pathname.slice(1))}_${suffix}`;
	return u.toString();
}
