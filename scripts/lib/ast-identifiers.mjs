import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const I18N_DICTIONARY_FILE = /(^|\/)(?:src\/lib\/i18n\/.*|i18n[A-Za-z]*|translations)\.ts$/;
const SKIP_VALUE_SCAN_FILE = new RegExp(`${I18N_DICTIONARY_FILE.source}|\\.gen\\.ts$`);
const NON_ASCII_LETTER = /[\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015e\u00dc]/;

const splitPieces = (name) =>
	name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.split(/[\s_$-]+/)
		.filter(Boolean)
		.map((s) => s.toLowerCase());

export function createIdentifierChecker(rootDir) {
	const dictDir = path.join(rootDir, 'scripts', 'dict');
	const dict = JSON.parse(fs.readFileSync(path.join(dictDir, 'words.json'), 'utf8'));
	const valuesDict = JSON.parse(fs.readFileSync(path.join(dictDir, 'values.json'), 'utf8')).values;
	const words = new Set([...Object.keys(dict.words), ...Object.keys(dict.wholeTokens || {})]);
	const oldValues = new Set(Object.keys(valuesDict));
	const cache = new Map();
	const violations = [];

	function checkName(name) {
		if (cache.has(name)) return cache.get(name);
		let result = null;
		if (/[a-z]Mi$/.test(name) || /[a-z]_[A-Z]/.test(name)) {
			result = '(Turkish question suffix or mixed snake/camel case)';
		} else {
			const hit = splitPieces(name).find((w) => words.has(w));
			if (hit) result = `(Turkish word '${hit}')`;
			else if (NON_ASCII_LETTER.test(name)) result = 'non-ascii';
		}
		cache.set(name, result);
		return result;
	}

	function startFile(relPath) {
		return {
			relPath,
			skip: /\.gen\.ts$/.test(relPath),
			scanValues: !SKIP_VALUE_SCAN_FILE.test(relPath),
			declNames: [],
		};
	}

	function visitNode(node, parent, sf, state) {
		if (state.skip) return;
		const add = (id, prop = false) => {
			if (id && (ts.isIdentifier(id) || ts.isPrivateIdentifier(id))) {
				state.declNames.push({ name: id.text, prop });
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

		if (
			state.scanValues &&
			(ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
			oldValues.has(node.text)
		) {
			const isI18nKey = parent && ts.isCallExpression(parent) && /^(t|fill)$/.test(parent.expression.getText(sf));
			if (!isI18nKey) {
				const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
				violations.push(
					`${state.relPath}:${line + 1}: stored value '${node.text}' is Turkish (use '${valuesDict[node.text]}')`
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
				if (ts.isStringLiteral(node.name)) state.declNames.push({ name: node.name.text, prop: true });
				else add(node.name, true);
			}
		} else if (ts.isPropertyAccessExpression(node)) {
			add(node.name, true);
		}
	}

	function finishFile(state) {
		if (state.skip) return;
		const seen = new Set();
		for (const { name, prop } of state.declNames) {
			if (seen.has(name)) continue;
			seen.add(name);
			const res = checkName(name);
			if (res === null) continue;
			if (res === 'non-ascii') {
				if (!prop) violations.push(`${state.relPath}: '${name}' (non-ASCII letter)`);
			} else {
				violations.push(`${state.relPath}: '${name}' ${res}`);
			}
		}
	}

	function getSummary() {
		return { ok: violations.length === 0, violations };
	}

	return { startFile, visitNode, finishFile, getSummary };
}
