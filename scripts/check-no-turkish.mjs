// Ratchet against Turkish text outside the localization catalogs.
//
// The interface is translated in i18n catalogs; everything else — server messages,
// seed/default data, tests, scripts — is English. This gate records the files that
// still carry legacy Turkish in `scripts/turkish-ceilings.json` and fails when a file
// exceeds its ceiling or a new file appears. Running with `--write` rebaselines it
// after a cleanup, so the number can only go down.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CEILINGS = path.join(ROOT, 'scripts', 'turkish-ceilings.json');
const TURKISH = /[\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015e\u00dc]/;
const ROOTS = ['src', 'tests', 'scripts', 'services', 'infra', 'examples', 'tools', 'docs'];
const TEXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.jsx', '.md', '.json', '.css', '.go', '.sql', '.sh', '.yml', '.yaml', '.html']);
const SKIP_DIR = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.tmp']);

/** Localization files may contain Turkish; everything else may not. */
function isLocalization(file) {
	const rel = path.relative(ROOT, file).split(path.sep).join('/');
	if (rel.startsWith('src/lib/i18n/')) return true;
	if (rel === 'src/lib/i18nExtra.ts' || rel === 'src/lib/i18n.ts') return true;
	if (/\/i18n[^/]*\.(?:ts|tsx)$/i.test(rel)) return true;
	if (/^src\/apps\/[^/]+\/manifest\.ts$/.test(rel)) return true;
	return false;
}

function walk(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (SKIP_DIR.has(entry.name)) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (TEXT.has(path.extname(entry.name)) && !isLocalization(full)) out.push(full);
	}
	return out;
}

const counts = {};
for (const root of ROOTS) {
	const abs = path.join(ROOT, root);
	if (!fs.existsSync(abs)) continue;
	for (const file of walk(abs)) {
		const text = fs.readFileSync(file, 'utf8');
		const n = text.split('\n').filter((line) => TURKISH.test(line)).length;
		if (n > 0) counts[path.relative(ROOT, file).split(path.sep).join('/')] = n;
	}
}

if (process.argv.includes('--write')) {
	fs.writeFileSync(CEILINGS, `${JSON.stringify(counts, null, '\t')}\n`);
	const total = Object.values(counts).reduce((a, b) => a + b, 0);
	console.log(`check-no-turkish: baseline written (${total} lines in ${Object.keys(counts).length} files).`);
	process.exit(0);
}

const ceilings = fs.existsSync(CEILINGS) ? JSON.parse(fs.readFileSync(CEILINGS, 'utf8')) : {};
const problems = [];
for (const [file, n] of Object.entries(counts)) {
	const allowed = Number(ceilings[file] ?? 0);
	if (n > allowed) problems.push(`${file}: ${n} Turkish line(s), ceiling ${allowed}`);
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
const allowedTotal = Object.values(ceilings).reduce((a, b) => a + Number(b), 0);
if (problems.length) {
	console.error(`check-no-turkish: ${total} Turkish line(s) outside the i18n catalogs (ceiling ${allowedTotal}):`);
	for (const p of problems.slice(0, 80)) console.error(`  - ${p}`);
	if (problems.length > 80) console.error(`  … ${problems.length - 80} more`);
	process.exit(1);
}
console.log(`check-no-turkish: ${total}/${allowedTotal} Turkish line(s) outside i18n (within the baseline).`);
