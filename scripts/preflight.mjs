// Local mirror of the CI gates that are cheap and need no database. Run before every push:
//   pnpm preflight            lockfile sync + override conflicts + pnpm verify
//   pnpm preflight --full     the above plus the contract test suite (needs PostgreSQL)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const full = process.argv.includes('--full');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
let failed = false;

function step(label, fn) {
	const started = Date.now();
	process.stdout.write(`[preflight] ${label} ... `);
	const problem = fn();
	const seconds = ((Date.now() - started) / 1000).toFixed(1);
	if (problem) {
		failed = true;
		console.log(`FAIL (${seconds}s)\n${problem}`);
	} else {
		console.log(`ok (${seconds}s)`);
	}
	return !problem;
}

function run(command, args) {
	const res = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
	return res.status === 0 ? '' : `${res.stdout ?? ''}${res.stderr ?? ''}`.trim().split('\n').slice(-25).join('\n');
}

/** A pnpm override replaces the dependency specifier; a different range in both places desyncs the lockfile. */
function overrideConflicts() {
	const overrides = pkg.pnpm?.overrides ?? {};
	const groups = [pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies];
	const conflicts = [];
	for (const [name, range] of Object.entries(overrides)) {
		for (const group of groups) {
			if (group?.[name] && group[name] !== range) {
				conflicts.push(`  ${name}: dependency "${group[name]}" vs pnpm.overrides "${range}" (remove the override or align both)`);
			}
		}
	}
	return conflicts.join('\n');
}

step('pnpm.overrides do not conflict with dependencies', overrideConflicts);
step('pnpm-lock.yaml matches package.json (frozen)', () => run('pnpm', ['install', '--frozen-lockfile', '--lockfile-only']));
step('pnpm verify (tsc + eslint + repo gates)', () => run('pnpm', ['verify']));
if (full) step('pnpm test (contract suite)', () => run('pnpm', ['test']));

if (failed) {
	console.error('\n[preflight] FAILED: fix the problems above before pushing.');
	process.exit(1);
}
console.log('\n[preflight] all gates passed.');
