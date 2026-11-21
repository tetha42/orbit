import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { confirmAction, createStyle, isInteractiveTty } from './format.mjs';

export async function runSetupCommand(ROOT, subArgs, flags, output) {
	const sub = subArgs[0] || 'status';
	const jsonMode = flags.has('--json');
	const s = createStyle(jsonMode);

	const { ensureSetupToken, getSetupToken, isSetupLocked, resolveSetupUrl } = await import('@/lib/setup');
	const { collectConfigProvenance, maskConfigValue, resolveDatabaseUrlWithSource } = await import(
		'@/server/config/provenance'
	);

	if (sub === 'reset') {
		if (process.env.NODE_ENV === 'production' && !flags.has('--force')) {
			output({ ok: false, error: 'Refusing setup reset in production without --force.' }, () => {
				console.error(s.red('Refusing setup reset when NODE_ENV=production (pass --force to override).'));
			});
			process.exit(2);
		}
		const confirmed =
			flags.has('--yes') ||
			(await confirmAction('Reset local setup state (data/setup.lock, data/orbit.setup.token, data/runtime-config.json)?'));
		if (!confirmed) {
			const code = isInteractiveTty() || flags.has('--yes') ? 1 : 2;
			output({ ok: false, cancelled: true, error: 'Pass --yes to reset non-interactively.' }, () => {
				console.error(code === 2 ? 'Non-interactive setup reset requires --yes.' : 'Setup reset cancelled.');
			});
			process.exit(code);
		}

		const targets = ['setup.lock', 'orbit.setup.token', 'runtime-config.json'];
		const removed = [];
		for (const file of targets) {
			const full = join(ROOT, 'data', file);
			if (existsSync(full)) {
				unlinkSync(full);
				removed.push(`data/${file}`);
			}
		}

		const nextToken = ensureSetupToken({ announce: false });
		const setupUrl = nextToken ? resolveSetupUrl(nextToken) : null;
		output({ ok: true, removed, token: nextToken, url: setupUrl }, () => {
			console.log(`${s.green('[OK]')} Cleared local setup files: ${removed.length ? removed.join(', ') : '(none existed)'}`);
			if (setupUrl) {
				console.log(`  Next Setup URL: ${s.cyan(setupUrl)}`);
			} else {
				console.log('  BOOTSTRAP_ADMIN_PASSWORD is set; wizard token is not required.');
			}
		});
		return;
	}

	const locked = isSetupLocked();
	const hasRuntimeConfig = existsSync(join(ROOT, 'data', 'runtime-config.json'));
	const config = collectConfigProvenance(ROOT);
	const bootstrapAdminConfigured = Boolean(config.find((c) => c.key === 'BOOTSTRAP_ADMIN_PASSWORD')?.configured);
	const db = resolveDatabaseUrlWithSource(ROOT);

	if (sub === 'status') {
		const token = getSetupToken();
		const setupUrl = !locked && token ? resolveSetupUrl(token) : null;
		const payload = {
			ok: true,
			locked,
			hasToken: Boolean(token),
			hasRuntimeConfig,
			bootstrapAdminConfigured,
			databaseUrl: maskConfigValue('DATABASE_URL', db.url, true),
			databaseSource: db.source,
			setupUrl,
		};
		output(payload, (d) => {
			console.log(s.bold('Orbit First-Run Setup Status'));
			console.log(`  State:           ${d.locked ? s.green('LOCKED (complete)') : s.yellow('UNLOCKED (pending setup)')}`);
			console.log(`  Runtime Config:  ${d.hasRuntimeConfig ? 'data/runtime-config.json present' : 'not written yet'}`);
			console.log(`  Database (${d.databaseSource}): ${d.databaseUrl}`);
			console.log(`  Setup URL:       ${d.setupUrl || '(unavailable — run ./bin/orbit setup url when unlocked)'}`);
		});
		return;
	}

	if (sub === 'url') {
		if (locked) {
			output({ ok: true, locked: true, url: null, token: null }, () => {
				console.log(`${s.green('[OK]')} Setup is already locked and complete.`);
			});
			return;
		}
		const token = ensureSetupToken({ announce: false });
		const url = token ? resolveSetupUrl(token) : null;
		output({ ok: true, locked: false, bootstrapAdminConfigured, token, url }, () => {
			if (url) {
				console.log(`Setup URL: ${s.cyan(url)}`);
				console.log(`Token:     ${token}`);
			} else {
				console.log('Headless mode active (BOOTSTRAP_ADMIN_PASSWORD configured); token not generated.');
			}
		});
		return;
	}

	console.error(`Unknown setup subcommand '${sub}'. Usage: orbit setup <status|url|reset>`);
	process.exit(2);
}
