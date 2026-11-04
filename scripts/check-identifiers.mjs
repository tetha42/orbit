// Identifier purity: no Turkish words in variable, parameter, property, function,
// type or member names under src/. Walks the TypeScript AST (not text), so strings,
// comments and i18n copy are ignored. The Turkish vocabulary lives in
// src/db/legacy/words.json (`words`); `dataWords` are stored data values
// (statuses, enum members) that may still be spelled as identifiers.
//
//   node scripts/check-identifiers.mjs
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');
const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'db', 'legacy', 'words.json'), 'utf8'));
const WORDS = new Set(Object.keys(dict.words));
const DATA = new Set(dict.dataWords);
const SKIP_FILE = /(^|\/)(i18n[A-Za-z]*|translations)\.ts$|\.gen\.ts$/;
const NON_ASCII_LETTER = /[çğıöşüÇĞİÖŞÜ]/;

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

function declaredNames(sf) {
	const names = [];
	const add = (id, prop = false) => {
		if (id && (ts.isIdentifier(id) || ts.isPrivateIdentifier(id))) names.push({ name: id.text, prop });
	};
	const addBinding = (b) => {
		if (!b) return;
		if (ts.isIdentifier(b)) add(b);
		else if (ts.isObjectBindingPattern(b) || ts.isArrayBindingPattern(b)) for (const el of b.elements) if (ts.isBindingElement(el)) addBinding(el.name);
	};
	const visit = (node) => {
		if (ts.isVariableDeclaration(node) || ts.isParameter(node)) addBinding(node.name);
		else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) add(node.name);
		else if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node) || ts.isEnumMember(node)) {
			if (node.name) add(node.name, true);
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return names;
}

const violations = [];
for (const file of walk(SRC_DIR)) {
	const rel = path.relative(ROOT, file).replace(/\\/g, '/');
	if (SKIP_FILE.test(rel)) continue;
	const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
	const seen = new Set();
	for (const { name, prop } of declaredNames(sf)) {
		if (seen.has(name)) continue;
		seen.add(name);
		if (DATA.has(name)) continue;
		const hit = pieces(name).find((w) => WORDS.has(w));
		if (hit) violations.push(`${rel}: '${name}' (Turkish word '${hit}')`);
		else if (!prop && NON_ASCII_LETTER.test(name)) violations.push(`${rel}: '${name}' (non-ASCII letter)`);
	}
}

if (violations.length) {
	console.error('check-identifiers: Turkish identifiers are not allowed — use English names:');
	for (const v of violations) console.error(`  - ${v}`);
	process.exit(1);
}
console.log('check-identifiers: 0 Turkish identifiers under src/');
