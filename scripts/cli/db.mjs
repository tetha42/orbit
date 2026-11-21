import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { confirmAction, createStyle, formatPgError, isInteractiveTty } from './format.mjs';

const DEV_COMPOSE_REL = join('infra', 'docker', 'docker-compose.dev.yml');
const DEV_CONTAINER = 'orbit-db';

async function resolveDevDbEnv(ROOT) {
	const { parseDotEnvFile } = await import('@/server/config/provenance');
	const fileEnv = {
		...parseDotEnvFile(join(ROOT, '.env')),
		...parseDotEnvFile(join(ROOT, '.env.local')),
	};
	return {
		user: (process.env.POSTGRES_USER || fileEnv.POSTGRES_USER || 'orbit').trim(),
		password: (process.env.POSTGRES_PASSWORD || fileEnv.POSTGRES_PASSWORD || 'orbit_dev_2026').trim(),
		db: (process.env.POSTGRES_DB || fileEnv.POSTGRES_DB || 'orbit').trim(),
		port: String((process.env.POSTGRES_PORT || fileEnv.POSTGRES_PORT || '5432').trim()),
	};
}

function isDockerAvailable() {
	const res = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
		encoding: 'utf8',
		timeout: 2500,
	});
	return res.status === 0;
}

function listAllContainers() {
	const ps = spawnSync(
		'docker',
		['ps', '-a', '--format', '{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.State}}\t{{.Status}}'],
		{ encoding: 'utf8', timeout: 2500 }
	);
	if (ps.status !== 0 || !ps.stdout) return [];
	const rows = [];
	for (const raw of ps.stdout.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		const [name = '', image = '', ports = '', state = '', status = ''] = line.split('\t');
		rows.push({ name, image, ports, state, status });
	}
	return rows;
}

function portBoundByContainer(portsText, port) {
	if (!portsText || !port) return false;
	const escaped = port.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(`(?:^|,\\s*)(?:[0-9.]+|\\[::\\]|::)?:${escaped}->`);
	return re.test(portsText);
}

