// Identifier purity: no Turkish words in variable, parameter, property, function,
// type or member names under src/. Walks the TypeScript AST (not text), so strings,
// comments and i18n copy are ignored. The Turkish vocabulary lives in
// scripts/dict/words.json (words) and scripts/dict/values.json (stored values).
//
//   node scripts/check-identifiers.mjs
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');
const DICT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dict');
const dict = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'words.json'), 'utf8'));
const valuesDict = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'values.json'), 'utf8')).values;
const WORDS = new Set([...Object.keys(dict.words), ...Object.keys(dict.wholeTokens || {})]);
const OLD_VALUES = new Set(Object.keys(valuesDict));
const I18N_DICTIONARY_FILE = /(^|\/)(?:src\/lib\/i18n\/.*|i18n[A-Za-z]*|translations)\.ts$/;
const SKIP_VALUE_SCAN_FILE = new RegExp(`${I18N_DICTIONARY_FILE.source}|\\.gen\\.ts$`);
const NON_ASCII_LETTER = /[\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015e\u00dc]/;

const pieces = (name) =>
	name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.split(/[\s_$-]+/)
		.filter(Boolean)
		.map((s) => s.toLowerCase());

function walk(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full);
	}
	return out;
}

const identifierResultCache = new Map();

function checkIdentifier(name) {
	if (identifierResultCache.has(name)) return identifierResultCache.get(name);
	let result = null;
	if (/[a-z]Mi$/.test(name) || /[a-z]_[A-Z]/.test(name)) {
		result = '(Turkish question suffix or mixed snake/camel case)';
	} else {
		const hit = pieces(name).find((w) => WORDS.has(w));
		if (hit) {
			result = `(Turkish word '${hit}')`;
		} else if (NON_ASCII_LETTER.test(name)) {
			result = 'non-ascii';
		}
	}
	identifierResultCache.set(name, result);
	return result;
}

function inspectSourceFile(sf, rel, scanValues, violations) {
	const declNames = [];
	const add = (id, prop = false) => {
		if (id && (ts.isIdentifier(id) || ts.isPrivateIdentifier(id))) {
			declNames.push({ name: id.text, prop });
		}
	};
	const addBinding = (b) => {
		if (!b) return;
		if (ts.isIdentifier(b)) add(b);
		else if (ts.isObjectBindingPattern(b) || ts.isArrayBindingPattern(b)) {
			for (const el of b.elements) {
				if (ts.isBindingElement(el)) addBinding(el.name);
			}
		}
	};
	const visit = (node, parent) => {
		if (
			scanValues &&
			(ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
			OLD_VALUES.has(node.text)
		) {
			const isI18nKey =
				parent &&
				ts.isCallExpression(parent) &&
				/^(t|fill)$/.test(parent.expression.getText(sf));
			if (!isI18nKey) {
				const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
				violations.push(
					`${rel}:${line + 1}: stored value '${node.text}' is Turkish (use '${valuesDict[node.text]}')`
				);
			}
		}
		if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
			addBinding(node.name);
		} else if (
			ts.isFunctionDeclaration(node) ||
			ts.isClassDeclaration(node) ||
			ts.isInterfaceDeclaration(node) ||
			ts.isTypeAliasDeclaration(node) ||
			ts.isEnumDeclaration(node)
		) {
			add(node.name);
		} else if (
			ts.isPropertySignature(node) ||
			ts.isPropertyDeclaration(node) ||
			ts.isMethodDeclaration(node) ||
			ts.isMethodSignature(node) ||
			ts.isPropertyAssignment(node) ||
			ts.isShorthandPropertyAssignment(node) ||
			ts.isGetAccessor(node) ||
			ts.isSetAccessor(node) ||
			ts.isEnumMember(node)
		) {
			if (node.name) {
				if (ts.isStringLiteral(node.name)) declNames.push({ name: node.name.text, prop: true });
				else add(node.name, true);
			}
		} else if (ts.isPropertyAccessExpression(node)) {
			add(node.name, true);
		}
		ts.forEachChild(node, (child) => visit(child, node));
	};
	visit(sf, undefined);
	return declNames;
}

const violations = [];
for (const file of walk(SRC_DIR)) {
	const rel = path.relative(ROOT, file).replace(/\\/g, '/');
	if (/\.gen\.ts$/.test(rel)) continue;
	const sf = ts.createSourceFile(
		file,
		fs.readFileSync(file, 'utf8'),
		ts.ScriptTarget.Latest,
		false,
		file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	);
	const seen = new Set();
	const declNames = inspectSourceFile(sf, rel, !SKIP_VALUE_SCAN_FILE.test(rel), violations);
	for (const { name, prop } of declNames) {
		if (seen.has(name)) continue;
		seen.add(name);
		const res = checkIdentifier(name);
		if (res === null) continue;
		if (res === 'non-ascii') {
			if (!prop) violations.push(`${rel}: '${name}' (non-ASCII letter)`);
		} else {
			violations.push(`${rel}: '${name}' ${res}`);
		}
	}
}

if (violations.length) {
	console.error('check-identifiers: Turkish identifiers are not allowed — use English names:');
	for (const v of violations) console.error(`  - ${v}`);
	process.exit(1);
}
console.log('check-identifiers: 0 Turkish identifiers under src/');
