// Local mirror of the CI gates that are cheap and need no database. Run before every push:
//   pnpm preflight            lockfile sync + override conflicts + undeclared imports + pnpm verify
//   pnpm preflight --full     the above plus the contract test suite (needs PostgreSQL)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

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

const BUILTINS = new Set(builtinModules.map((m) => m.replace(/^node:/, '')));
const DEV_ONLY_ALLOWED = new Set(['playwright-core', 'typescript', 'eslint']);
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs']);

function walkSourceFiles(dir, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === '.next') continue;
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walkSourceFiles(fullPath, out);
		} else if (entry.isFile() && SOURCE_EXTS.has(path.extname(entry.name))) {
			out.push(fullPath);
		}
	}
	return out;
}

function extractPackageName(specifier) {
	if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@/') || specifier.startsWith('node:')) {
		return null;
	}
	const parts = specifier.split('/');
	const pkgName = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
	if (!pkgName || BUILTINS.has(pkgName)) return null;
	return pkgName;
}

/** Verify every external package imported in src/ is declared in package.json. */
function undeclaredImports() {
	const deps = new Set(Object.keys(pkg.dependencies ?? {}));
	const devDeps = new Set(Object.keys(pkg.devDependencies ?? {}));
	const errors = [];

	for (const filePath of walkSourceFiles('src')) {
		const content = fs.readFileSync(filePath, 'utf8');
		const info = ts.preProcessFile(content, true, true);
		const isDts = filePath.endsWith('.d.ts');

		for (const ref of info.importedFiles) {
			const pkgName = extractPackageName(ref.fileName);
			if (!pkgName) continue;
			const allowDev = isDts || pkgName.startsWith('@types/') || DEV_ONLY_ALLOWED.has(pkgName);
			if (allowDev) {
				if (!deps.has(pkgName) && !devDeps.has(pkgName)) {
					errors.push(`  ${filePath}: "${pkgName}" is missing from package.json`);
				}
			} else if (!deps.has(pkgName)) {
				const hint = devDeps.has(pkgName) ? ' (currently only in devDependencies)' : '';
				errors.push(`  ${filePath}: runtime import "${pkgName}" is missing from package.json dependencies${hint}`);
			}
		}

		for (const ref of info.typeReferenceDirectives) {
			const pkgName = extractPackageName(ref.fileName);
			if (!pkgName) continue;
			const typesName = `@types/${pkgName}`;
			if (!deps.has(pkgName) && !devDeps.has(pkgName) && !devDeps.has(typesName)) {
				errors.push(`  ${filePath}: type reference "${pkgName}" is missing from package.json`);
			}
		}
	}

	return errors.join('\n');
}

step('pnpm.overrides do not conflict with dependencies', overrideConflicts);
step('pnpm-lock.yaml matches package.json (frozen)', () => run('pnpm', ['install', '--frozen-lockfile', '--lockfile-only']));
step('src/ external imports are declared in package.json', undeclaredImports);
step('pnpm verify (tsc + eslint + repo gates)', () => run('pnpm', ['verify']));
if (full) step('pnpm test (contract suite)', () => run('pnpm', ['test']));

if (failed) {
	console.error('\n[preflight] FAILED: fix the problems above before pushing.');
	process.exit(1);
}
console.log('\n[preflight] all gates passed.');
