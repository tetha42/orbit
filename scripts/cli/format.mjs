import { createInterface } from 'node:readline/promises';

export function createStyle(jsonMode = false) {
	const enabled = Boolean(process.stdout.isTTY && !process.env.NO_COLOR && !jsonMode);
	const wrap = (code) => (text) => (enabled ? `\x1b[${code}m${text}\x1b[0m` : String(text));
	return {
		enabled,
		bold: wrap('1'),
		dim: wrap('2'),
		red: wrap('31'),
		green: wrap('32'),
		yellow: wrap('33'),
		cyan: wrap('36'),
	};
}

export function printCheckLine(style, status, label, detail, fix = '') {
	const badges = {
		ok: style.green('[OK]  '),
		warn: style.yellow('[WARN]'),
		fail: style.red('[FAIL]'),
		info: style.cyan('[INFO]'),
	};
	const badge = badges[status] || '[INFO]';
	console.log(`  ${badge} ${style.bold(label)}: ${detail}`);
	if (fix) {
		console.log(`         ${style.dim('fix ->')} ${fix}`);
	}
}

export function isInteractiveTty() {
	return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function formatPgError(err) {
	if (err && typeof err === 'object') {
		const agg = /** @type {{ errors?: Array<{ message?: string; code?: string }>; message?: string; code?: string }} */ (err);
		if (Array.isArray(agg.errors) && agg.errors.length > 0) {
			const first = agg.errors[0];
			return first?.message || first?.code || 'connection failed';
		}
		if (agg.message) return agg.message;
		if (agg.code) return agg.code;
	}
	return String(err || 'connection failed');
}

export async function confirmAction(promptText) {
	if (!isInteractiveTty()) return false;
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = await rl.question(`${promptText} [y/N] `);
		const normalized = answer.trim().toLowerCase();
		return normalized === 'y' || normalized === 'yes';
	} finally {
		rl.close();
	}
}

export function printGroupedHelp(jsonMode) {
	const help = {
		usage: 'orbit <command> [options]',
		commands: [
			'doctor',
			'dev',
			'db up',
			'db down',
			'db status',
			'db shell',
			'db reset',
			'db explain',
			'setup status',
			'setup url',
			'setup reset',
			'status',
			'verify',
			'test',
			'quotas',
			'fim',
			'waf',
			'audit',
			'tokens',
			'i18n',
			'empty-catch',
			'ipc-ping',
			'bench',
			'bundle-budget',
			'ai map',
			'ai deps',
			'ai impact',
		],
		flags: [
			'--json',
			'--port <port>',
			'--with-db',
			'--yes',
			'--force',
			'--check',
			'--files <paths>',
			'--staged',
			'--target <scope>',
			'--save-baseline',
			'--baseline',
			'--compare',
			'--iterations <n>',
			'--rows <n>',
		],
	};

	if (jsonMode) {
		console.log(JSON.stringify(help, null, 2));
		return;
	}

	const s = createStyle(false);
	console.log(`${s.bold(s.cyan('Orbit Community OS — Unified Platform CLI'))}\n`);
	console.log(s.bold('Developer Workflow:'));
	console.log('  orbit doctor                Environment, config provenance & DB health report');
	console.log('  orbit dev [--with-db]       Start local Next.js dev server (--port <n>)');
	console.log('  orbit test [contract|security|e2e|sim]  Run automated test suites\n');
	console.log(s.bold('Database & First-Run Setup:'));
	console.log('  orbit db up | down          Start/stop isolated dev PostgreSQL (infra/docker/docker-compose.dev.yml)');
	console.log('  orbit db status | shell     Inspect DB status or open psql in dev container');
	console.log('  orbit db reset [--yes]      Wipe dev DB volume and recreate fresh PostgreSQL');
	console.log('  orbit db explain            Inspect PostgreSQL query plans (--rows <n>)');
	console.log('  orbit setup status | url    Show setup lock state and clickable /setup#token=... URL');
	console.log('  orbit setup reset [--yes]   Clear local setup lock/token/runtime-config (dev only)\n');
	console.log(s.bold('Quality, Security & Runtime Inspection:'));
	console.log('  orbit status | quotas       Inspect build, Security Guard IPC, SSE quotas & FIM baselines');
	console.log('  orbit verify [--check]      Run codegen & all static verification gates (or --files/--staged)');
	console.log('  orbit ai map|deps|impact    Query sharded AI index, static deps & test impact');
	console.log('  orbit audit | tokens | i18n | empty-catch | fim | waf | ipc-ping | bench | bundle-budget\n');
	console.log('Common options: --json, --port <n>, --with-db, --yes, --check, --files <list>, --staged');
}
