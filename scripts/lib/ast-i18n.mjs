import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { TRANSLATIONS } from '../../src/lib/i18n.ts';
import { APP_TRANSLATIONS } from '../../src/lib/i18nApps.ts';

const FORBIDDEN_LOCALE_TERNARY_RE = /\b(?:language|locale)\s*(?:===|!==)\s*['"`]tr['"`]/g;
const RATCHETED_LOCALE_TERNARY_RE =
	/\b(?:isEn\s*\?|(?:language|locale|lang)\s*(?:===|!==)\s*['"`](?:en|tr)['"`]\s*\?)/;
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

const AST_LOCALE_BRANCH_RE =
	/\b(?:isEn|useEn|isTr|useTr)\b|\b(?:language|locale|lang)\s*(?:===|!==|==|!=)\s*['"`](?:en|tr)['"`]|\b(?:language|locale|lang)\??\.startsWith\(\s*['"`](?:en|tr)['"`]\s*\)/;
const FORBIDDEN_PICK_HELPER_RE = /^pick(?:Alert|Lang(?:Text)?|Locale|Localized|Translation)$/i;
const MAY_CONTAIN_LOCALE_AST_RE =
	/\b(?:isEn|useEn|isTr|useTr|language|locale|lang)\b|\bpick(?:alert|lang(?:text)?|locale|localized|translation)\b/i;
const I18N_CORE_DIR_RE = /^src\/(?:lib|core)\/i18n(?:\/|$)/;
const I18N_ANY_FILE_RE = /(?:^|\/)(?:src\/(?:lib|core)\/i18n(?:\/|$)|i18n[^/]*\.(?:ts|tsx)$)/;
const UI_ATTR_NAMES = new Set(['aria-label', 'placeholder', 'title', 'alt']);
const TURKISH_DIACRITICS_RE = /[\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015e\u00dc]/;
const FORBIDDEN_UI_ATTR_RE =
	/\b(?:temizle|envanterde|kategori|mevcut|etiketler|yetkisi|filtreleri|kaydet|iptal|duzenle)\b|\b(?:alici@|ornek\.com\b)/i;

export function createI18nChecker(rootDir) {
	const appsDir = path.join(rootDir, 'src', 'apps');
	const appDirs = new Set(
		fs.existsSync(appsDir)
			? fs.readdirSync(appsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
			: []
	);

	const ceilingsPath = path.join(rootDir, 'scripts', 'i18n-ternary-ceilings.json');
	const ternaryCeilings = fs.existsSync(ceilingsPath) ? JSON.parse(fs.readFileSync(ceilingsPath, 'utf8')) : {};
	const mergedTr = { ...TRANSLATIONS.tr, ...APP_TRANSLATIONS.tr };
	const mergedEn = { ...TRANSLATIONS.en, ...APP_TRANSLATIONS.en };
	const tr = new Set(Object.keys(mergedTr));
	const en = new Set(Object.keys(mergedEn));

	const missingInEn = [...tr].filter((k) => !en.has(k));
	const missingInTr = [...en].filter((k) => !tr.has(k));
	const empty = [...tr, ...en].filter((k) => !mergedTr[k]?.trim() && !mergedEn[k]?.trim());
	const dictionaryViolations = [];
	if (missingInEn.length) dictionaryViolations.push(`Missing in en: ${missingInEn.join(', ')}`);
	if (missingInTr.length) dictionaryViolations.push(`Missing in tr: ${missingInTr.join(', ')}`);
	if (empty.length) dictionaryViolations.push(`Empty in both languages: ${empty.join(', ')}`);

	const inlineTernaryViolations = [];
	const crossAppImportViolations = [];
	const ceilingKeys = Object.keys(ternaryCeilings);
	if (ceilingKeys.length > 0) {
		inlineTernaryViolations.push(
			`scripts/i18n-ternary-ceilings.json must remain empty ({}), found ${ceilingKeys.length} ceiling entry(s)`
		);
	}
	const totalRatchetedCeiling = Object.values(ternaryCeilings).reduce((sum, n) => sum + (Number(n) || 0), 0);
	let totalInlineTernaries = 0;

	function checkImportSpecifier(spec, filePath, relPath, appA) {
		if (!spec || !appA) return;
		if (spec.startsWith('@/apps/')) {
			const targetSeg = spec.slice('@/apps/'.length).split('/')[0];
			if (appDirs.has(targetSeg) && targetSeg !== appA) {
				crossAppImportViolations.push(
					`${relPath}: mini-app '${appA}' imports directly from mini-app '${targetSeg}' (${spec})`
				);
			}
		} else if (spec.startsWith('.')) {
			const resolved = path.resolve(path.dirname(filePath), spec);
			const resolvedRelApps = path.relative(appsDir, resolved).replace(/\\/g, '/');
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

	function startFile(filePath, relPath, content) {
		const lines = content.split(/\r?\n/);
		let ternaryCount = 0;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			FORBIDDEN_LOCALE_TERNARY_RE.lastIndex = 0;
			const match = FORBIDDEN_LOCALE_TERNARY_RE.exec(line);
			if (match) {
				inlineTernaryViolations.push(`${relPath}:${i + 1}: forbidden inline locale check \`${match[0]}\``);
			}
			if (RATCHETED_LOCALE_TERNARY_RE.test(line)) ternaryCount++;
			if (FORBIDDEN_TURKLISH_RE.test(line)) {
				inlineTernaryViolations.push(`${relPath}:${i + 1}: forbidden Turklish string detected`);
			}
		}
		const relFromApps = path.relative(appsDir, filePath).replace(/\\/g, '/');
		const appSegment = !relFromApps.startsWith('..') && relFromApps.includes('/') ? relFromApps.split('/')[0] : null;
		const appA = appSegment && appDirs.has(appSegment) ? appSegment : null;
		return {
			filePath,
			relPath,
			appA,
			isI18nCore: I18N_CORE_DIR_RE.test(relPath),
			isI18nFile: I18N_ANY_FILE_RE.test(relPath),
			hasLocaleHint: MAY_CONTAIN_LOCALE_AST_RE.test(content),
			ternaryCount,
			astTernaryCount: 0,
		};
	}

	function visitNode(node, sf, state) {
		if (state.hasLocaleHint) {
			if (ts.isConditionalExpression(node)) {
				const condText = node.condition.getText(sf);
				if (AST_LOCALE_BRANCH_RE.test(condText)) {
					state.astTernaryCount++;
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					inlineTernaryViolations.push(
						`${state.relPath}:${line + 1}: forbidden AST inline locale ternary (${condText.slice(0, 80)})`
					);
				}
			} else if (!state.isI18nCore && ts.isIfStatement(node)) {
				const exprText = node.expression.getText(sf);
				if (AST_LOCALE_BRANCH_RE.test(exprText)) {
					state.astTernaryCount++;
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					inlineTernaryViolations.push(
						`${state.relPath}:${line + 1}: forbidden AST inline locale branch (${exprText.slice(0, 80)})`
					);
				}
			} else if (!state.isI18nCore && ts.isSwitchStatement(node)) {
				const exprText = node.expression.getText(sf).trim();
				if (/^(?:language|locale|lang)$/.test(exprText) || AST_LOCALE_BRANCH_RE.test(exprText)) {
					state.astTernaryCount++;
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					inlineTernaryViolations.push(
						`${state.relPath}:${line + 1}: forbidden AST inline locale switch (${exprText.slice(0, 80)})`
					);
				}
			} else if (!state.isI18nCore && ts.isFunctionDeclaration(node) && node.name) {
				if (FORBIDDEN_PICK_HELPER_RE.test(node.name.text)) {
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					inlineTernaryViolations.push(
						`${state.relPath}:${line + 1}: forbidden inline locale picker helper '${node.name.text}'`
					);
				}
			}
		}
		if (!state.isI18nFile && ts.isJsxAttribute(node) && node.initializer) {
			const attrName = ts.isIdentifier(node.name) ? node.name.text : '';
			if (UI_ATTR_NAMES.has(attrName)) {
				const lit = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
				if (lit && (ts.isStringLiteral(lit) || ts.isNoSubstitutionTemplateLiteral(lit))) {
					const text = lit.text;
					if (FORBIDDEN_UI_ATTR_RE.test(text) || TURKISH_DIACRITICS_RE.test(text)) {
						const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
						inlineTernaryViolations.push(
							`${state.relPath}:${line + 1}: forbidden Turkish UI string in JSX attribute '${attrName}'`
						);
					}
				}
			}
		}
		if (state.appA) {
			if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
				checkImportSpecifier(node.moduleSpecifier.text, state.filePath, state.relPath, state.appA);
			} else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
				checkImportSpecifier(node.arguments[0].text, state.filePath, state.relPath, state.appA);
			}
		}
	}

	function finishFile(state) {
		totalInlineTernaries += Math.max(state.ternaryCount, state.astTernaryCount);
		const ceiling = ternaryCeilings[state.relPath] ?? 0;
		if (state.ternaryCount > ceiling) {
			inlineTernaryViolations.push(
				`${state.relPath}: inline locale ternaries (${state.ternaryCount}) exceed ratcheted ceiling (${ceiling})`
			);
		}
	}

	function getSummary(scannedFiles) {
		return {
			ok:
				dictionaryViolations.length === 0 &&
				inlineTernaryViolations.length === 0 &&
				crossAppImportViolations.length === 0,
			keyCount: tr.size,
			scannedFiles,
			totalInlineTernaries,
			totalRatchetedCeiling,
			dictionaryViolations,
			inlineTernaryViolations,
			crossAppImportViolations,
		};
	}

	return { startFile, visitNode, finishFile, getSummary };
}