async function probeUrl(dbUrl) {
	try {
		const { default: pg } = await import('pg');
		const client = new pg.Client({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
		try {
			await client.connect();
			const res = await client.query('SELECT current_database() AS db, current_user AS usr');
			return { ok: true, database: res.rows[0]?.db, user: res.rows[0]?.usr };
		} finally {
			await client.end().catch(() => {
				/* Ignore close failure after connection attempt */
			});
		}
	} catch (err) {
		return { ok: false, error: formatPgError(err) };
	}
}

function runCompose(ROOT, args, quiet) {
	return spawnSync('docker', ['compose', '-f', DEV_COMPOSE_REL, ...args], {
		cwd: ROOT,
		encoding: 'utf8',
		stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
	});
}

export async function runDbCommand(ROOT, subArgs, flags, output) {
	const sub = subArgs[0] || 'status';
	const jsonMode = flags.has('--json');
	const s = createStyle(jsonMode);
	const env = await resolveDevDbEnv(ROOT);
	const devConnectionHint = `postgresql://${env.user}:****@127.0.0.1:${env.port}/${env.db}`;

	if (sub === 'status') {
		const dockerUp = isDockerAvailable();
		const containers = dockerUp ? listAllContainers() : [];
		const devEntry = containers.find((c) => c.name === DEV_CONTAINER) || null;
		const pgContainers = containers.filter(
			(c) => c.state === 'running' && (/postgres|postgis|timescale/i.test(c.image) || c.ports.includes('5432/tcp'))
		);
		const { resolveDatabaseUrlWithSource, maskConfigValue } = await import('@/server/config/provenance');
		const active = resolveDatabaseUrlWithSource(ROOT);
		const probe = active.url ? await probeUrl(active.url) : { ok: false, error: 'DATABASE_URL unset' };
		const payload = {
			ok: true,
			dockerAvailable: dockerUp,
			devContainer: devEntry,
			runningPostgresContainers: pgContainers,
			activeDatabaseUrl: maskConfigValue('DATABASE_URL', active.url, true),
			activeDatabaseSource: active.source,
			connected: probe.ok,
			probeDetail: probe.ok ? `${probe.database} (${probe.user})` : probe.error,
		};
		output(payload, (d) => {
			console.log(s.bold('Orbit Database Status'));
			console.log(`  Dev container (${DEV_CONTAINER}): ${d.devContainer ? `${d.devContainer.state} — ${d.devContainer.status}` : 'not created'}`);
			console.log(`  Active DATABASE_URL (${d.activeDatabaseSource}): ${d.activeDatabaseUrl}`);
			console.log(`  Connectivity: ${d.connected ? s.green(`ONLINE (${d.probeDetail})`) : s.yellow(`OFFLINE (${d.probeDetail})`)}`);
			if (d.runningPostgresContainers.length > 0) {
				console.log(`  Running Postgres containers: ${d.runningPostgresContainers.map((c) => c.name).join(', ')}`);
			}
		});
		return;
	}

	if (!isDockerAvailable()) {
		const payload = { ok: false, error: 'Docker daemon is not running or Docker CLI is unavailable.' };
		output(payload, () => console.error(s.red(`Error: ${payload.error}`)));
		process.exit(1);
	}

	if (sub === 'up') {
		const containers = listAllContainers();
		const runningDev = containers.find((c) => c.name === DEV_CONTAINER && c.state === 'running');
		if (runningDev) {
			const payload = { ok: true, alreadyRunning: true, container: DEV_CONTAINER, port: env.port, url: devConnectionHint };
			output(payload, () => {
				console.log(`${s.green('[OK]')} Dev PostgreSQL container '${DEV_CONTAINER}' is already running.`);
				console.log(`  Connection: ${devConnectionHint}`);
			});
			return;
		}
		const conflict = containers.find(
			(c) => c.state === 'running' && c.name !== DEV_CONTAINER && portBoundByContainer(c.ports, env.port)
		);
		if (conflict) {
			const payload = {
				ok: false,
				reason: 'port_conflict',
				port: env.port,
				occupiedBy: conflict.name,
				suggestions: [
					`Use '${conflict.name}' directly in /setup auto-detect`,
					`POSTGRES_PORT=5433 ./bin/orbit db up`,
				],
			};
			output(payload, () => {
				console.error(`${s.red('[ERR]')} Host port ${env.port} is already bound by running container '${conflict.name}'.`);
				console.error(`  Option 1: Keep using '${conflict.name}' via /setup auto-detect.`);
				console.error(`  Option 2: Start on another port: POSTGRES_PORT=5433 ./bin/orbit db up`);
			});
			process.exit(1);
		}
		const upRes = runCompose(ROOT, ['up', '-d', 'db', '--wait'], jsonMode);
		if (upRes.status !== 0) {
			const payload = { ok: false, error: (upRes.stderr || 'docker compose up failed').trim() };
			output(payload, () => console.error(s.red(`Failed to start ${DEV_CONTAINER}: ${payload.error}`)));
			process.exit(1);
		}
		output({ ok: true, started: true, container: DEV_CONTAINER, port: env.port, url: devConnectionHint }, () => {
			console.log(`${s.green('[OK]')} PostgreSQL dev database is ready (${devConnectionHint}).`);
		});
		return;
	}

	if (sub === 'down') {
		const stopRes = runCompose(ROOT, ['stop', 'db'], jsonMode);
		if (stopRes.status !== 0) {
			output({ ok: false, error: (stopRes.stderr || 'docker compose stop failed').trim() }, () => {
				console.error(s.red(`Failed to stop ${DEV_CONTAINER}.`));
			});
			process.exit(1);
		}
		output({ ok: true, stopped: true, container: DEV_CONTAINER }, () => {
			console.log(`${s.green('[OK]')} Dev PostgreSQL container stopped (data preserved).`);
		});
		return;
	}

	if (sub === 'shell') {
		const containers = listAllContainers();
		const runningDev = containers.find((c) => c.name === DEV_CONTAINER && c.state === 'running');
		if (!runningDev) {
			console.error(`Container '${DEV_CONTAINER}' is not running. Start it with: ./bin/orbit db up`);
			process.exit(1);
		}
		const ttyFlag = isInteractiveTty() ? ['-it'] : ['-i'];
		const res = spawnSync('docker', ['exec', ...ttyFlag, DEV_CONTAINER, 'psql', '-U', env.user, '-d', env.db], {
			cwd: ROOT,
			stdio: 'inherit',
		});
		process.exit(res.status ?? 0);
	}

	if (sub === 'reset') {
		if (process.env.NODE_ENV === 'production') {
			output({ ok: false, error: 'Refusing database reset in NODE_ENV=production.' }, () => {
				console.error(s.red('Refusing database reset when NODE_ENV=production.'));
			});
			process.exit(2);
		}
		const confirmed = flags.has('--yes') || (await confirmAction(`Wipe volume and reset '${DEV_CONTAINER}'?`));
		if (!confirmed) {
			const code = isInteractiveTty() || flags.has('--yes') ? 1 : 2;
			output({ ok: false, cancelled: true, error: 'Pass --yes in non-interactive shells.' }, () => {
				console.error(code === 2 ? 'Non-interactive reset requires --yes.' : 'Database reset cancelled.');
			});
			process.exit(code);
		}
		const downRes = runCompose(ROOT, ['down', '-v'], jsonMode);
		const upRes = downRes.status === 0 ? runCompose(ROOT, ['up', '-d', 'db', '--wait'], jsonMode) : downRes;
		if (upRes.status !== 0) {
			output({ ok: false, error: (upRes.stderr || 'docker compose reset failed').trim() }, () => {
				console.error(s.red('Failed to reset dev PostgreSQL database.'));
			});
			process.exit(1);
		}
		output({ ok: true, reset: true, container: DEV_CONTAINER, url: devConnectionHint }, () => {
			console.log(`${s.green('[OK]')} Dev database wiped and restarted cleanly (${devConnectionHint}).`);
		});
		return;
	}

	console.error(`Unknown db subcommand '${sub}'. Usage: orbit db <status|up|down|shell|reset|explain>`);
	process.exit(2);
}
