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
import ts from 'typescript';
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
const RATCHETED_LOCALE_TERNARY_RE = /\b(?:isEn\s*\?|(?:language|locale|lang)\s*(?:===|!==)\s*['"`](?:en|tr)['"`]\s*\?)/;
const TURKLISH_DOMAIN_WORDS =
	'(?:AppEvent|CommunityEvent|Role|Status|Permission|Certificate|Project|Member|Team|Event|Task|Budget|Vault|Decision|News|Note|Mail|Session)';
const FORBIDDEN_TURKLISH_RE = new RegExp(
	`(?:^|[^a-zA-Z0-9_])(?:` +
		`${TURKLISH_DOMAIN_WORDS}(?:['’]?[\u00fc\u0131\u00f6\u00e7\u015f\u011f]+[a-z\u00e7\u011f\u0131\u00f6\u015f\u00fc]*|['’]?[\u00fc\u0131i\u00f6](?=[^a-zA-Z0-9_]|$)|['’](?!s\\b)[a-z\u00e7\u011f\u0131\u00f6\u015f\u00fc]+)` +
		`|${TURKLISH_DOMAIN_WORDS}\\s+(?:bulunamad\u0131|olu\u015fturulamad\u0131|kaydedilemedi|silinemedi|` +
			`g\u00fcncellenemedi|atanmad\u0131|atand\u0131|ba\u015fl\u0131\u011f\u0131|korumal\u0131|kalkan\u0131|sahibi|s\u0131z\u0131nt\u0131s\u0131|durumu|` +
			`\u00fcstverisi|mesaj\u0131|say\u0131s\u0131|ya\u015fam|kayd\u0131|korelasyonu|t\u00fcrleri|t\u00fcr\u00fc|ak\u0131\u015f\u0131|zaten|yok|` +
			`gerekli|ge\u00e7ersiz|eklenemedi|\u00e7\u0131kar\u0131lamad\u0131|y\u00fcklenemedi|d\u0131\u015fa|i\u00e7e|en\\s+az|en\\s+fazla|` +
			`alan\u0131|de\u011feri|onay\u0131|reddi|listesi|detay\u0131|y\u00f6netimi|izni|yetkisi)(?=[^a-zA-Z0-9_\u00e7\u011f\u0131\u00f6\u015f\u00fc]|$)` +
		`|(?:ge\u00e7ersiz|acil|dijital|yerle\u015fik|varsay\u0131lan|yeni|mevcut|bu\\s+adla\\s+bir|yetersiz|eksik|hatal\u0131|tan\u0131ms\u0131z)\\s+${TURKLISH_DOMAIN_WORDS}(?=[^a-zA-Z0-9_]|$)` +
		`)`,
	'i'
);
const TERNARY_CEILINGS_PATH = path.join(ROOT, 'scripts', 'i18n-ternary-ceilings.json');
const ternaryCeilings = fs.existsSync(TERNARY_CEILINGS_PATH)
	? JSON.parse(fs.readFileSync(TERNARY_CEILINGS_PATH, 'utf8'))
	: {};
const IMPORT_SPEC_RE =
	/(?:import|export)\s+(?:type\s+)?(?:[^'"`]*?\s+from\s+)?['"`]([^'"`]+)['"`]|import\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

const AST_LOCALE_BRANCH_RE =
	/\b(?:isEn|useEn|isTr|useTr)\b|\b(?:language|locale|lang)\s*(?:===|!==|==|!=)\s*['"`](?:en|tr)['"`]|\b(?:language|locale|lang)\??\.startsWith\(\s*['"`](?:en|tr)['"`]\s*\)/;
const FORBIDDEN_PICK_HELPER_RE = /^pick(?:Alert|Lang(?:Text)?|Locale|Localized|Translation)$/i;
const MAY_CONTAIN_LOCALE_AST_RE =
	/\b(?:isEn|useEn|isTr|useTr|language|locale|lang)\b|\bpick(?:alert|lang(?:text)?|locale|localized|translation)\b/i;
const I18N_CORE_DIR_RE = /^src\/(?:lib|core)\/i18n(?:\/|$)/;

const sourceFiles = walkSourceFiles(SRC_DIR);
const inlineTernaryViolations = [];
const crossAppImportViolations = [];
let totalInlineTernaries = 0;
const ceilingEntries = Object.keys(ternaryCeilings);
if (ceilingEntries.length > 0) {
	inlineTernaryViolations.push(
		`scripts/i18n-ternary-ceilings.json must remain empty ({}), found ${ceilingEntries.length} ceiling entry(s)`
	);
}
const totalRatchetedCeiling = Object.values(ternaryCeilings).reduce((sum, n) => sum + (Number(n) || 0), 0);

for (const filePath of sourceFiles) {
	const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
	const content = fs.readFileSync(filePath, 'utf8');
	const lines = content.split(/\r?\n/);

	let ternaryCount = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		FORBIDDEN_LOCALE_TERNARY_RE.lastIndex = 0;
		const match = FORBIDDEN_LOCALE_TERNARY_RE.exec(line);
		if (match) {
			inlineTernaryViolations.push(`${relPath}:${i + 1}: forbidden inline locale check \`${match[0]}\``);
		}
		if (RATCHETED_LOCALE_TERNARY_RE.test(line)) {
			ternaryCount++;
		}
		if (FORBIDDEN_TURKLISH_RE.test(line)) {
			inlineTernaryViolations.push(`${relPath}:${i + 1}: forbidden Turklish string detected`);
		}
	}

	let astTernaryCount = 0;
	if (MAY_CONTAIN_LOCALE_AST_RE.test(content)) {
		const sf = ts.createSourceFile(
			filePath,
			content,
			ts.ScriptTarget.Latest,
			true,
			filePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
		);
		const isI18nCore = I18N_CORE_DIR_RE.test(relPath);
		const walkAst = (node) => {
			if (ts.isConditionalExpression(node)) {
				const condText = node.condition.getText(sf);
				if (AST_LOCALE_BRANCH_RE.test(condText)) {
					astTernaryCount++;
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					inlineTernaryViolations.push(
						`${relPath}:${line + 1}: forbidden AST inline locale ternary (${condText.slice(0, 80)})`
					);
				}
			} else if (!isI18nCore && ts.isIfStatement(node)) {
				const exprText = node.expression.getText(sf);
				if (AST_LOCALE_BRANCH_RE.test(exprText)) {
					astTernaryCount++;
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					inlineTernaryViolations.push(
						`${relPath}:${line + 1}: forbidden AST inline locale branch (${exprText.slice(0, 80)})`
					);
				}
			} else if (!isI18nCore && ts.isSwitchStatement(node)) {
				const exprText = node.expression.getText(sf).trim();
				if (/^(?:language|locale|lang)$/.test(exprText) || AST_LOCALE_BRANCH_RE.test(exprText)) {
					astTernaryCount++;
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					inlineTernaryViolations.push(
						`${relPath}:${line + 1}: forbidden AST inline locale switch (${exprText.slice(0, 80)})`
					);
				}
			} else if (!isI18nCore && ts.isFunctionDeclaration(node) && node.name) {
				if (FORBIDDEN_PICK_HELPER_RE.test(node.name.text)) {
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					inlineTernaryViolations.push(
						`${relPath}:${line + 1}: forbidden inline locale picker helper '${node.name.text}'`
					);
				}
			}
			ts.forEachChild(node, walkAst);
		};
		walkAst(sf);
	}

	totalInlineTernaries += Math.max(ternaryCount, astTernaryCount);
	if (ternaryCount > (ternaryCeilings[relPath] ?? 0)) {
		inlineTernaryViolations.push(
			`${relPath}: inline locale ternaries (${ternaryCount}) exceed ratcheted ceiling (${ternaryCeilings[relPath] ?? 0})`
		);
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
	console.error('check-i18n: forbidden inline locale checks, ratcheted ternary ceiling breaches, or Turklish strings found:');
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
	`check-i18n: ${tr.size} keys in TRANSLATIONS, tr and en match perfectly; ` +
		`${sourceFiles.length} source files scanned (${totalInlineTernaries} inline locale ` +
		`ternaries across ratcheted ceiling ${totalRatchetedCeiling}, 0 cross-app imports)`
);
