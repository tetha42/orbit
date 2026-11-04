// Every string in TRANSLATIONS (i18n.ts + i18nExtra.ts + i18nFeatures.ts + i18nApps.ts)
// must exist in both languages, no .ts/.tsx file under src/ may hardcode inline
// `language === 'tr'` / `locale === 'tr'` ternaries, and no mini-app under
// `src/apps/<appA>/` may import directly from another mini-app `src/apps/<appB>/`.
//
//   node scripts/check-i18n.mjs
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../src/lib/i18n.ts';
import { APP_TRANSLATIONS } from '../src/lib/i18nApps.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');
const APPS_DIR = path.join(SRC_DIR, 'apps');

const mergedTr = { ...TRANSLATIONS.tr, ...APP_TRANSLATIONS.tr };
const mergedEn = { ...TRANSLATIONS.en, ...APP_TRANSLATIONS.en };

const tr = new Set(Object.keys(mergedTr));
const en = new Set(Object.keys(mergedEn));

const missingInEn = [...tr].filter((key) => !en.has(key));
const missingInTr = [...en].filter((key) => !tr.has(key));
const empty = [...tr, ...en].filter(
	(key) => !mergedTr[key]?.trim() && !mergedEn[key]?.trim()
);

let hasFailure = false;

if (missingInEn.length || missingInTr.length || empty.length) {
	if (missingInEn.length) console.error('Missing in en:', missingInEn.join(', '));
	if (missingInTr.length) console.error('Missing in tr:', missingInTr.join(', '));
	if (empty.length) console.error('Empty in both languages:', empty.join(', '));
	hasFailure = true;
}

function walkSourceFiles(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walkSourceFiles(fullPath, out);
		} else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
			out.push(fullPath);
		}
	}
	return out;
}

const appDirs = new Set(
	fs.existsSync(APPS_DIR)
		? fs
				.readdirSync(APPS_DIR, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name)
		: []
);

const FORBIDDEN_LOCALE_TERNARY_RE = /\b(?:language|locale)\s*(?:===|!==)\s*['"`]tr['"`]/g;
const IMPORT_SPEC_RE =
	/(?:import|export)\s+(?:type\s+)?(?:[^'"`]*?\s+from\s+)?['"`]([^'"`]+)['"`]|import\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

const sourceFiles = walkSourceFiles(SRC_DIR);
const inlineTernaryViolations = [];
const crossAppImportViolations = [];

for (const filePath of sourceFiles) {
	const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
	const content = fs.readFileSync(filePath, 'utf8');
	const lines = content.split(/\r?\n/);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		FORBIDDEN_LOCALE_TERNARY_RE.lastIndex = 0;
		const match = FORBIDDEN_LOCALE_TERNARY_RE.exec(line);
		if (match) {
			inlineTernaryViolations.push(`${relPath}:${i + 1}: forbidden inline locale check \`${match[0]}\``);
		}
	}

	const relFromApps = path.relative(APPS_DIR, filePath).replace(/\\/g, '/');
	if (!relFromApps.startsWith('..') && relFromApps.includes('/')) {
		const appA = relFromApps.split('/')[0];
		if (appDirs.has(appA)) {
			IMPORT_SPEC_RE.lastIndex = 0;
			let m;
			while ((m = IMPORT_SPEC_RE.exec(content)) !== null) {
				const spec = m[1] || m[2];
				if (!spec) continue;

				if (spec.startsWith('@/apps/')) {
					const targetSeg = spec.slice('@/apps/'.length).split('/')[0];
					if (appDirs.has(targetSeg) && targetSeg !== appA) {
						crossAppImportViolations.push(
							`${relPath}: mini-app '${appA}' imports directly from mini-app '${targetSeg}' (${spec})`
						);
					}
				} else if (spec.startsWith('.')) {
					const resolved = path.resolve(path.dirname(filePath), spec);
					const resolvedRelApps = path.relative(APPS_DIR, resolved).replace(/\\/g, '/');
					if (!resolvedRelApps.startsWith('..')) {
						const targetSeg = resolvedRelApps.split('/')[0];
						if (appDirs.has(targetSeg) && targetSeg !== appA) {
							crossAppImportViolations.push(
								`${relPath}: mini-app '${appA}' imports directly from mini-app '${targetSeg}' (${spec})`
							);
						}
					}
				}
			}
		}
	}
}

if (inlineTernaryViolations.length > 0) {
	console.error('check-i18n: forbidden inline locale ternaries found:');
	for (const v of inlineTernaryViolations) {
		console.error(`  - ${v}`);
	}
	hasFailure = true;
}

if (crossAppImportViolations.length > 0) {
	console.error('check-i18n: cross-app import isolation violations found:');
	for (const v of crossAppImportViolations) {
		console.error(`  - ${v}`);
	}
	hasFailure = true;
}

if (hasFailure) {
	process.exit(1);
}

console.log(
	`check-i18n: ${tr.size} keys in TRANSLATIONS, tr and en match perfectly; ${sourceFiles.length} source files scanned (0 inline locale ternaries, 0 cross-app imports)`
);
